-- V002__seed_defaults.sql - 写入默认设置与示例指令
-- 首次启动时写入默认值，避免应用逻辑中到处判空

-- 主题设置
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('theme.mode', 'system', 'string'),
    ('theme.color', '#0078D4', 'string'),
    ('theme.mica_enabled', 'false', 'bool');

-- 通用设置
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('general.autostart', 'false', 'bool'),
    ('general.close_behavior', 'ask', 'string'),
    ('general.sidebar_collapsed', 'false', 'bool');

-- 更新设置
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('update.check_frequency', 'startup', 'string'),
    ('update.auto_update', 'true', 'bool'),
    ('update.channel', 'stable', 'string');

-- 自动化设置
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('automation.lua_timeout_secs', '10', 'number'),
    ('automation.log_retention', '100', 'number'),
    ('automation.concurrency_mode', 'parallel', 'string'),
    ('automation.default_volume', '50', 'number');

-- 示例快捷指令："放学关机"（默认禁用）
-- 注意：使用固定 UUID 便于幂等（重复执行不会创建多条）
INSERT OR IGNORE INTO automation_flows (id, name, description, icon, color, enabled, default_fault_strategy, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '放学关机',
    '每天 17:30 自动关机的示例指令',
    'power',
    '#F44336',
    0,
    'Stop',
    '2026-07-18T00:00:00Z',
    '2026-07-18T00:00:00Z'
);

-- 示例指令的动作：关机
INSERT OR IGNORE INTO actions (id, flow_id, action_type, params, "order", parent_id, fault_strategy, note)
VALUES (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Shutdown',
    '{"delay_secs":0,"force":false}',
    0,
    NULL,
    NULL,
    '关机动作'
);

-- 示例指令的触发器：每天 17:30 的 cron
INSERT OR IGNORE INTO triggers (id, flow_id, trigger_type, params, enabled)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000001',
    'Cron',
    '{"expression":"30 17 * * *","timezone":null}',
    1
);
