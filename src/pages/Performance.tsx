import { Gauge } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * 性能优化页面（SPEC 3.5 页面 4）
 *
 * Phase 2 仅占位骨架，Phase 4 实现：
 * - 硬件监控（CPU/内存/温度，参考 LibreHardwareMonitorLib）
 * - Top 20 进程列表
 * - 进程优化操作（优先级调整 / 结束进程）
 * - 一键优化
 */
export default function PerformancePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">性能优化</h1>
      </div>
      <Card className="flex flex-1 flex-col items-center justify-center border-dashed text-center">
        <p className="text-base font-medium text-muted-foreground">
          Phase 4 实现
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          硬件监控 · 进程列表 · 一键优化
        </p>
      </Card>
    </div>
  );
}
