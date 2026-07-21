//! 系统与电源类动作执行器
//!
//! 包含：关机 / 重启 / 锁屏 / 休眠 / 注销 / 清理临时文件 / 切换电源计划

use serde_json::Value;
use std::process::Command;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::{CleanTempFilesParams, PowerActionParams, SwitchPowerPlanParams};
use crate::models::common::ActionType;

/// 关机执行器
pub struct ShutdownExecutor;

impl ActionExecutor for ShutdownExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::Shutdown
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: PowerActionParams = serde_json::from_value(params.clone())?;
        tracing::warn!("执行关机: delay={}s force={}", p.delay_secs, p.force);

        let mut args = vec!["/s".to_string()]; // shutdown
        args.push("/t".to_string());
        args.push(p.delay_secs.to_string());
        if p.force {
            args.push("/f".to_string());
        }
        if let Some(msg) = &p.message {
            args.push("/c".to_string());
            args.push(msg.clone());
        }

        Command::new("shutdown")
            .args(&args)
            .spawn()
            .map_err(|e| AppError::ActionExecution(format!("关机失败: {}", e)))?;

        Ok(ActionResult::success(format!(
            "已发起关机请求，{} 秒后执行",
            p.delay_secs
        )))
    }
}

/// 重启执行器
pub struct RebootExecutor;

impl ActionExecutor for RebootExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::Reboot
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: PowerActionParams = serde_json::from_value(params.clone())?;
        tracing::warn!("执行重启: delay={}s force={}", p.delay_secs, p.force);

        let mut args = vec!["/r".to_string()]; // reboot
        args.push("/t".to_string());
        args.push(p.delay_secs.to_string());
        if p.force {
            args.push("/f".to_string());
        }

        Command::new("shutdown")
            .args(&args)
            .spawn()
            .map_err(|e| AppError::ActionExecution(format!("重启失败: {}", e)))?;

        Ok(ActionResult::success(format!(
            "已发起重启请求，{} 秒后执行",
            p.delay_secs
        )))
    }
}

/// 锁屏执行器
pub struct LockScreenExecutor;

impl ActionExecutor for LockScreenExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::LockScreen
    }

    fn execute(&self, _params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        tracing::info!("执行锁屏");

        #[cfg(windows)]
        {
            // 使用 windows-sys 动态加载 user32.dll!LockWorkStation
            // （不同 windows/windows-sys 版本中 LockWorkStation 的模块路径不同，动态调用最稳定）
            use windows_sys::Win32::System::LibraryLoader::{GetModuleHandleA, GetProcAddress};

            // windows-sys 的 PCSTR 是 *const u8，使用字节字面量
            let user32 = b"user32.dll\0";
            let lock_work_station_name = b"LockWorkStation\0";
            unsafe {
                let h_module = GetModuleHandleA(user32.as_ptr());
                if h_module.is_null() {
                    return Err(AppError::Windows("加载 user32.dll 失败".into()));
                }
                let addr = GetProcAddress(h_module, lock_work_station_name.as_ptr());
                if let Some(_addr) = addr {
                    let lock_work_station: extern "system" fn() -> i32 =
                        std::mem::transmute(addr);
                    lock_work_station();
                    Ok(ActionResult::success("已锁屏"))
                } else {
                    Err(AppError::Windows(
                        "获取 LockWorkStation 函数地址失败".into(),
                    ))
                }
            }
        }

        #[cfg(not(windows))]
        Err(AppError::ActionExecution("锁屏仅在 Windows 上支持".into()))
    }
}

/// 休眠执行器
pub struct HibernateExecutor;

impl ActionExecutor for HibernateExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::Hibernate
    }

    fn execute(&self, _params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        tracing::info!("执行休眠");

        // Windows 没有直接的休眠 API，使用 shutdown /h
        Command::new("shutdown")
            .arg("/h")
            .spawn()
            .map_err(|e| AppError::ActionExecution(format!("休眠失败: {}", e)))?;

        Ok(ActionResult::success("已发起休眠请求"))
    }
}

/// 注销执行器
pub struct LogoffExecutor;

impl ActionExecutor for LogoffExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::Logoff
    }

    fn execute(&self, _params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        tracing::info!("执行注销");

        Command::new("shutdown")
            .args(["/l", "/f"])
            .spawn()
            .map_err(|e| AppError::ActionExecution(format!("注销失败: {}", e)))?;

        Ok(ActionResult::success("已发起注销请求"))
    }
}

