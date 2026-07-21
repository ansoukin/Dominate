//! 媒体与输入类动作执行器
//!
//! 包含：调节音量 / 播放声音 / 模拟按键

use serde_json::Value;
use std::time::Duration;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::{PlaySoundParams, SetVolumeParams, SimulateKeyParams};
use crate::models::common::ActionType;

/// 调节音量执行器
///
/// 基于 Windows Core Audio API (winmm) 调节主音量。
pub struct SetVolumeExecutor;

impl ActionExecutor for SetVolumeExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SetVolume
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SetVolumeParams = serde_json::from_value(params.clone())?;

        #[cfg(windows)]
        {
            use windows_sys::Win32::Media::Audio::{
                waveOutGetVolume, waveOutSetVolume, WAVE_MAPPER,
            };

            tracing::info!("调节音量: volume={:?} mute={}", p.volume, p.mute);

            if p.mute {
                // 静音：将音量设为 0
                unsafe {
                    waveOutSetVolume(WAVE_MAPPER as _, 0);
                }
                Ok(ActionResult::success("已静音"))
            } else if let Some(volume) = p.volume {
                let volume = volume.min(100);
                // waveOutSetVolume 接收 16 位立体声音量（左右声道）
                // 将 0-100 映射到 0x0000-0xFFFF
                let v = ((volume as u32) * 0xFFFF / 100) & 0xFFFF;
                let stereo = v | (v << 16); // 左右声道相同
                unsafe {
                    waveOutSetVolume(WAVE_MAPPER as _, stereo);
                }
                Ok(ActionResult::success(format!("音量已设置为 {}", volume)))
            } else {
                // 既没有 volume 也没有 mute，查询当前音量
                let mut current: u32 = 0;
                unsafe {
                    waveOutGetVolume(WAVE_MAPPER as _, &mut current);
                }
                let left = current & 0xFFFF;
                let vol = left * 100 / 0xFFFF;
                Ok(ActionResult::success_with_output(
                    format!("当前音量: {}", vol),
                    serde_json::json!({ "volume": vol }),
                ))
            }
        }

        #[cfg(not(windows))]
        {
            Err(AppError::ActionExecution(
                "调节音量仅在 Windows 上支持".into(),
            ))
        }
    }
}

/// 播放声音执行器
///
/// 简单实现：使用 std::process::Command 调用系统播放器。
/// 复杂场景（循环、音量控制）可后续扩展为 rodio 库。
pub struct PlaySoundExecutor;

impl ActionExecutor for PlaySoundExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::PlaySound
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: PlaySoundParams = serde_json::from_value(params.clone())?;
        let source = ctx.interpolate(&p.source);

        tracing::info!("播放声音: {} loop={}", source, p.r#loop);

        #[cfg(windows)]
        {
            // 系统声音（如 "SystemNotification"）使用 PlaySoundW
            // 文件路径使用默认程序打开
            if !std::path::Path::new(&source).exists() {
                // 视为系统声音名
                use windows_sys::Win32::Media::Audio::{SND_ALIAS, SND_ASYNC, PlaySoundW};
                let wide: Vec<u16> = source.encode_utf16().chain(std::iter::once(0)).collect();
                unsafe {
                    PlaySoundW(wide.as_ptr(), std::ptr::null_mut(), SND_ALIAS | SND_ASYNC);
                }
                return Ok(ActionResult::success(format!(
                    "已播放系统声音: {}",
                    source
                )));
            }

            // 文件播放：异步打开默认媒体播放器
            open::that(&source).map_err(|e| {
                AppError::ActionExecution(format!("播放声音失败 {}: {}", source, e))
            })?;

            if p.r#loop {
                tracing::warn!("循环播放暂未实现，仅播放一次");
            }

            Ok(ActionResult::success(format!("已播放声音: {}", source)))
        }

        #[cfg(not(windows))]
        {
            let _ = ctx;
            let _ = p;
            Err(AppError::ActionExecution(
                "播放声音仅在 Windows 上支持".into(),
            ))
        }
    }
}

