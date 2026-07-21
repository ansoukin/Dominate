//! 系统事件触发器
//!
//! 监听系统级事件：
//! - 进程启停：通过 sysinfo 轮询进程列表
//! - USB 插拔 / 网络变化 / 锁屏 / 登录：Phase 1 暂不主动监听，可通过 Tauri 事件手动触发
//!
//! Phase 1 重点实现：进程启停监控（轮询 sysinfo）

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use parking_lot::RwLock;
use sysinfo::{ProcessesToUpdate, System};
use tokio::task::JoinHandle;
use tokio::time::interval;

use crate::models::common::TriggerType;
use crate::models::trigger::{ProcessTriggerParams, UsbTriggerParams};

/// 事件触发的回调函数类型
///
/// 参数：触发器 ID + 关联 Flow ID
pub type EventCallback = Arc<dyn Fn(String, String) + Send + Sync>;

/// 系统事件监控配置
///
/// 描述一个系统事件触发器的匹配条件
#[derive(Debug, Clone)]
pub struct EventMatch {
    pub trigger_id: String,
    pub flow_id: String,
    pub trigger_type: TriggerType,
    pub process_name: Option<String>,
    pub device_name: Option<String>,
}

/// 系统事件监控器
///
/// 后台轮询系统状态，检测匹配的事件并触发回调。
pub struct SystemEventMonitor {
    /// 所有已注册的事件匹配规则
    matches: Arc<RwLock<Vec<EventMatch>>>,
    /// 后台轮询任务句柄
    poll_handle: RwLock<Option<JoinHandle<()>>>,
}

impl SystemEventMonitor {
    pub fn new() -> Self {
        Self {
            matches: Arc::new(RwLock::new(Vec::new())),
            poll_handle: RwLock::new(None),
        }
    }

    /// 添加事件匹配规则
    pub fn add_match(&self, m: EventMatch) {
        tracing::debug!("注册系统事件匹配: {:?} flow={}", m.trigger_type, m.flow_id);
        self.matches.write().push(m);
    }

    /// 清空所有事件匹配规则（重新加载时使用）
    pub fn clear(&self) {
        self.matches.write().clear();
    }

    /// 启动后台监控任务
    pub fn start(&self, callback: EventCallback) {
        let mut handle = self.poll_handle.write();
        if handle.is_some() {
            tracing::warn!("系统事件监控器已在运行");
            return;
        }

        let matches = self.matches.clone();
        let cb = callback.clone();

        let task = tokio::spawn(async move {
            tracing::info!("系统事件监控器已启动");

            let mut sys = System::new();
            sys.refresh_processes(ProcessesToUpdate::All, true);

            // 上一次的进程名集合（用于 diff）
            let mut prev_processes: HashSet<String> = sys
                .processes()
                .values()
                .map(|p| p.name().to_string_lossy().to_lowercase())
                .collect();

            let mut ticker = interval(Duration::from_secs(3));

            loop {
                ticker.tick().await;
                sys.refresh_processes(ProcessesToUpdate::All, true);

                let current: HashSet<String> = sys
                    .processes()
                    .values()
                    .map(|p| p.name().to_string_lossy().to_lowercase())
                    .collect();

                // 检测新启动的进程
                let started: Vec<_> = current.difference(&prev_processes).cloned().collect();
                // 检测已停止的进程
                let stopped: Vec<_> = prev_processes.difference(&current).cloned().collect();

                // 复制匹配规则到本地（避免长时间持锁）
                let rules: Vec<EventMatch> = matches.read().clone();

                for name in &started {
                    for rule in &rules {
                        if rule.trigger_type == TriggerType::ProcessStart
                            && matches_process(rule.process_name.as_deref(), name)
                        {
                            tracing::info!(
                                "进程启动触发: trigger={} flow={} process={}",
                                rule.trigger_id, rule.flow_id, name
                            );
                            cb(rule.trigger_id.clone(), rule.flow_id.clone());
                        }
                    }
                }

                for name in &stopped {
                    for rule in &rules {
                        if rule.trigger_type == TriggerType::ProcessStop
                            && matches_process(rule.process_name.as_deref(), name)
                        {
                            tracing::info!(
                                "进程停止触发: trigger={} flow={} process={}",
                                rule.trigger_id, rule.flow_id, name
                            );
                            cb(rule.trigger_id.clone(), rule.flow_id.clone());
                        }
                    }
                }

                prev_processes = current;
            }
        });

        *handle = Some(task);
    }

