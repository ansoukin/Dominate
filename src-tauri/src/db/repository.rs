//! 数据库仓库层
//!
//! 封装所有实体的 CRUD 操作，提供类型安全的接口。

use chrono::{DateTime, Utc};
use rusqlite::{params, OptionalExtension};
use serde_json::Value;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    common::{ActionType, ExecutionStatus, TriggerType},
    Action, AutomationFlow, CreateFlowRequest, ExecutionLog, LogFilter, Setting, Trigger,
    UpdateFlowRequest,
};

/// 仓库：提供所有实体的 CRUD 操作
pub struct Repository<'a> {
    db: &'a Database,
}

impl<'a> Repository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    // ============ 快捷指令 CRUD ============

    /// 列出所有快捷指令
    pub fn list_flows(&self) -> Result<Vec<AutomationFlow>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at
                 FROM automation_flows
                 ORDER BY created_at ASC",
            )?;
            let flows = stmt
                .query_map([], row_to_flow)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(flows)
        })
    }

    /// 获取单个快捷指令
    pub fn get_flow(&self, id: &str) -> Result<Option<AutomationFlow>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at
                 FROM automation_flows
                 WHERE id = ?1",
            )?;
            let flow = stmt
                .query_row(params![id], row_to_flow)
                .optional()?;
            Ok(flow)
        })
    }

    /// 创建快捷指令
    pub fn create_flow(&self, req: CreateFlowRequest) -> Result<AutomationFlow> {
        let flow = {
            let mut f = AutomationFlow::new(req.name);
            f.description = req.description;
            f.icon = req.icon;
            f.color = req.color;
            f
        };

        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO automation_flows
                 (id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    flow.id,
                    flow.name,
                    flow.description,
                    flow.icon,
                    flow.color,
                    flow.enabled as i32,
                    serde_json::to_string(&flow.default_fault_strategy)?,
                    flow.created_at.to_rfc3339(),
                    flow.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(flow)
    }

    /// 更新快捷指令
    pub fn update_flow(&self, id: &str, req: UpdateFlowRequest) -> Result<AutomationFlow> {
        let mut flow = self
            .get_flow(id)?
            .ok_or_else(|| AppError::NotFound(format!("快捷指令 {} 不存在", id)))?;

        if let Some(name) = req.name {
            flow.name = name;
        }
        if let Some(description) = req.description {
            flow.description = Some(description);
        }
        if let Some(icon) = req.icon {
            flow.icon = Some(icon);
        }
        if let Some(color) = req.color {
            flow.color = Some(color);
        }
        if let Some(enabled) = req.enabled {
            flow.enabled = enabled;
        }
        if let Some(strategy) = req.default_fault_strategy {
            flow.default_fault_strategy = strategy;
        }
        flow.updated_at = Utc::now();

        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows
                 SET name = ?2, description = ?3, icon = ?4, color = ?5, enabled = ?6,
                     default_fault_strategy = ?7, updated_at = ?8
                 WHERE id = ?1",
                params![
                    flow.id,
                    flow.name,
                    flow.description,
                    flow.icon,
                    flow.color,
                    flow.enabled as i32,
                    serde_json::to_string(&flow.default_fault_strategy)?,
                    flow.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })?;

        Ok(flow)
    }

    /// 删除快捷指令（级联删除关联的动作与触发器）
    pub fn delete_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM automation_flows WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    /// 启用快捷指令
    pub fn enable_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows SET enabled = 1, updated_at = ?2 WHERE id = ?1",
                params![id, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    /// 禁用快捷指令
    pub fn disable_flow(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE automation_flows SET enabled = 0, updated_at = ?2 WHERE id = ?1",
                params![id, Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    // ============ 动作 CRUD ============

    /// 列出指定快捷指令的所有动作（按 order 排序）
    pub fn list_actions(&self, flow_id: &str) -> Result<Vec<Action>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note
                 FROM actions
                 WHERE flow_id = ?1
                 ORDER BY \"order\" ASC",
            )?;
            let actions = stmt
                .query_map(params![flow_id], row_to_action)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(actions)
        })
    }

    /// 替换快捷指令的所有动作（事务：先删除旧的再插入新的）
    pub fn set_actions(&self, flow_id: &str, actions: &[Action]) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "DELETE FROM actions WHERE flow_id = ?1",
                params![flow_id],
            )?;
            for action in actions {
                tx.execute(
                    "INSERT INTO actions
                     (id, flow_id, action_type, params, \"order\", parent_id, fault_strategy, note)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        action.id,
                        action.flow_id,
                        serde_json::to_string(&action.action_type)?,
                        action.params.to_string(),
                        action.order,
                        action.parent_id,
                        action
                            .fault_strategy
                            .map(|s| serde_json::to_string(&s).ok())
                            .flatten(),
                        action.note,
                    ],
                )?;
            }
            Ok(())
        })
    }

    // ============ 触发器 CRUD ============

    /// 列出指定快捷指令的所有触发器
    pub fn list_triggers(&self, flow_id: &str) -> Result<Vec<Trigger>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, flow_id, trigger_type, params, enabled
                 FROM triggers
                 WHERE flow_id = ?1",
            )?;
            let triggers = stmt
                .query_map(params![flow_id], row_to_trigger)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(triggers)
        })
    }

    /// 列出所有已启用的触发器（用于调度器轮询）
    pub fn list_all_enabled_triggers(&self) -> Result<Vec<Trigger>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT t.id, t.flow_id, t.trigger_type, t.params, t.enabled
                 FROM triggers t
                 INNER JOIN automation_flows f ON t.flow_id = f.id
                 WHERE t.enabled = 1 AND f.enabled = 1",
            )?;
            let triggers = stmt
                .query_map([], row_to_trigger)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(triggers)
        })
    }

    /// 替换快捷指令的所有触发器
    pub fn set_triggers(&self, flow_id: &str, triggers: &[Trigger]) -> Result<()> {
        self.db.with_transaction(|tx| {
            tx.execute(
                "DELETE FROM triggers WHERE flow_id = ?1",
                params![flow_id],
            )?;
            for trigger in triggers {
                tx.execute(
                    "INSERT INTO triggers (id, flow_id, trigger_type, params, enabled)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        trigger.id,
                        trigger.flow_id,
                        serde_json::to_string(&trigger.trigger_type)?,
                        trigger.params.to_string(),
                        trigger.enabled as i32,
                    ],
                )?;
            }
            Ok(())
        })
    }

    /// 启用触发器
    pub fn enable_trigger(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE triggers SET enabled = 1 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    /// 禁用触发器
    pub fn disable_trigger(&self, id: &str) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE triggers SET enabled = 0 WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    // ============ 执行日志 CRUD ============

    /// 插入执行日志
    pub fn insert_log(&self, log: &ExecutionLog) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO execution_logs
                 (id, flow_id, action_id, status, started_at, finished_at, duration_ms, error, context)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    log.id,
                    log.flow_id,
                    log.action_id,
                    serde_json::to_string(&log.status)?,
                    log.started_at.to_rfc3339(),
                    log.finished_at.map(|t| t.to_rfc3339()),
                    log.duration_ms.map(|d| d as i64),
                    log.error,
                    log.context,
                ],
            )?;
            Ok(())
        })
    }

    /// 查询执行日志
    pub fn list_logs(&self, filter: &LogFilter) -> Result<Vec<ExecutionLog>> {
        self.db.with_conn(|conn| {
            let limit = filter.limit.unwrap_or(100) as i64;
            let offset = filter.offset.unwrap_or(0) as i64;

            let mut sql = String::from(
                "SELECT id, flow_id, action_id, status, started_at, finished_at, duration_ms, error, context
                 FROM execution_logs WHERE 1=1",
            );
            let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

            if let Some(flow_id) = &filter.flow_id {
                sql.push_str(" AND flow_id = ?");
                param_values.push(Box::new(flow_id.clone()));
            }
            if let Some(status) = &filter.status {
                sql.push_str(" AND status = ?");
                param_values.push(Box::new(serde_json::to_string(status)?));
            }

            sql.push_str(" ORDER BY started_at DESC LIMIT ? OFFSET ?");
            param_values.push(Box::new(limit));
            param_values.push(Box::new(offset));

            let params_refs: Vec<&dyn rusqlite::ToSql> =
                param_values.iter().map(|p| p.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let logs = stmt
                .query_map(params_refs.as_slice(), row_to_log)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(logs)
        })
    }

    /// 清理执行日志（保留最近 N 条）
    pub fn cleanup_logs(&self, keep: usize) -> Result<usize> {
        self.db.with_conn(|conn| {
            let deleted = conn.execute(
                "DELETE FROM execution_logs
                 WHERE id NOT IN (
                     SELECT id FROM execution_logs
                     ORDER BY started_at DESC
                     LIMIT ?1
                 )",
                params![keep as i64],
            )?;
            if deleted > 0 {
                tracing::info!("清理了 {} 条旧执行日志", deleted);
            }
            Ok(deleted)
        })
    }

    /// 清空执行日志
    pub fn clear_logs(&self) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM execution_logs", [])?;
            Ok(())
        })
    }

    // ============ 设置 CRUD ============

    /// 获取设置项
    pub fn get_setting(&self, key: &str) -> Result<Option<Setting>> {
        self.db.with_conn(|conn| {
            let setting = conn
                .query_row(
                    "SELECT key, value, value_type FROM settings WHERE key = ?1",
                    params![key],
                    |row| {
                        Ok(Setting {
                            key: row.get(0)?,
                            value: row.get(1)?,
                            value_type: row.get(2)?,
                        })
                    },
                )
                .optional()?;
            Ok(setting)
        })
    }

    /// 设置值（upsert：存在则更新，不存在则插入）
    pub fn set_setting(&self, setting: &Setting) -> Result<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO settings (key, value, value_type) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = ?2, value_type = ?3",
                params![setting.key, setting.value, setting.value_type],
            )?;
            Ok(())
        })
    }

    /// 获取所有设置
    pub fn get_all_settings(&self) -> Result<Vec<Setting>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT key, value, value_type FROM settings")?;
            let settings = stmt
                .query_map([], |row| {
                    Ok(Setting {
                        key: row.get(0)?,
                        value: row.get(1)?,
                        value_type: row.get(2)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(settings)
        })
    }
}

