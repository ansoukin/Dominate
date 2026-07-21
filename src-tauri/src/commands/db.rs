//! 数据库相关命令

use std::sync::Arc;

use tauri::State;

use crate::error::Result;
use crate::state::AppState;

/// 简单的 ping 命令，用于前端验证后端连通性
#[tauri::command]
pub async fn ping() -> Result<String> {
    Ok("pong".to_string())
}

/// 获取数据库信息（路径、大小等）
#[tauri::command]
pub async fn get_db_info(state: State<'_, Arc<AppState>>) -> Result<serde_json::Value> {
    let path = state.db.path().to_string_lossy().to_string();
    let size = std::fs::metadata(&path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(serde_json::json!({
        "path": path,
        "size_bytes": size,
        "size_human": format_size(size),
    }))
}

/// 手动执行数据库迁移
#[tauri::command]
pub async fn run_migrations(state: State<'_, Arc<AppState>>) -> Result<()> {
    state.db.run_migrations()
}

/// 将字节数格式化为人类可读字符串
fn format_size(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    format!("{:.2} {}", size, UNITS[unit_idx])
}
