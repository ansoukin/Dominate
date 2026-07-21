//! 控制流类动作执行器
//!
//! 包含：条件分支 / 循环 / 变量赋值
//!
//! 设计原则：**决策与调度分离**
//! - 执行器仅做"原子决策"（评估条件 / 设置变量），不直接执行子动作
//! - 子动作遍历由 `executor::chain::ChainEngine` 根据 `parent_id` 关系统一调度
//! - 控制流节点通过 `ActionResult.output` 返回决策信息供 chain 引擎读取

use serde_json::Value;

use crate::actions::{ActionExecutor, ActionResult, ExecutionContext};
use crate::error::{AppError, Result};
use crate::models::action::{IfElseParams, LoopParams, SetVariableParams};
use crate::models::common::ActionType;

/// 条件分支执行器
///
/// 评估条件表达式，返回 `condition_met` 布尔值。
/// chain 引擎根据结果决定执行 `then` 分支（params.branch == "then"）或 `else` 分支。
///
/// 支持的条件格式：
/// - 数值比较：`{var} > 50`、`{var} <= 100`
/// - 相等性：`{var} == "text"`、`{var} != 0`
/// - 布尔值：`{var} == true`
/// - 包含关系：`{var} contains "sub"` / `{var} startswith "pre"` / `{var} endswith "suf"`
pub struct IfElseExecutor;

impl ActionExecutor for IfElseExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::IfElse
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: IfElseParams = serde_json::from_value(params.clone())?;
        // 先对条件中的变量占位符做插值
        let interpolated = ctx.interpolate(&p.condition);
        let met = evaluate_condition(&interpolated)?;

        tracing::debug!("条件评估: {:?} -> {} = {}", p.condition, interpolated, met);

        Ok(ActionResult::success_with_output(
            format!("条件评估: {} = {}", p.condition, met),
            serde_json::json!({ "condition_met": met }),
        ))
    }
}

/// 循环执行器
///
/// 仅返回循环配置信息（次数/循环变量名）。
/// chain 引擎识别到 Loop 节点后，会循环执行其子节点（parent_id = Loop.id）。
/// 子节点可通过 `SetVariable` 配合 `break_requested`/`continue_requested` 实现跳出/跳过。
pub struct LoopExecutor;

impl ActionExecutor for LoopExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::Loop
    }

    fn execute(&self, params: &Value, _ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: LoopParams = serde_json::from_value(params.clone())?;
        tracing::debug!("循环配置: count={:?} var={:?}", p.count, p.var_name);

        Ok(ActionResult::success_with_output(
            format!("循环配置已就绪: count={:?}", p.count),
            serde_json::json!({
                "loop_count": p.count,
                "loop_var": p.var_name,
            }),
        ))
    }
}

/// 变量赋值执行器
///
/// 在当前执行上下文中设置变量（局部或全局）。
/// 值支持模板插值，可引用其他变量。
pub struct SetVariableExecutor;

impl ActionExecutor for SetVariableExecutor {
    fn action_type(&self) -> ActionType {
        ActionType::SetVariable
    }

    fn execute(&self, params: &Value, ctx: &mut ExecutionContext) -> Result<ActionResult> {
        let p: SetVariableParams = serde_json::from_value(params.clone())?;
        let interpolated = ctx.interpolate(&p.value);

        // 尝试将值转换为合适的 JSON 类型
        let value = parse_value(&interpolated);

        tracing::debug!(
            "设置变量: {} = {} (global={})",
            p.name,
            value,
            p.global
        );

        ctx.set_var(&p.name, value.clone(), p.global);

        Ok(ActionResult::success_with_output(
            format!("变量 {} 已赋值", p.name),
            serde_json::json!({ "name": p.name, "value": value, "global": p.global }),
        ))
    }
}

/// 评估条件表达式
///
/// 支持的格式：
/// - `左 操作符 右`：比较运算（>、<、>=、<=、==、!=）
/// - `左 contains 右`：字符串包含
/// - `左 startswith 右`：字符串前缀
/// - `左 endswith 右`：字符串后缀
/// - `true` / `false`：字面布尔值
fn evaluate_condition(expr: &str) -> Result<bool> {
    let expr = expr.trim();

    // 字面布尔值
    if expr.eq_ignore_ascii_case("true") {
        return Ok(true);
    }
    if expr.eq_ignore_ascii_case("false") {
        return Ok(false);
    }

    // 按优先级匹配操作符（先长后短，避免 < 被 <= 截断）
    let operators = ["contains", "startswith", "endswith", ">=", "<=", "==", "!=", ">", "<"];
    for op in operators {
        if let Some(idx) = find_operator(expr, op) {
            let lhs = expr[..idx].trim();
            let rhs = expr[idx + op.len()..].trim();
            return apply_operator(lhs, op, rhs);
        }
    }

    // 没有匹配的操作符：非空字符串视为 true
    Ok(!expr.is_empty() && !expr.eq_ignore_ascii_case("null"))
}

