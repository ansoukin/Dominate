//! 触发器管理命令

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::Trigger;
use crate::state::AppState;

/// 列出指定 Flow 的所有触发器
#[tauri::command]
pub async fn list_triggers(state: State<'_, Arc<AppState>>, flow_id: String) -> Result<Vec<Trigger>> {
    let repo = Repository::new(&state.db);
    repo.list_triggers(&flow_id)
}

/// 替换 Flow 的所有触发器
#[tauri::command]
pub async fn set_triggers(
    state: State<'_, Arc<AppState>>,
    flow_id: String,
    triggers: Vec<Trigger>,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.set_triggers(&flow_id, &triggers)?;
    // 触发器变更需要重载调度器
    state.reload_triggers()
}

/// 启用触发器
#[tauri::command]
pub async fn enable_trigger(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.enable_trigger(&id)?;
    state.reload_triggers()
}

/// 禁用触发器
#[tauri::command]
pub async fn disable_trigger(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.disable_trigger(&id)?;
    state.reload_triggers()
}
