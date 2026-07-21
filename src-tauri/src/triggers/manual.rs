//! 手动触发器
//!
//! 提供通过代码主动触发快捷指令的能力。
//! 由 Tauri 命令（首页快捷按钮 / 托盘菜单）调用。

use std::sync::Arc;

use parking_lot::Mutex;

use crate::error::Result;

/// 手动触发器句柄
///
/// 通过 `trigger(flow_id)` 方法主动触发指定 Flow。
/// 内部持有回调函数，由 `TriggerScheduler` 注入。
pub struct ManualTriggerHandle {
    /// 触发回调：flow_id -> 是否成功加入执行队列
    trigger_fn: Arc<Mutex<Option<Arc<dyn Fn(&str) -> Result<()> + Send + Sync>>>>,
}

impl ManualTriggerHandle {
    pub fn new() -> Self {
        Self {
            trigger_fn: Arc::new(Mutex::new(None)),
        }
    }

    /// 由调度器注入触发回调
    pub(crate) fn set_callback(&self, callback: Arc<dyn Fn(&str) -> Result<()> + Send + Sync>) {
        *self.trigger_fn.lock() = Some(callback);
    }

    /// 触发指定 Flow
    ///
    /// 由 Tauri 命令调用，参数为 Flow ID。
    pub fn trigger(&self, flow_id: &str) -> Result<()> {
        let cb = self.trigger_fn.lock().clone();
        match cb {
            Some(f) => f(flow_id),
            None => Err(crate::error::AppError::Trigger(
                "调度器尚未初始化，无法触发".into(),
            )),
        }
    }
}

impl Default for ManualTriggerHandle {
    fn default() -> Self {
        Self::new()
    }
}
