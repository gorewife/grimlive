use crate::error::{AppError, AppResult};

pub fn validate_discord_id(discord_id: &str) -> AppResult<()> {
    if discord_id.is_empty() || discord_id.len() > 20 {
        return Err(AppError::Validation("Invalid Discord ID".to_string()));
    }
    
    if !discord_id.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::Validation("Discord ID must be numeric".to_string()));
    }
    
    Ok(())
}

pub fn validate_script_name(script_name: &str) -> AppResult<()> {
    if script_name.is_empty() || script_name.len() > 100 {
        return Err(AppError::Validation("Invalid script name".to_string()));
    }
    
    Ok(())
}

pub fn validate_api_key_name(name: &str) -> AppResult<()> {
    if name.is_empty() || name.len() > 50 {
        return Err(AppError::Validation("API key name must be 1-50 characters".to_string()));
    }
    
    Ok(())
}

pub fn validate_rate_limit(rate_limit: i32) -> AppResult<()> {
    if rate_limit < 1 || rate_limit > 10000 {
        return Err(AppError::Validation("Rate limit must be between 1 and 10000".to_string()));
    }
    
    Ok(())
}
