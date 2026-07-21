//! 快捷指令模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::common::FaultStrategy;

/// 快捷指令（AutomationFlow）
///
/// 1 条快捷指令 = N 个触发器 + 1 个动作链
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationFlow {
    /// 唯一标识
    pub id: String,
    /// 显示名称
    pub name: String,
    /// 描述（可选）
    pub description: Option<String>,
    /// 图标标识（lucide 图标名）
    pub icon: Option<String>,
    /// 主题色（hex 字符串，如 "#FF5733"）
    pub color: Option<String>,
    /// 是否启用
    pub enabled: bool,
    /// 默认容错策略（动作可单独覆盖）
    #[serde(default)]
    pub default_fault_strategy: FaultStrategy,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl AutomationFlow {
    /// 创建新的快捷指令（生成新 ID）
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            description: None,
            icon: None,
            color: None,
            enabled: false,
            default_fault_strategy: FaultStrategy::default(),
            created_at: now,
            updated_at: now,
        }
    }
}

/// 创建快捷指令请求（前端 → 后端）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFlowRequest {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

/// 更新快捷指令请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFlowRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub enabled: Option<bool>,
    pub default_fault_strategy: Option<FaultStrategy>,
}