    /// 停止后台监控任务
    pub fn stop(&self) {
        let mut handle = self.poll_handle.write();
        if let Some(h) = handle.take() {
            h.abort();
            tracing::info!("系统事件监控器已停止");
        }
    }
}

impl Default for SystemEventMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for SystemEventMonitor {
    fn drop(&mut self) {
        self.stop();
    }
}

/// 判断进程名是否匹配规则
///
/// - 规则为 None：匹配任意进程
/// - 规则为 "notepad"：匹配 "notepad" 或 "notepad.exe"
/// - 规则为 "notepad.exe"：仅匹配 "notepad.exe"
fn matches_process(rule: Option<&str>, actual: &str) -> bool {
    let Some(rule) = rule else {
        return true; // 无规则匹配任意
    };
    let rule_lower = rule.to_lowercase();
    let actual_lower = actual.to_lowercase();

    actual_lower == rule_lower
        || actual_lower == format!("{}.exe", rule_lower)
        || actual_lower.replace(".exe", "") == rule_lower
}

/// 从 Trigger 参数构造 EventMatch
pub fn build_event_match(
    trigger_id: String,
    flow_id: String,
    trigger_type: TriggerType,
    params: &serde_json::Value,
) -> Option<EventMatch> {
    match trigger_type {
        TriggerType::ProcessStart | TriggerType::ProcessStop => {
            let p: ProcessTriggerParams = serde_json::from_value(params.clone()).ok()?;
            Some(EventMatch {
                trigger_id,
                flow_id,
                trigger_type,
                process_name: Some(p.process_name),
                device_name: None,
            })
        }
        TriggerType::UsbPlug | TriggerType::UsbUnplug => {
            let p: UsbTriggerParams = serde_json::from_value(params.clone()).ok()?;
            Some(EventMatch {
                trigger_id,
                flow_id,
                trigger_type,
                process_name: None,
                device_name: p.device_name,
            })
        }
        // 其他事件类型 Phase 1 不主动监听
        TriggerType::SystemBoot
        | TriggerType::SystemShutdown
        | TriggerType::UserLogin
        | TriggerType::UserLockScreen
        | TriggerType::NetworkChange => {
            tracing::debug!(
                "系统事件 {:?} Phase 1 不主动监听，需手动触发",
                trigger_type
            );
            None
        }
        // 时间类与手动类不在此处理
        TriggerType::Cron
        | TriggerType::CourseStart
        | TriggerType::Manual => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matches_process_none_rule() {
        assert!(matches_process(None, "anything.exe"));
    }

    #[test]
    fn test_matches_process_exact() {
        assert!(matches_process(Some("notepad.exe"), "notepad.exe"));
        assert!(matches_process(Some("notepad"), "notepad"));
    }

    #[test]
    fn test_matches_process_fuzzy() {
        assert!(matches_process(Some("notepad"), "notepad.exe"));
        assert!(matches_process(Some("notepad.exe"), "notepad.exe"));
        assert!(!matches_process(Some("notepad"), "calc.exe"));
    }

    #[test]
    fn test_matches_process_case_insensitive() {
        assert!(matches_process(Some("Notepad"), "NOTEPAD.exe"));
        assert!(matches_process(Some("NOTEPAD.EXE"), "notepad.exe"));
    }
}
