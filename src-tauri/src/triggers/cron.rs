//! Cron 触发器
//!
//! 解析 5 字段 cron 表达式（分 时 日 月 周），自动补秒后使用 `cron` crate 计算下一次触发时间。
//!
//! 表达式示例：
//! - `30 17 * * *` — 每天 17:30
//! - `0 9 * * 1-5` — 周一至周五 09:00
//! - `*/15 * * * *` — 每 15 分钟

use chrono::{DateTime, Utc};
use cron::Schedule;
use std::str::FromStr;

use crate::error::{AppError, Result};
use crate::models::trigger::CronTriggerParams;

/// Cron 触发器实例
pub struct CronTrigger {
    schedule: Schedule,
    /// 触发器 ID（用于日志与状态追踪）
    pub trigger_id: String,
    /// 所属 Flow ID
    pub flow_id: String,
}

impl CronTrigger {
    /// 从 Trigger 参数构造 CronTrigger
    pub fn from_params(
        trigger_id: impl Into<String>,
        flow_id: impl Into<String>,
        params: &CronTriggerParams,
    ) -> Result<Self> {
        let schedule = parse_cron_expression(&params.expression)?;
        Ok(Self {
            schedule,
            trigger_id: trigger_id.into(),
            flow_id: flow_id.into(),
        })
    }

    /// 计算下一次触发时间（基于本地时区）
    pub fn next_fire_time(&self) -> Option<DateTime<Utc>> {
        // 注意：cron crate 的 upcoming 返回 UTC 时间
        self.schedule.upcoming(Utc).next()
    }

    /// 计算从现在起多久后触发（毫秒）
    pub fn next_delay_ms(&self) -> Option<u64> {
        let next = self.next_fire_time()?;
        let now = Utc::now();
        if next > now {
            Some((next - now).num_milliseconds() as u64)
        } else {
            None
        }
    }
}

/// 解析 cron 表达式
///
/// SPEC 规定 5 字段（分 时 日 月 周），cron crate 需要 6 字段（秒 分 时 日 月 周）。
/// 此函数在表达式前自动补 "0 "（秒字段）。
pub fn parse_cron_expression(expr: &str) -> Result<Schedule> {
    let expr = expr.trim();
    let field_count = expr.split_whitespace().count();

    let normalized = if field_count == 5 {
        format!("0 {}", expr) // 补秒字段
    } else if field_count == 6 {
        expr.to_string()
    } else {
        return Err(AppError::InvalidArgument(format!(
            "Cron 表达式字段数错误：期望 5（分 时 日 月 周）或 6（含秒），实际 {}",
            field_count
        )));
    };

    Schedule::from_str(&normalized).map_err(AppError::from)
}

/// 将 cron 表达式转换为人类可读的描述（用于前端展示）
pub fn describe_cron_expression(expr: &str) -> String {
    let expr = expr.trim();
    let parts: Vec<&str> = expr.split_whitespace().collect();
    if parts.len() != 5 {
        return format!("Cron: {}", expr);
    }

    let (minute, hour, day, month, weekday) = (parts[0], parts[1], parts[2], parts[3], parts[4]);

    // 几个常见模式的友好描述
    if minute == "*" && hour == "*" && day == "*" && month == "*" && weekday == "*" {
        return "每分钟".to_string();
    }
    if minute.starts_with("*/") && hour == "*" && day == "*" && month == "*" && weekday == "*" {
        let n = minute.trim_start_matches("*/");
        return format!("每 {} 分钟", n);
    }
    if hour.starts_with("*/") && minute == "0" && day == "*" && month == "*" && weekday == "*" {
        let n = hour.trim_start_matches("*/");
        return format!("每 {} 小时", n);
    }
    if weekday == "*" && day == "*" && month == "*" {
        // 特定时间每天触发
        if let (Ok(h), Ok(m)) = (hour.parse::<u32>(), minute.parse::<u32>()) {
            return format!("每天 {:02}:{:02}", h, m);
        }
    }
    if let Ok(w) = weekday.parse::<u32>() {
        if let (Ok(h), Ok(m)) = (hour.parse::<u32>(), minute.parse::<u32>()) {
            let day_name = match w {
                0 => "周日",
                1 => "周一",
                2 => "周二",
                3 => "周三",
                4 => "周四",
                5 => "周五",
                6 => "周六",
                _ => return format!("Cron: {}", expr),
            };
            return format!("{} {:02}:{:02}", day_name, h, m);
        }
    }

    format!("Cron: {}", expr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cron_5_fields() {
        // 5 字段应该被自动补全
        let schedule = parse_cron_expression("30 17 * * *").unwrap();
        // 计算下一次触发时间应该成功
        let next = schedule.upcoming(Utc).next();
        assert!(next.is_some());
    }

    #[test]
    fn test_parse_cron_6_fields() {
        // 6 字段直接解析
        let schedule = parse_cron_expression("0 30 17 * * *").unwrap();
        let next = schedule.upcoming(Utc).next();
        assert!(next.is_some());
    }

    #[test]
    fn test_parse_cron_invalid_fields() {
        // 错误字段数
        assert!(parse_cron_expression("30 17 *").is_err());
        assert!(parse_cron_expression("30 17 * * * * *").is_err());
    }

    #[test]
    fn test_describe_cron() {
        assert_eq!(describe_cron_expression("* * * * *"), "每分钟");
        assert_eq!(describe_cron_expression("*/15 * * * *"), "每 15 分钟");
        assert_eq!(describe_cron_expression("30 17 * * *"), "每天 17:30");
        assert_eq!(describe_cron_expression("0 9 * * 1-5"), "Cron: 0 9 * * 1-5"); // 范围暂未优化
        assert_eq!(describe_cron_expression("0 9 * * 1"), "周一 09:00");
    }

    #[test]
    fn test_next_fire_time() {
        let params = CronTriggerParams {
            expression: "30 17 * * *".to_string(),
            timezone: None,
        };
        let trigger = CronTrigger::from_params("t1", "f1", &params).unwrap();
        let next = trigger.next_fire_time();
        assert!(next.is_some());

        // 下一次触发时间应在未来
        let now = Utc::now();
        assert!(next.unwrap() > now);
    }
}
