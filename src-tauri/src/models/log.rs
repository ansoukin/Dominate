//! 执行日志模型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::common::ExecutionStatus;

/// 执行日志（ExecutionLog）
///
/// 记录每次动作执行的详细结果，用于历史查询与排错。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionLog {
    /// 唯一标识
    pub id: String,
    /// 所属快捷指令 ID
    pub flow_id: String,
    /// 关联动作 ID（None 表示整条指令的执行日志）
    pub action_id: Option<String>,
    /// 执行状态
    pub status: ExecutionStatus,
    /// 开始时间
    pub started_at: DateTime<Utc>,
    /// 结束时间（None 表示未结束/正在执行）
    pub finished_at: Option<DateTime<Utc>>,
    /// 耗时（毫秒，None 表示未结束）
    pub duration_ms: Option<u64>,
    /// 错误信息（失败时填）
    pub error: Option<String>,
    /// 执行上下文快照（变量值等，JSON）
    pub context: Option<String>,
}

impl ExecutionLog {
    /// 创建新日志（开始执行时调用）
    pub fn start(flow_id: impl Into<String>, action_id: Option<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            flow_id: flow_id.into(),
            action_id,
            status: ExecutionStatus::Running,
            started_at: Utc::now(),
            finished_at: None,
            duration_ms: None,
            error: None,
            context: None,
        }
    }

    /// 标记成功
    pub fn succeed(&mut self) {
        let now = Utc::now();
        self.finished_at = Some(now);
        self.duration_ms = Some((now - self.started_at).num_milliseconds() as u64);
        self.status = ExecutionStatus::Success;
    }

    /// 标记失败
    pub fn fail(&mut self, error: impl Into<String>) {
        let now = Utc::now();
        self.finished_at = Some(now);
        self.duration_ms = Some((now - self.started_at).num_milliseconds() as u64);
        self.status = ExecutionStatus::Failed;
        self.error = Some(error.into());
    }

    /// 标记跳过
    pub fn skip(&mut self, reason: impl Into<String>) {
        let now = Utc::now();
        self.finished_at = Some(now);
        self.duration_ms = Some((now - self.started_at).num_milliseconds() as u64);
        self.status = ExecutionStatus::Skipped;
        self.error = Some(reason.into());
    }
}

/// 日志查询筛选条件
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LogFilter {
    pub flow_id: Option<String>,
    pub status: Option<ExecutionStatus>,
    /// 限制返回条数（None 不限制，实际受全局默认 100 条限制）
    pub limit: Option<u32>,
    /// 偏移量（分页）
    pub offset: Option<u32>,
}
