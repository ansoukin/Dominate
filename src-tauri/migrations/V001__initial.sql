-- V001__initial.sql - 初始数据库结构
-- 创建 5 张核心表：快捷指令 / 动作 / 触发器 / 执行日志 / 设置

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 快捷指令表
CREATE TABLE automation_flows (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    enabled INTEGER NOT NULL DEFAULT 0,  -- 0=false, 1=true
    default_fault_strategy TEXT NOT NULL DEFAULT 'Continue',
    created_at TEXT NOT NULL,  -- ISO 8601 时间戳
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_flows_enabled ON automation_flows(enabled);
CREATE INDEX idx_flows_created ON automation_flows(created_at);

-- 动作表
CREATE TABLE actions (
    id TEXT PRIMARY KEY NOT NULL,
    flow_id TEXT NOT NULL,
    action_type TEXT NOT NULL,  -- ActionType 序列化字符串
    params TEXT NOT NULL DEFAULT '{}',  -- JSON 参数
    "order" INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    fault_strategy TEXT,  -- NULL 表示使用 Flow 默认
    note TEXT,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES actions(id) ON DELETE CASCADE
);

CREATE INDEX idx_actions_flow ON actions(flow_id);
CREATE INDEX idx_actions_parent ON actions(parent_id);
CREATE INDEX idx_actions_order ON actions(flow_id, "order");

-- 触发器表
CREATE TABLE triggers (
    id TEXT PRIMARY KEY NOT NULL,
    flow_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,  -- TriggerType 序列化字符串
    params TEXT NOT NULL DEFAULT '{}',  -- JSON 参数
    enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (flow_id) REFERENCES automation_flows(id) ON DELETE CASCADE
);

CREATE INDEX idx_triggers_flow ON triggers(flow_id);
CREATE INDEX idx_triggers_enabled ON triggers(enabled);

-- 执行日志表
CREATE TABLE execution_logs (
    id TEXT PRIMARY KEY NOT NULL,
    flow_id TEXT NOT NULL,
    action_id TEXT,
    status TEXT NOT NULL,  -- ExecutionStatus 枚举
    started_at TEXT NOT NULL,
    finished_at TEXT,
    duration_ms INTEGER,
    error TEXT,
    context TEXT  -- JSON 上下文快照
);

CREATE INDEX idx_logs_flow ON execution_logs(flow_id);
CREATE INDEX idx_logs_status ON execution_logs(status);
CREATE INDEX idx_logs_started ON execution_logs(started_at);
CREATE INDEX idx_logs_flow_started ON execution_logs(flow_id, started_at);

-- 设置表（KV 结构）
CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string'
);