/// 清理临时文件执行器
pub struct CleanTempFilesExecutor;

impl ActionExecutor for CleanTempFilesExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::CleanTempFiles
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: CleanTempFilesParams = serde_json::from_value(params.clone())?;

        tracing::info!(
            "清理临时文件: pattern={} recursive={} min_age={}min",
            p.pattern,
            p.recursive,
            p.min_age_minutes
        );

        // 默认清理 TEMP 与系统 Temp 目录
        let dirs: Vec<std::path::PathBuf> = if let Some(dirs) = &p.dirs {
            dirs.iter().map(std::path::PathBuf::from).collect()
        } else {
            let mut d = vec![];
            if let Ok(temp) = std::env::var("TEMP") {
                d.push(std::path::PathBuf::from(temp));
            }
            if let Ok(tmp) = std::env::var("TMP") {
                let p = std::path::PathBuf::from(tmp);
                if !d.contains(&p) {
                    d.push(p);
                }
            }
            d
        };

        let now = std::time::SystemTime::now();
        let min_age = std::time::Duration::from_secs((p.min_age_minutes as u64) * 60);
        let mut deleted_count = 0u64;
        let mut failed_count = 0u64;

        for dir in &dirs {
            if !dir.exists() {
                continue;
            }
            clean_dir(dir, &p.pattern, p.recursive, now, min_age, &mut deleted_count, &mut failed_count);
        }

        let msg = format!(
            "清理完成：删除 {} 项，失败 {} 项",
            deleted_count, failed_count
        );
        if deleted_count > 0 {
            Ok(ActionResult::success(msg))
        } else {
            Ok(ActionResult::success(format!("{}（无可清理项）", msg)))
        }
    }
}

fn clean_dir(
    dir: &std::path::Path,
    pattern: &str,
    recursive: bool,
    now: std::time::SystemTime,
    min_age: std::time::Duration,
    deleted: &mut u64,
    failed: &mut u64,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            tracing::warn!("读取目录失败 {}: {}", dir.display(), e);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        // 检查修改时间是否满足最小年龄
        if let Ok(modified) = metadata.modified() {
            if let Ok(age) = now.duration_since(modified) {
                if age < min_age {
                    continue;
                }
            }
        }

        // 简单通配符匹配（仅支持 * 和 ?）
        let name = entry.file_name().to_string_lossy().to_string();
        if !match_pattern(&name, pattern) {
            continue;
        }

        if metadata.is_dir() {
            if recursive {
                clean_dir(&path, pattern, recursive, now, min_age, deleted, failed);
                // 递归后尝试删除空目录
                if std::fs::remove_dir(&path).is_ok() {
                    *deleted += 1;
                } else {
                    *failed += 1;
                }
            }
        } else if metadata.is_file() {
            if std::fs::remove_file(&path).is_ok() {
                *deleted += 1;
            } else {
                *failed += 1;
            }
        }
    }
}

fn match_pattern(name: &str, pattern: &str) -> bool {
    // 极简通配符匹配：仅支持 * 匹配任意长度
    if pattern == "*.*" || pattern == "*" {
        return true;
    }
    if pattern.starts_with("*.") {
        let ext = &pattern[1..]; // 包含点
        return name.to_lowercase().ends_with(&ext.to_lowercase());
    }
    name == pattern
}

/// 切换电源计划执行器
pub struct SwitchPowerPlanExecutor;

impl ActionExecutor for SwitchPowerPlanExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SwitchPowerPlan
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SwitchPowerPlanParams = serde_json::from_value(params.clone())?;
        tracing::info!("切换电源计划: {}", p.plan_guid);

        // 使用 powercfg 设置活动电源计划
        Command::new("powercfg")
            .args(["/setactive", &p.plan_guid])
            .status()
            .map_err(|e| AppError::ActionExecution(format!("切换电源计划失败: {}", e)))?
            .success()
            .then_some(())
            .ok_or_else(|| AppError::ActionExecution("powercfg 返回非零状态".into()))?;

        Ok(ActionResult::success(format!(
            "已切换电源计划: {}",
            p.plan_guid
        )))
    }
}
