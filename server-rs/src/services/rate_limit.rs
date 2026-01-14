use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Clone)]
struct RateLimitEntry {
    count: u32,
    reset_time: Instant,
}

pub struct RateLimitService {
    store: Arc<RwLock<HashMap<String, RateLimitEntry>>>,
}

impl RateLimitService {
    pub fn new() -> Self {
        let service = Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        };

        // Spawn cleanup task
        let store_clone = service.store.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
            loop {
                interval.tick().await;
                let now = Instant::now();
                let mut store = store_clone.write().await;
                store.retain(|_, entry| entry.reset_time > now);
            }
        });

        service
    }

    pub async fn check_rate_limit(
        &self,
        key: &str,
        max_requests: u32,
        window_ms: u64,
    ) -> bool {
        let mut store = self.store.write().await;
        let now = Instant::now();
        let window = Duration::from_millis(window_ms);

        match store.get_mut(key) {
            Some(entry) => {
                if entry.reset_time <= now {
                    // Window expired, reset
                    entry.count = 1;
                    entry.reset_time = now + window;
                    true
                } else if entry.count < max_requests {
                    // Within limit
                    entry.count += 1;
                    true
                } else {
                    // Rate limit exceeded
                    false
                }
            }
            None => {
                // First request
                store.insert(
                    key.to_string(),
                    RateLimitEntry {
                        count: 1,
                        reset_time: now + window,
                    },
                );
                true
            }
        }
    }
}
