use axum::{
    routing::{get, post},
    Router,
    extract::State,
    Json,
};
use std::net::SocketAddr;
use mongodb::{Client, Database, IndexModel, bson::doc};
use anyhow::Result;
use tracing::{error, info};
mod primitives;
use primitives::MatchedOrder;

// Handler state to hold MongoDB connection
#[derive(Clone)]
struct AppState {
    db: Database,
}

async fn health_check(State(_state): State<AppState>) -> &'static str {
    "Online"
}

async fn create_order(
    State(state): State<AppState>,
    Json(matched_order): Json<MatchedOrder>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {    
    let orders_collection = state.db.collection::<MatchedOrder>("orders");
    
    match orders_collection.insert_one(&matched_order, None).await {
        Ok(result) => {
            info!("Order created : {:?}", result.inserted_id);
            Ok(Json(serde_json::json!({
                "success": true,
                "message": "Order created successfully",
                "order_id": result.inserted_id
            })))
        }
        Err(e) => {
            error!("Failed to create order: {}", e);
            Err((
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create order: {}", e)
            ))
        }
    }
}

async fn setup_mongodb() -> Result<Database> {
    // Connect to MongoDB (default: localhost:27017)
    let client = Client::with_uri_str("mongodb+srv://gsnr1925:4ccbmCombV2Zp1tC@cluster0.owm6ysq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0").await
        .map_err(|e| {
            error!("Failed to connect to MongoDB: {}", e);
            e
        })?;
    
    let db = client.database("orderbook");
    Ok(db)
}

async fn migrate_schema(db: &Database) -> Result<()> {    
    // Create single orders collection for all MatchedOrder documents
    let orders_collection = db.collection::<MatchedOrder>("orders");
    
    // Create indexes for the orders collection
    let order_indexes = vec![
        IndexModel::builder().keys(doc! { "create_order.create_id": 1 }).build(),
        IndexModel::builder().keys(doc! { "created_at": -1 }).build(),
        IndexModel::builder().keys(doc! { "source_swap.swap_id": 1 }).build(),
        IndexModel::builder().keys(doc! { "destination_swap.swap_id": 1 }).build(),
        IndexModel::builder().keys(doc! { "source_swap.chain": 1, "destination_swap.chain": 1 }).build(),
        IndexModel::builder().keys(doc! { "source_swap.initiator": 1 }).build(),
        IndexModel::builder().keys(doc! { "destination_swap.initiator": 1 }).build(),
    ];
    
    for index in order_indexes {
        match orders_collection.create_index(index, None).await {
            Ok(_) => {},
            Err(e) if e.to_string().contains("IndexKeySpecsConflict") || e.to_string().contains("already exists") => {
            }
            Err(e) => return Err(e.into()),
        }
    }
    
    // Create unique index for create_id separately
    let unique_create_id_index = IndexModel::builder()
        .keys(doc! { "create_order.create_id": 1 })
        .options(mongodb::options::IndexOptions::builder().unique(true).build())
        .build();
    match orders_collection.create_index(unique_create_id_index, None).await {
        Ok(_) => {},
        Err(e) if e.to_string().contains("IndexKeySpecsConflict") || e.to_string().contains("already exists") => {
        }
        Err(e) => return Err(e.into()),
    }
    
    // Create unique index for swap_ids separately
    let unique_source_swap_index = IndexModel::builder()
        .keys(doc! { "source_swap.swap_id": 1 })
        .options(mongodb::options::IndexOptions::builder().unique(true).build())
        .build();
    match orders_collection.create_index(unique_source_swap_index, None).await {
        Ok(_) => {},
        Err(e) if e.to_string().contains("IndexKeySpecsConflict") || e.to_string().contains("already exists") => {
        }
        Err(e) => return Err(e.into()),
    }
    
    let unique_dest_swap_index = IndexModel::builder()
        .keys(doc! { "destination_swap.swap_id": 1 })
        .options(mongodb::options::IndexOptions::builder().unique(true).build())
        .build();
    match orders_collection.create_index(unique_dest_swap_index, None).await {
        Ok(_) => {},
        Err(e) if e.to_string().contains("IndexKeySpecsConflict") || e.to_string().contains("already exists") => {
        }
        Err(e) => return Err(e.into()),
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {

    let _ = tracing_subscriber::fmt()
        .try_init();

    // Setup MongoDB connection
    let db = setup_mongodb().await?;
    
    // Run schema migration
    migrate_schema(&db).await?;
    
    // Create app state
    let state = AppState { db };
    
    // Build our application with routes and state
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/orders", post(create_order))
        .with_state(state);

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 4455));
    println!("Server starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
