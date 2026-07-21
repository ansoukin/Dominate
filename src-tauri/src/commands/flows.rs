//! 快捷指令 CRUD 命令

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::{AutomationFlow, CreateFlowRequest, UpdateFlowRequest};
use crate::state::AppState;

/// 列出所有快捷指令
#[tauri::command]
pub async fn list_flows(state: State<'_, Arc<AppState>>) -> Result<Vec<AutomationFlow>> {
    let repo = Repository::new(&state.db);
    repo.list_flows()
}

/// 获取单个快捷指令
#[tauri::command]
pub async fn get_flow(state: State<'_, Arc<AppState>>, id: String) -> Result<Option<AutomationFlow>> {
    let repo = Repository::new(&state.db);
    repo.get_flow(&id)
}

/// 创建快捷指令
#[tauri::command]
pub async fn create_flow(state: State<'_, Arc<AppState>>, request: CreateFlowRequest) -> Result<AutomationFlow> {
    let repo = Repository::new(&state.db);
    let flow = repo.create_flow(request)?;
    // 新建 flow 时无需重载调度器（没有触发器）
    Ok(flow)
}

/// 更新快捷指令
#[tauri::command]
pub async fn update_flow(state: State<'_, Arc<AppState>>, id: String, request: UpdateFlowRequest) -> Result<AutomationFlow> {
    let repo = Repository::new(&state.db);
    let flow = repo.update_flow(&id, request)?;
    // Flow 启用状态变更可能影响调度器
    state.reload_triggers()?;
    Ok(flow)
}

/// 删除快捷指令
#[tauri::command]
pub async fn delete_flow(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.delete_flow(&id)?;
    state.reload_triggers()
}

/// 启用快捷指令
#[tauri::command]
pub async fn enable_flow(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.enable_flow(&id)?;
    state.reload_triggers()
}

/// 禁用快捷指令
#[tauri::command]
pub async fn disable_flow(state: State<'_, Arc<AppState>>, id: String) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.disable_flow(&id)?;
    state.reload_triggers()
}
