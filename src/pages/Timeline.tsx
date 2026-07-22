import { CalendarDays } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * 时间轴页面（SPEC 3.5 页面 2）
 *
 * Phase 2 仅占位骨架，Phase 3 实现：
 * - 日 / 周 / 月三视图切换
 * - 拖拽编辑（节次格点 + 自由模式可切换）
 * - 长按弹出菜单 / 临时调课 / 多周课表
 */
export default function TimelinePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">时间轴</h1>
      </div>
      <Card className="flex flex-1 flex-col items-center justify-center border-dashed text-center">
        <p className="text-base font-medium text-muted-foreground">
          Phase 3 实现
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          日 / 周 / 月三视图 · 拖拽编辑 · 多周课表
        </p>
      </Card>
    </div>
  );
}
