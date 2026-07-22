/**
 * Tauri 后端命令封装
 *
 * 对应 src-tauri/src/commands/ 下暴露的所有 invoke 命令。
 * 类型定义镜像 src-tauri/src/models/ 下的 Rust 模型。
 *
 * 注意：
 * - Rust Option<T> 序列化为 T | null
 * - chrono::DateTime<Utc> 序列化为 ISO 8601 字符串
 * - Rust enum 使用 #[serde(tag = "kind", content = "variant")] 内部标签
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================
// 通用类型
// ============================================================

/** 执行状态（镜像 ExecutionStatus） */
export type ExecutionStatus =
  | "Pending"
  | "Running"
  | "Success"
  | "Failed"
  | "Skipped";

/** 容错策略（镜像 FaultStrategy） */
export type FaultStrategy = "Continue" | "Stop" | "Rollback" | "Notify";

/** 动作类型 kind 标签（镜像 ActionType，单元变体序列化为 {kind: "..."}） */
export type ActionTypeKind =
  | "LaunchProgram"
  | "KillProcess"
  | "OpenUrl"
  | "OpenFile"
  | "SetVolume"
  | "PlaySound"
  | "SimulateKey"
  | "Shutdown"
  | "Reboot"
  | "LockScreen"
  | "Hibernate"
  | "Logoff"
  | "CleanTempFiles"
  | "SwitchPowerPlan"
  | "ShowToast"
  | "ShowInAppNotification"
  | "IfElse"
  | "Loop"
  | "SetVariable"
  | "LuaScript";

/** 触发器类型 kind 标签（镜像 TriggerType） */
export type TriggerTypeKind =
  | "Cron"
  | "CourseStart"
  | "SystemBoot"
  | "SystemShutdown"
  | "UserLogin"
  | "UserLockScreen"
  | "UsbPlug"
  | "UsbUnplug"
  | "NetworkChange"
  | "ProcessStart"
  | "ProcessStop"
  | "Manual";

// ============================================================
// 数据模型
// ============================================================

/** 快捷指令（镜像 AutomationFlow） */
export interface AutomationFlow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  default_fault_strategy: FaultStrategy;
  created_at: string;
  updated_at: string;
}

/** 创建快捷指令请求（镜像 CreateFlowRequest） */
export interface CreateFlowRequest {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** 更新快捷指令请求（镜像 UpdateFlowRequest） */
export interface UpdateFlowRequest {
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  enabled?: boolean | null;
  default_fault_strategy?: FaultStrategy | null;
}

/** 触发器（镜像 Trigger） */
export interface Trigger {
  id: string;
  flow_id: string;
  trigger_type: { kind: TriggerTypeKind; variant: unknown | null };
  params: unknown;
  enabled: boolean;
}

/** 执行日志（镜像 ExecutionLog） */
export interface ExecutionLog {
  id: string;
  flow_id: string;
  action_id: string | null;
  status: ExecutionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  context: string | null;
}

/** 日志查询筛选（镜像 LogFilter） */
export interface LogFilter {
  flow_id?: string | null;
  status?: ExecutionStatus | null;
  limit?: number | null;
  offset?: number | null;
}

/** 设置项（镜像 Setting，KV 形式存储在 settings 表） */
export interface Setting {
  /** 键名（如 "theme.mode"、"general.autostart"） */
  key: string;
  /** 值（JSON 编码的字符串，可表示任意类型） */
  value: string;
  /** 类型标识："string" / "number" / "bool" / "json" */
  value_type: string;
}

/** 后端默认设置键名（镜像 setting.rs defaults 模块） */
export const SettingKeys = {
  themeMode: "theme.mode",
  themeColor: "theme.color",
  themeMicaEnabled: "theme.mica_enabled",
  generalAutostart: "general.autostart",
  generalCloseBehavior: "general.close_behavior",
  generalSidebarCollapsed: "general.sidebar_collapsed",
  updateCheckFrequency: "update.check_frequency",
  updateAutoUpdate: "update.auto_update",
  updateChannel: "update.channel",
  automationLuaTimeoutSecs: "automation.lua_timeout_secs",
  automationLogRetention: "automation.log_retention",
  automationConcurrencyMode: "automation.concurrency_mode",
  automationDefaultVolume: "automation.default_volume",
} as const;

// ============================================================
// 命令封装
// ============================================================

// ---- 数据库 ----
export const dbCommands = {
  ping: () => invoke<string>("ping"),
  getDbInfo: () => invoke<Record<string, unknown>>("get_db_info"),
  runMigrations: () => invoke<void>("run_migrations"),
};

// ---- 快捷指令 ----
export const flowCommands = {
  list: () => invoke<AutomationFlow[]>("list_flows"),
  get: (id: string) => invoke<AutomationFlow | null>("get_flow", { id }),
  create: (request: CreateFlowRequest) =>
    invoke<AutomationFlow>("create_flow", { request }),
  update: (id: string, request: UpdateFlowRequest) =>
    invoke<AutomationFlow>("update_flow", { id, request }),
  delete: (id: string) => invoke<void>("delete_flow", { id }),
  enable: (id: string) => invoke<void>("enable_flow", { id }),
  disable: (id: string) => invoke<void>("disable_flow", { id }),
};

// ---- 动作 ----
export const actionCommands = {
  list: (flowId: string) =>
    invoke<unknown[]>("list_actions", { flowId }),
  set: (flowId: string, actions: unknown[]) =>
    invoke<void>("set_actions", { flowId, actions }),
};

// ---- 触发器 ----
export const triggerCommands = {
  list: (flowId: string) =>
    invoke<Trigger[]>("list_triggers", { flowId }),
  set: (flowId: string, triggers: unknown[]) =>
    invoke<void>("set_triggers", { flowId, triggers }),
  enable: (id: string) => invoke<void>("enable_trigger", { id }),
  disable: (id: string) => invoke<void>("disable_trigger", { id }),
};

// ---- 执行与日志 ----
export const executionCommands = {
  executeFlow: (flowId: string) =>
    invoke<ExecutionLog>("execute_flow", { flowId }),
  executeAction: (actionType: unknown, params: unknown) =>
    invoke<unknown>("execute_action", { actionType, params }),
  listLogs: (filter?: LogFilter) =>
    invoke<ExecutionLog[]>("list_logs", { filter: filter ?? null }),
  clearLogs: () => invoke<void>("clear_logs"),
};

// ---- 设置 ----
export const settingCommands = {
  get: (key: string) => invoke<Setting | null>("get_setting", { key }),
  set: (setting: Setting) => invoke<void>("set_setting", { setting }),
  getAll: () => invoke<Setting[]>("get_all_settings"),
};

// ---- 测试 ----
export const testCommands = {
  e2eTest: () => invoke<string>("e2e_test"),
};
