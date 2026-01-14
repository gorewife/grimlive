use crate::{database::Database, error::{AppError, AppResult}, models::Session};
use sqlx::Row;
use uuid::Uuid;

pub struct SessionService {
    db: Database,
}

impl SessionService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn create_session(&self, host_discord_id: Option<String>) -> AppResult<Session> {
        let session = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (host_discord_id)
            VALUES ($1)
            RETURNING id, host_discord_id, created_at, ended_at, script_name
            "#
        )
        .bind(host_discord_id)
        .fetch_one(&self.db.pool)
        .await?;

        Ok(session)
    }

    pub async fn get_session(&self, session_id: Uuid) -> AppResult<Option<Session>> {
        let session = sqlx::query_as::<_, Session>(
            "SELECT id, host_discord_id, created_at, ended_at, script_name FROM sessions WHERE id = $1"
        )
        .bind(session_id)
        .fetch_optional(&self.db.pool)
        .await?;

        Ok(session)
    }

    pub async fn end_session(&self, session_id: Uuid) -> AppResult<()> {
        sqlx::query("UPDATE sessions SET ended_at = NOW() WHERE id = $1")
            .bind(session_id)
            .execute(&self.db.pool)
            .await?;

        Ok(())
    }

    pub async fn count_active_sessions(&self) -> AppResult<i64> {
        let row = sqlx::query("SELECT COUNT(*) FROM sessions WHERE ended_at IS NULL")
            .fetch_one(&self.db.pool)
            .await?;

        Ok(row.get(0))
    }
}
