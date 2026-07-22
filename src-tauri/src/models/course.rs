//! 课程与临时调课模型
//!
//! 课程条目是课表的基本单元，支持两种定位方式：
//! - 格点模式：通过 period_index 关联节次定义
//! - 自由模式：直接使用 start_time / end_time（任意时间）
//!
//! 临时调课记录某一天的临时调整，不修改常规课表。

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 课程条目（Course）
///
/// 课表的一格课程。格点模式用 period_index 定位，自由模式用 start/end_time 定位。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Course {
    /// 唯一标识
    pub id: String,
    /// 所属学期 ID
    pub semester_id: String,
    /// 科目名（如 "数学"）
    pub subject_name: String,
    /// 星期几（0=周日, 1=周一 ... 6=周六）
    pub day_of_week: i32,
    /// 格点模式：第几节（自由模式为 None）
    pub period_index: Option<i32>,
    /// 自由模式开始时间 "14:30"（格点模式为 None）
    pub start_time: Option<String>,
    /// 自由模式结束时间（格点模式为 None）
    pub end_time: Option<String>,
    /// 周次模式: "all"/"odd"/"even"/"1,3,5,7"
    pub week_pattern: String,
    /// 教室地点
    pub location: Option<String>,
    /// 教师
    pub teacher: Option<String>,
    /// 颜色标识（hex）
    pub color: Option<String>,
    /// 关联快捷指令 ID（课前/课中/课后触发，可空）
    pub flow_id: Option<String>,
    /// 备注
    pub note: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
    /// 更新时间
    pub updated_at: DateTime<Utc>,
}

impl Course {
    /// 创建新课程条目（默认每周都上）
    pub fn new(
        semester_id: impl Into<String>,
        subject_name: impl Into<String>,
        day_of_week: i32,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            semester_id: semester_id.into(),
            subject_name: subject_name.into(),
            day_of_week,
            period_index: None,
            start_time: None,
            end_time: None,
            week_pattern: "all".to_string(),
            location: None,
            teacher: None,
            color: None,
            flow_id: None,
            note: None,
            created_at: now,
            updated_at: now,
        }
    }
}

/// 创建课程请求（前端 → 后端）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCourseRequest {
    pub semester_id: String,
    pub subject_name: String,
    pub day_of_week: i32,
    pub period_index: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub week_pattern: Option<String>,
    pub location: Option<String>,
    pub teacher: Option<String>,
    pub color: Option<String>,
    pub flow_id: Option<String>,
    pub note: Option<String>,
}

/// 更新课程请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCourseRequest {
    pub subject_name: Option<String>,
    pub day_of_week: Option<i32>,
    pub period_index: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub week_pattern: Option<String>,
    pub location: Option<String>,
    pub teacher: Option<String>,
    pub color: Option<String>,
    pub flow_id: Option<String>,
    pub note: Option<String>,
}

/// 临时调课类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OverrideType {
    /// 取消该课程
    Cancel,
    /// 调整时间/节次
    Move,
    /// 新增临时课程
    Add,
}

impl OverrideType {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Cancel => "取消",
            Self::Move => "调整",
            Self::Add => "新增",
        }
    }

    /// 序列化为数据库存储字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cancel => "cancel",
            Self::Move => "move",
            Self::Add => "add",
        }
    }

    /// 从数据库字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "cancel" => Some(Self::Cancel),
            "move" => Some(Self::Move),
            "add" => Some(Self::Add),
            _ => None,
        }
    }
}

/// 临时调课记录（ScheduleOverride）
///
/// 某一天的临时调整，不修改常规课表。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleOverride {
    /// 唯一标识
    pub id: String,
    /// 所属学期 ID
    pub semester_id: String,
    /// 生效日期（ISO "2026-07-22"）
    pub date: String,
    /// 原课程 ID（None 表示新增临时课程）
    pub course_id: Option<String>,
    /// 调课类型
    pub override_type: OverrideType,
    /// 调整后的星期（Move 时）
    pub new_day_of_week: Option<i32>,
    /// 调整后节次（Move 时）
    pub new_period_index: Option<i32>,
    /// 调整后开始时间（自由模式 Move 时）
    pub new_start_time: Option<String>,
    /// 调整后结束时间（自由模式 Move 时）
    pub new_end_time: Option<String>,
    /// 备注
    pub note: Option<String>,
    /// 创建时间
    pub created_at: DateTime<Utc>,
}

impl ScheduleOverride {
    /// 创建新调课记录
    pub fn new(
        semester_id: impl Into<String>,
        date: impl Into<String>,
        override_type: OverrideType,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            semester_id: semester_id.into(),
            date: date.into(),
            course_id: None,
            override_type,
            new_day_of_week: None,
            new_period_index: None,
            new_start_time: None,
            new_end_time: None,
            note: None,
            created_at: Utc::now(),
        }
    }
}

/// 创建临时调课请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOverrideRequest {
    pub semester_id: String,
    pub date: String,
    pub course_id: Option<String>,
    pub override_type: OverrideType,
    pub new_day_of_week: Option<i32>,
    pub new_period_index: Option<i32>,
    pub new_start_time: Option<String>,
    pub new_end_time: Option<String>,
    pub note: Option<String>,
}
