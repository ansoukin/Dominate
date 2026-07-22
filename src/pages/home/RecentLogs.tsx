import { History, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecutionLog, ExecutionStatus } from "@/lib/tauri";

interface RecentLogsProps {
  logs: ExecutionLog[];
  loading: boolean;
}

/** 根据执行状态返回图标与配色 */
function getStatusVisual(status: ExecutionStatus): {
  Icon: React.ComponentType<{ className?: string }>;
  className: string;
} {
  switch (status) {
    case "Success":
      return { Icon: CheckCircle2, className: "text-emerald-500" };
    case "Failed":
      return { Icon: XCircle, className: "text-destructive" };
    case "Running":
    case "Pending":
      return { Icon: Clock, className: "text-blue-500" };
    case "Skipped":
    default:
      return { Icon: Clock, className: "text-muted-foreground" };
  }
}

/** 格式化 ISO 时间为 HH:MM:SS */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** 截断 UUID 为短显示形式 */
function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/**
 * 最近执行记录（SPEC 3.5.1 模块 2）
 *
 * 显示最近 5 条执行日志，含成功/失败状态、关联指令、耗时与时间。
 */
export function RecentLogs({ logs, loading }: RecentLogsProps) {
  const recent = logs.slice(0, 5);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          最近执行记录
        </CardTitle>
        <CardDescription>最近 5 条执行结果</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <History className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">暂无执行记录</p>
            <p className="mt-1 text-xs">执行指令后此处显示结果</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((log) => {
              const { Icon, className } = getStatusVisual(log.status);
              return (
                <li
                  key={log.id}
                  className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2.5"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${className}`} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      指令 #{shortId(log.flow_id)}
                    </span>
                    {log.error && (
                      <span className="truncate text-xs text-destructive">
                        {log.error}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end text-xs text-muted-foreground">
                    <span className="font-mono">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
                    </span>
                    <span>{formatTime(log.started_at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
