//! 动作管理命令

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::Action;
use crate::state::AppState;

/// 列出指定 Flow 的所有动作（按 order 排序）
#[tauri::command]
pub async fn list_actions(state: State<'_, Arc<AppState>>, flow_id: String) -> Result<Vec<Action>> {
    let repo = Repository::new(&state.db);
    repo.list_actions(&flow_id)
}

/// 替换 Flow 的所有动作（事务：先删除旧的再插入新的）
#[tauri::command]
pub async fn set_actions(
    state: State<'_, Arc<AppState>>,
    flow_id: String,
    actions: Vec<Action>,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.set_actions(&flow_id, &actions)?;
    // 动作变更不需要重载调度器（动作不属于触发器）
    Ok(())
}
