import { useEffect, useState } from "react";
import { Home as HomeIcon, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TodayTasks } from "@/pages/home/TodayTasks";
import { RecentLogs } from "@/pages/home/RecentLogs";
import { SystemStatus } from "@/pages/home/SystemStatus";
import { QuickActionsPanel } from "@/pages/home/QuickActionsPanel";
import {
  flowCommands,
  executionCommands,
  type AutomationFlow,
  type ExecutionLog,
} from "@/lib/tauri";

/**
 * 首页 Dashboard（SPEC 3.5.1 页面 1）
 *
 * 4 模块布局：
 * - 今日任务预览（按时间排序）
 * - 最近执行记录（成功/失败状态）
 * - 系统状态卡片（CPU/内存，Phase 2 占位）
 * - 快捷动作（常用指令一键运行）
 */
export default function HomePage() {
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [flowsData, logsData] = await Promise.all([
        flowCommands.list(),
        executionCommands.listLogs({ limit: 10 }),
      ]);
      setFlows(flowsData);
      setLogs(logsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleExecute(flowId: string) {
    setExecutingId(flowId);
    try {
      await executionCommands.executeFlow(flowId);
      // 执行后刷新日志
      const logsData = await executionCommands.listLogs({ limit: 10 });
      setLogs(logsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecutingId(null);
    }
  }

  /** 当前日期，中文长格式 */
  const todayLabel = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* 顶部欢迎区 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HomeIcon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              首页 Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">{todayLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadData}
          title="刷新"
          className="h-10 w-10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">数据加载失败：{error}</span>
          <Button variant="ghost" size="sm" onClick={loadData}>
            重试
          </Button>
        </div>
      )}

      {/* 4 模块网格：2x2 响应式布局 */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <TodayTasks flows={flows} loading={loading} />
        <SystemStatus />
        <QuickActionsPanel
          flows={flows}
          loading={loading}
          executingId={executingId}
          onExecute={handleExecute}
        />
        <RecentLogs logs={logs} loading={loading} />
      </div>
    </div>
  );
}