// ============ Row 映射函数 ============

fn row_to_flow(row: &rusqlite::Row<'_>) -> rusqlite::Result<AutomationFlow> {
    let enabled: i32 = row.get(5)?;
    let strategy_str: String = row.get(6)?;
    let created_str: String = row.get(7)?;
    let updated_str: String = row.get(8)?;

    Ok(AutomationFlow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        icon: row.get(3)?,
        color: row.get(4)?,
        enabled: enabled != 0,
        default_fault_strategy: serde_json::from_str(&strategy_str).unwrap_or_default(),
        created_at: DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_action(row: &rusqlite::Row<'_>) -> rusqlite::Result<Action> {
    let action_type_str: String = row.get(2)?;
    let params_str: String = row.get(3)?;
    let strategy_str: Option<String> = row.get(6)?;

    Ok(Action {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        action_type: serde_json::from_str(&action_type_str).unwrap_or(ActionType::SetVariable),
        params: serde_json::from_str(&params_str).unwrap_or_else(|_| Value::Null),
        order: row.get(4)?,
        parent_id: row.get(5)?,
        fault_strategy: strategy_str
            .and_then(|s| serde_json::from_str(&s).ok()),
        note: row.get(7)?,
    })
}

fn row_to_trigger(row: &rusqlite::Row<'_>) -> rusqlite::Result<Trigger> {
    let trigger_type_str: String = row.get(2)?;
    let params_str: String = row.get(3)?;
    let enabled: i32 = row.get(4)?;

    Ok(Trigger {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        trigger_type: serde_json::from_str(&trigger_type_str).unwrap_or(TriggerType::Manual),
        params: serde_json::from_str(&params_str).unwrap_or_else(|_| Value::Null),
        enabled: enabled != 0,
    })
}

fn row_to_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<ExecutionLog> {
    let status_str: String = row.get(3)?;
    let started_str: String = row.get(4)?;
    let finished_str: Option<String> = row.get(5)?;
    let duration: Option<i64> = row.get(6)?;

    Ok(ExecutionLog {
        id: row.get(0)?,
        flow_id: row.get(1)?,
        action_id: row.get(2)?,
        status: serde_json::from_str(&status_str).unwrap_or(ExecutionStatus::Failed),
        started_at: DateTime::parse_from_rfc3339(&started_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        finished_at: finished_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc)),
        duration_ms: duration.map(|d| d as u64),
        error: row.get(7)?,
        context: row.get(8)?,
    })
}

// FaultStrategy 不需要 FromSql，因为通过 serde_json 序列化字符串存储
// Default 实现由 common.rs 中的 #[derive(Default)] + #[default] variant 提供
