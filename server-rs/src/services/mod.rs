pub mod session;
pub mod game;
pub mod rate_limit;

use crate::database::Database;

pub struct ServiceContainer {
    pub session: session::SessionService,
    pub game: game::GameService,
    pub rate_limit: rate_limit::RateLimitService,
}

impl ServiceContainer {
    pub fn new(database: Database) -> Self {
        Self {
            session: session::SessionService::new(database.clone()),
            game: game::GameService::new(database.clone()),
            rate_limit: rate_limit::RateLimitService::new(),
        }
    }
}
