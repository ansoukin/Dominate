//! 应用全局状态
//!
//! 由 Tauri 的 `app.manage()` 注册，所有 Tauri 命令通过 `State<'_, Arc<AppState>>` 访问。
//!
//! 持有：
//! - Database（SQLite 连接）
//! - ActionExecutorRegistry（动作执行器注册表）
//! - ChainEngine（动作链执行引擎）
//! - TriggerScheduler（触发器调度器）
//! - GlobalVariables（跨动作链共享的全局变量池）

use std::sync::Arc;

use parking_lot::RwLock;
use tauri::AppHandle;

use crate::actions::{ActionExecutorRegistry, GlobalVariables};
use crate::db::Database;
use crate::error::Result;
use crate::executor::ChainEngine;
use crate::triggers::TriggerScheduler;

/// 应用全局状态
pub struct AppState {
    /// 数据库连接
    pub db: Arc<Database>,
    /// Tauri 应用句柄
    pub app_handle: AppHandle,
    /// 动作执行器注册表
    pub registry: Arc<ActionExecutorRegistry>,
    /// 动作链执行引擎
    pub chain_engine: Arc<ChainEngine>,
    /// 触发器调度器
    pub scheduler: Arc<TriggerScheduler>,
    /// 全局变量池（跨动作链共享）
    pub global_variables: GlobalVariables,
    /// 是否已完成初始化
    pub initialized: RwLock<bool>,
}

impl AppState {
    /// 创建并初始化应用状态
    ///
    /// 步骤：
    /// 1. 打开数据库并执行迁移
    /// 2. 启动时备份数据库
    /// 3. 创建执行器注册表（含所有内置执行器）
    /// 4. 创建全局变量池
    /// 5. 创建执行引擎
    /// 6. 创建触发器调度器
    /// 7. 注入执行回调到调度器
    /// 8. 启动调度器
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        tracing::info!("初始化应用状态");

        // 1. 打开数据库
        let db = Arc::new(Database::open_default()?);

        // 2. 执行迁移
        db.run_migrations()?;

        // 3. 启动时备份
        if let Err(e) = db.backup_on_startup() {
            tracing::warn!("启动备份失败（不影响运行）: {}", e);
        }

        // 4. 创建执行器注册表
        let registry = Arc::new(ActionExecutorRegistry::with_builtin_executors());

        // 5. 创建全局变量池
        let global_variables: GlobalVariables = Arc::new(RwLock::new(Default::default()));

        // 6. 创建执行引擎
        let chain_engine = Arc::new(ChainEngine::new(
            db.clone(),
            registry.clone(),
            app_handle.clone(),
            global_variables.clone(),
        ));

        // 7. 创建触发器调度器
        let scheduler = Arc::new(TriggerScheduler::new(db.clone(), app_handle.clone()));

        // 8. 注入执行回调
        let engine_for_callback = chain_engine.clone();
        scheduler.set_execute_callback(Arc::new(move |flow_id: String| {
            tracing::info!("触发器触发执行: flow_id={}", flow_id);
            engine_for_callback.execute_flow(&flow_id)?;
            Ok(())
        }));

        // 9. 启动调度器
        if let Err(e) = scheduler.start() {
            tracing::error!("触发器调度器启动失败: {}", e);
            // 不返回错误，允许应用继续运行（手动执行仍可用）
        }

        tracing::info!("应用状态初始化完成");

        Ok(Self {
            db,
            app_handle: app_handle.clone(),
            registry,
            chain_engine,
            scheduler,
            global_variables,
            initialized: RwLock::new(true),
        })
    }

    /// 重新加载触发器
    ///
    /// 当触发器或 Flow 启用状态变更时调用。
    pub fn reload_triggers(&self) -> Result<()> {
        self.scheduler.reload()
    }
}
