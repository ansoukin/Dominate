import { Zap, Loader2, Play, Loader } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AutomationFlow } from "@/lib/tauri";

interface QuickActionsPanelProps {
  flows: AutomationFlow[];
  loading: boolean;
  /** 当前正在执行的 flow id */
  executingId: string | null;
  /** 执行指定 flow */
  onExecute: (flowId: string) => void;
}

/**
 * 快捷动作（SPEC 3.5.1 模块 4）
 *
 * 常用指令一键运行。显示已启用的指令卡片，点击立即执行。
 */
export function QuickActionsPanel({
  flows,
  loading,
  executingId,
  onExecute,
}: QuickActionsPanelProps) {
  const enabledFlows = flows.filter((f) => f.enabled).slice(0, 6);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          快捷动作
        </CardTitle>
        <CardDescription>一键运行已启用的指令</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : enabledFlows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Play className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">暂无可执行的指令</p>
            <p className="mt-1 text-xs">创建并启用指令后可在此一键运行</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {enabledFlows.map((flow) => {
              const isExecuting = executingId === flow.id;
              return (
                <Button
                  key={flow.id}
                  variant="outline"
                  disabled={isExecuting}
                  onClick={() => onExecute(flow.id)}
                  className="h-auto flex-col items-start gap-1 p-3 text-left"
                >
                  {isExecuting ? (
                    <Loader className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Zap className="h-4 w-4 text-primary" />
                  )}
                  <span className="line-clamp-2 text-xs font-medium">
                    {flow.name}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
