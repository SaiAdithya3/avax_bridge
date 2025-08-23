use axum::{
    routing::{get, post},
    Router,
    extract::{State, Path},
    Json,
};
use std::{collections::HashMap, net::SocketAddr, str::FromStr};
use mongodb::{Client, Database, IndexModel, bson::doc};
use anyhow::Result;
use tracing::{error, info};
mod primitives;
mod config;
mod services;
// mod bitcoin_htlc;
use primitives::{MatchedOrder, CreateOrder, Response};
use config::AppConfig;
use services::OrderService;
use alloy::{
    hex::FromHex, network::EthereumWallet, primitives::{Address, FixedBytes}, providers::{fillers::{ChainIdFiller, GasFiller, JoinFill, NonceFiller, SimpleNonceManager, WalletFiller}, Identity, ProviderBuilder, RootProvider}, signers::local::PrivateKeySigner, sol, transports::http::reqwest::Url
};

use crate::HTLCRegistry::HTLCRegistryInstance;


sol!(
    #[sol(rpc)]
    HTLCRegistry,
    "src/abi/registry.json",
);


#[derive(Clone)]
struct AppState {
    db: Database,
    order_service: OrderService
}

async fn health_check(State(_state): State<AppState>) -> &'static str {
    "Online"
}

async fn create_order(
    State(state): State<AppState>,
    Json(create_order): Json<CreateOrder>,
) -> Result<Json<Response<String>>, (axum::http::StatusCode, Json<Response<()>>)> {    
            let matched_order = match state.order_service.get_matched_order(create_order).await {
        Ok(order) => order,
        Err(e) => {
            error!("Failed to get matched order: {}", e);
            return Err((
                axum::http::StatusCode::BAD_REQUEST,
                Json(Response::<()>::error(format!("Failed to get matched order: {}", e)))
            ));
        }
    };
    
    let orders_collection = state.db.collection::<MatchedOrder>("orders");
    
    match orders_collection.insert_one(&matched_order, None).await {
        Ok(_result) => {
            let create_id = matched_order.create_order.create_id.clone().unwrap_or_else(|| "unknown".to_string());
            info!("Order created: {:?}", create_id);
            Ok(Json(Response::success(create_id)))
        }
        Err(e) => {
            error!("Failed to insert order into database: {}", e);
            Err((
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(Response::<()>::error("Internal server error".to_string()))
            ))
        }
    }
}

async fn get_order(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Response<MatchedOrder>>, (axum::http::StatusCode, Json<Response<()>>)> {
    let orders_collection = state.db.collection::<MatchedOrder>("orders");
    
    let filter = doc! { "create_order.create_id": &id };
    
    match orders_collection.find_one(filter, None).await {
        Ok(Some(matched_order)) => {
            info!("Order found: {:?}", id);
            Ok(Json(Response::success(matched_order)))
        }
        Ok(None) => {
            info!("Order not found: {:?}", id);
            Err((
                axum::http::StatusCode::NOT_FOUND,
                Json(Response::<()>::error("Order not found".to_string()))
            ))
        }
        Err(e) => {
            error!("Failed to query database: {}", e);
            Err((
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(Response::<()>::error("Internal server error".to_string()))
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

pub type AlloyProvider = alloy::providers::fillers::FillProvider<
    JoinFill<
        JoinFill<
            JoinFill<JoinFill<Identity, GasFiller>, NonceFiller<SimpleNonceManager>>,
            ChainIdFiller,
        >,
        WalletFiller<EthereumWallet>,
    >,
    RootProvider,
>;

#[tokio::main]
async fn main() -> Result<()> {

    let _ = tracing_subscriber::fmt()
        .try_init();

    // Setup MongoDB connection
    let db = setup_mongodb().await?;
    
    // Run schema migration
    migrate_schema(&db).await?;
    
    // Load configuration from file
    let config = AppConfig::from_file("config.json")
        .map_err(|e| {
            error!("Failed to load config: {}", e);
            e
        })?;

    let mut evm_registries: HashMap<String, HTLCRegistryInstance<AlloyProvider>> = HashMap::new();

    for (chain_id, chain_config) in config.chains.clone() {
        let signer = PrivateKeySigner::from_bytes(
            &FixedBytes::from_hex(chain_config.relay_private_key).expect("Invalid executor private key"),
        )
        .unwrap();
        let wallet = EthereumWallet::from(signer.clone());

        let provider =     ProviderBuilder::new()
            .disable_recommended_fillers()
            .with_gas_estimation()
            .with_simple_nonce_management()
            .fetch_chain_id()
            .wallet(wallet)
            .connect_http(Url::parse(&chain_config.rpc_url).unwrap());

        let registry = HTLCRegistryInstance::new(Address::from_str(&chain_config.registry_address).unwrap(), provider);
        evm_registries.insert(chain_id, registry);
    }

    // Create order service
    let order_service = OrderService::new(config.clone(), evm_registries);
    // Create app state
    let state = AppState { db, order_service };
    
    // Build our application with routes and state
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/orders", post(create_order))
        .route("/orders/:id", get(get_order))
        .with_state(state);

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 4455));
    println!("Server starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
