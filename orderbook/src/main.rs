use axum::{
    routing::get,
    Router
};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Build our application with a route
    let app = Router::new()
        .route("/health", get(health_check));

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Server starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "Online"
}
