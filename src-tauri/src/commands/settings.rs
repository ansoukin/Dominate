//! 设置读写命令

use std::sync::Arc;

use tauri::State;

use crate::db::Repository;
use crate::error::Result;
use crate::models::Setting;
use crate::state::AppState;

/// 获取单个设置项
#[tauri::command]
pub async fn get_setting(
    state: State<'_, Arc<AppState>>,
    key: String,
) -> Result<Option<Setting>> {
    let repo = Repository::new(&state.db);
    repo.get_setting(&key)
}

/// 设置值（upsert：存在则更新，不存在则插入）
#[tauri::command]
pub async fn set_setting(
    state: State<'_, Arc<AppState>>,
    setting: Setting,
) -> Result<()> {
    let repo = Repository::new(&state.db);
    repo.set_setting(&setting)
}

/// 获取所有设置
#[tauri::command]
pub async fn get_all_settings(state: State<'_, Arc<AppState>>) -> Result<Vec<Setting>> {
    let repo = Repository::new(&state.db);
    repo.get_all_settings()
}
