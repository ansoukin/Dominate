import { Zap } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * 快捷指令页面（SPEC 3.5 页面 3）
 *
 * Phase 2 仅占位骨架，Phase 4 实现可视化编辑器后逐步完善：
 * - 4 Tab 切换（指令列表 / 执行日志 / 自动化设置 / Lua 脚本市场）
 * - 卡片网格展示指令
 * - 可视化编辑器（React Flow）
 */
export default function QuickActionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">快捷指令</h1>
      </div>
      <Card className="flex flex-1 flex-col items-center justify-center border-dashed text-center">
        <p className="text-base font-medium text-muted-foreground">
          Phase 4 实现
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          指令列表 · 执行日志 · 自动化设置 · Lua 脚本市场
        </p>
      </Card>
    </div>
  );
}