/// 模拟按键执行器
///
/// 基于 Windows SendInput API 模拟键盘输入。
pub struct SimulateKeyExecutor;

impl ActionExecutor for SimulateKeyExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SimulateKey
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SimulateKeyParams = serde_json::from_value(params.clone())?;
        let keys = ctx.interpolate(&p.keys);

        tracing::info!("模拟按键: {} repeat={}", keys, p.repeat);

        #[cfg(windows)]
        {
            // 解析按键序列，支持 "Ctrl+C" / "Alt+F4" / "Win+D" 等
            let vk_codes = parse_key_sequence(&keys)?;

            for _ in 0..p.repeat.max(1) {
                // 按下所有键（修饰键 + 主键）
                for &vk in &vk_codes {
                    send_key(vk, false);
                    std::thread::sleep(Duration::from_millis(10));
                }
                // 释放所有键（逆序）
                for &vk in vk_codes.iter().rev() {
                    send_key(vk, true);
                    std::thread::sleep(Duration::from_millis(10));
                }
            }

            Ok(ActionResult::success(format!("已模拟按键: {}", keys)))
        }

        #[cfg(not(windows))]
        {
            let _ = ctx;
            Err(AppError::ActionExecution(
                "模拟按键仅在 Windows 上支持".into(),
            ))
        }
    }
}

#[cfg(windows)]
fn parse_key_sequence(seq: &str) -> Result<Vec<u32>> {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

    let mut result = Vec::new();
    for part in seq.split('+') {
        let part = part.trim();
        let vk: u32 = match part.to_lowercase().as_str() {
            "ctrl" | "control" => VK_CONTROL as u32,
            "alt" | "menu" => VK_MENU as u32,
            "shift" => VK_SHIFT as u32,
            "win" | "super" | "meta" => VK_LWIN as u32,
            "enter" | "return" => VK_RETURN as u32,
            "esc" | "escape" => VK_ESCAPE as u32,
            "tab" => VK_TAB as u32,
            "space" => VK_SPACE as u32,
            "backspace" => VK_BACK as u32,
            "delete" | "del" => VK_DELETE as u32,
            "insert" => VK_INSERT as u32,
            "home" => VK_HOME as u32,
            "end" => VK_END as u32,
            "pageup" | "pgup" => VK_PRIOR as u32,
            "pagedown" | "pgdn" => VK_NEXT as u32,
            "up" => VK_UP as u32,
            "down" => VK_DOWN as u32,
            "left" => VK_LEFT as u32,
            "right" => VK_RIGHT as u32,
            "f1" => VK_F1 as u32, "f2" => VK_F2 as u32, "f3" => VK_F3 as u32, "f4" => VK_F4 as u32,
            "f5" => VK_F5 as u32, "f6" => VK_F6 as u32, "f7" => VK_F7 as u32, "f8" => VK_F8 as u32,
            "f9" => VK_F9 as u32, "f10" => VK_F10 as u32, "f11" => VK_F11 as u32, "f12" => VK_F12 as u32,
            single if single.len() == 1 => {
                let c = single.chars().next().unwrap();
                c.to_ascii_uppercase() as u32
            }
            _ => {
                return Err(AppError::InvalidArgument(format!(
                    "无法识别的按键: {}",
                    part
                )))
            }
        };
        result.push(vk);
    }
    Ok(result)
}

#[cfg(windows)]
fn send_key(vk: u32, up: bool) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT,
    };

    let flags = if up {
        windows_sys::Win32::UI::Input::KeyboardAndMouse::KEYEVENTF_KEYUP
    } else {
        0
    };

    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows_sys::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk as u16,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    unsafe {
        SendInput(1, &input, std::mem::size_of::<INPUT>() as i32);
    }
}
