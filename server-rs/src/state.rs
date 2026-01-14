use crate::{config::Config, database::Database, services::ServiceContainer};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub database: Database,
    pub services: Arc<ServiceContainer>,
}

impl AppState {
    pub fn new(config: Config, database: Database, services: ServiceContainer) -> Self {
        Self {
            config,
            database,
            services: Arc::new(services),
        }
    }
}
