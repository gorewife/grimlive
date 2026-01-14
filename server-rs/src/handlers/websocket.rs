use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use crate::{models::WsMessage, state::AppState};

pub type Clients = Arc<RwLock<std::collections::HashMap<String, tokio::sync::mpsc::UnboundedSender<Message>>>>;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let client_id = Uuid::new_v4().to_string();

    tracing::info!("WebSocket client connected: {}", client_id);

    // Create a channel for this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

    // Spawn task to send messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        let mut session_id: Option<Uuid> = None;

        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    tracing::debug!("Received message from {}: {}", client_id, text);

                    // Parse message
                    match serde_json::from_str::<WsMessage>(&text) {
                        Ok(ws_msg) => {
                            match ws_msg {
                                WsMessage::Connect {
                                    session_id: sid,
                                    discord_id,
                                    username,
                                } => {
                                    // Parse session ID
                                    if let Ok(parsed_sid) = Uuid::parse_str(&sid) {
                                        session_id = Some(parsed_sid);
                                        tracing::info!(
                                            "Client {} connected to session {}",
                                            client_id,
                                            parsed_sid
                                        );

                                        // TODO: Store client in session-specific collection
                                        // TODO: Broadcast to other clients in session
                                    }
                                }
                                WsMessage::GameState { players, night, phase } => {
                                    if let Some(sid) = session_id {
                                        tracing::debug!(
                                            "Game state update for session {}: {} players, night {}, phase {}",
                                            sid,
                                            players.len(),
                                            night,
                                            phase
                                        );
                                        // TODO: Broadcast to session
                                    }
                                }
                                WsMessage::PlayerUpdate { player } => {
                                    if let Some(sid) = session_id {
                                        tracing::debug!(
                                            "Player update for session {}: {}",
                                            sid,
                                            player.name
                                        );
                                        // TODO: Broadcast to session
                                    }
                                }
                                WsMessage::Timer { duration, remaining } => {
                                    if let Some(sid) = session_id {
                                        // TODO: Broadcast timer update
                                    }
                                }
                                WsMessage::Chat { from, message } => {
                                    if let Some(sid) = session_id {
                                        tracing::debug!("Chat from {}: {}", from, message);
                                        // TODO: Broadcast chat message
                                    }
                                }
                                _ => {}
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to parse message: {}", e);
                        }
                    }
                }
                Message::Close(_) => {
                    tracing::info!("Client {} disconnected", client_id);
                    break;
                }
                Message::Ping(data) => {
                    // Respond with pong
                    if tx.send(Message::Pong(data)).is_err() {
                        break;
                    }
                }
                _ => {}
            }
        }

        client_id
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        client_id = (&mut recv_task) => {
            send_task.abort();
            tracing::info!("Client {} connection closed", client_id.unwrap());
        }
    }
}
