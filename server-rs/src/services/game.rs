use crate::{database::Database, error::{AppError, AppResult}, models::{Game, Player}};
use sqlx::Row;
use uuid::Uuid;

pub struct GameService {
    db: Database,
}

impl GameService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub async fn create_game(&self, session_id: Uuid, player_count: i32, script: Option<String>) -> AppResult<Game> {
        let game = sqlx::query_as::<_, Game>(
            r#"
            INSERT INTO games (session_id, player_count, script)
            VALUES ($1, $2, $3)
            RETURNING id, session_id, created_at, player_count, script, winning_team, ended_at
            "#
        )
        .bind(session_id)
        .bind(player_count)
        .bind(script)
        .fetch_one(&self.db.pool)
        .await?;

        Ok(game)
    }

    pub async fn get_game(&self, game_id: i32) -> AppResult<Option<Game>> {
        let game = sqlx::query_as::<_, Game>(
            "SELECT id, session_id, created_at, player_count, script, winning_team, ended_at FROM games WHERE id = $1"
        )
        .bind(game_id)
        .fetch_optional(&self.db.pool)
        .await?;

        Ok(game)
    }

    pub async fn get_games(&self, limit: i64, offset: i64) -> AppResult<Vec<Game>> {
        let games = sqlx::query_as::<_, Game>(
            "SELECT id, session_id, created_at, player_count, script, winning_team, ended_at 
             FROM games ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.db.pool)
        .await?;

        Ok(games)
    }

    pub async fn get_players(&self, game_id: i32) -> AppResult<Vec<Player>> {
        let players = sqlx::query_as::<_, Player>(
            "SELECT id, game_id, discord_id, discord_username, character, team, 
                    died_at_night, died_at_execution, survived 
             FROM players WHERE game_id = $1"
        )
        .bind(game_id)
        .fetch_all(&self.db.pool)
        .await?;

        Ok(players)
    }

    pub async fn count_total_games(&self) -> AppResult<i64> {
        let row = sqlx::query("SELECT COUNT(*) FROM games")
            .fetch_one(&self.db.pool)
            .await?;

        Ok(row.get(0))
    }
}