/// 在表达式中查找操作符位置（避免子串误匹配，如 "contains" 中的 "in"）
fn find_operator(expr: &str, op: &str) -> Option<usize> {
    // 简单实现：直接 find。对于多字符操作符（>=、<=、==、!=、contains 等）足够。
    // 单字符操作符（>、<）需排除已匹配到 >=、<= 的情况。
    if let Some(idx) = expr.find(op) {
        // 单字符操作符需要检查前后字符避免误匹配
        if op == ">" || op == "<" {
            let bytes = expr.as_bytes();
            // 检查操作符后是否为 = 或 >
            if idx + 1 < bytes.len() && (bytes[idx + 1] == b'=' || bytes[idx + 1] == b'>') {
                return None;
            }
            // 检查操作符前是否为 ! < > =（这些应被其他分支匹配）
            if idx > 0 {
                let prev = bytes[idx - 1];
                if prev == b'!' || prev == b'<' || prev == b'>' || prev == b'=' {
                    return None;
                }
            }
        }
        Some(idx)
    } else {
        None
    }
}

/// 应用操作符比较两个操作数
fn apply_operator(lhs: &str, op: &str, rhs: &str) -> Result<bool> {
    // 去除字符串字面量的引号
    let lhs = strip_quotes(lhs);
    let rhs = strip_quotes(rhs);

    match op {
        "==" => Ok(compare_values(lhs, rhs)),
        "!=" => Ok(!compare_values(lhs, rhs)),
        ">" | "<" | ">=" | "<=" => {
            // 数值比较
            let l: f64 = lhs.parse().map_err(|_| {
                AppError::InvalidArgument(format!("无法将 {} 解析为数值", lhs))
            })?;
            let r: f64 = rhs.parse().map_err(|_| {
                AppError::InvalidArgument(format!("无法将 {} 解析为数值", rhs))
            })?;
            let result = match op {
                ">" => l > r,
                "<" => l < r,
                ">=" => l >= r,
                "<=" => l <= r,
                _ => unreachable!(),
            };
            Ok(result)
        }
        "contains" => Ok(lhs.contains(rhs)),
        "startswith" => Ok(lhs.starts_with(rhs)),
        "endswith" => Ok(lhs.ends_with(rhs)),
        _ => Err(AppError::InvalidArgument(format!("不支持的操作符: {}", op))),
    }
}

/// 比较两个值是否相等（先尝试数值比较，再回退字符串比较）
fn compare_values(lhs: &str, rhs: &str) -> bool {
    // 尝试数值比较
    if let (Ok(l), Ok(r)) = (lhs.parse::<f64>(), rhs.parse::<f64>()) {
        return (l - r).abs() < f64::EPSILON;
    }
    // 尝试布尔比较
    if lhs.eq_ignore_ascii_case("true") && rhs.eq_ignore_ascii_case("true") {
        return true;
    }
    if lhs.eq_ignore_ascii_case("false") && rhs.eq_ignore_ascii_case("false") {
        return true;
    }
    // 字符串比较
    lhs == rhs
}

/// 去除字符串两端的引号（单引号或双引号）
fn strip_quotes(s: &str) -> &str {
    let s = s.trim();
    if s.len() >= 2 {
        let bytes = s.as_bytes();
        if (bytes[0] == b'"' && bytes[bytes.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[bytes.len() - 1] == b'\'')
        {
            return &s[1..s.len() - 1];
        }
    }
    s
}

/// 将字符串解析为合适的 JSON 值
///
/// 优先尝试：null → bool → 数值 → 字符串
fn parse_value(s: &str) -> Value {
    let trimmed = s.trim();
    if trimmed.eq_ignore_ascii_case("null") {
        return Value::Null;
    }
    if trimmed.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if trimmed.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    // 尝试整数
    if let Ok(i) = trimmed.parse::<i64>() {
        return Value::Number(i.into());
    }
    // 尝试浮点
    if let Ok(f) = trimmed.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return Value::Number(n);
        }
    }
    // 去引号的字符串
    Value::String(strip_quotes(trimmed).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evaluate_condition_numeric() {
        assert!(evaluate_condition("50 > 10").unwrap());
        assert!(!evaluate_condition("10 > 50").unwrap());
        assert!(evaluate_condition("50 >= 50").unwrap());
        assert!(evaluate_condition("50 <= 50").unwrap());
        assert!(evaluate_condition("50 == 50").unwrap());
        assert!(evaluate_condition("50 != 10").unwrap());
    }

    #[test]
    fn test_evaluate_condition_string() {
        assert!(evaluate_condition("\"hello\" contains \"ell\"").unwrap());
        assert!(evaluate_condition("\"hello\" startswith \"he\"").unwrap());
        assert!(evaluate_condition("\"hello\" endswith \"lo\"").unwrap());
        assert!(evaluate_condition("\"abc\" == \"abc\"").unwrap());
    }

    #[test]
    fn test_evaluate_condition_literal() {
        assert!(evaluate_condition("true").unwrap());
        assert!(!evaluate_condition("false").unwrap());
    }

    #[test]
    fn test_parse_value() {
        assert_eq!(parse_value("null"), Value::Null);
        assert_eq!(parse_value("true"), Value::Bool(true));
        assert_eq!(parse_value("42"), Value::Number(42i64.into()));
        assert_eq!(parse_value("3.14"), Value::Number(serde_json::Number::from_f64(3.14).unwrap()));
        assert_eq!(parse_value("hello"), Value::String("hello".to_string()));
        assert_eq!(parse_value("\"quoted\""), Value::String("quoted".to_string()));
    }
}
