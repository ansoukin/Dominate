import { Cpu, MemoryStick, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * 系统状态卡片（SPEC 3.5.1 模块 3）
 *
 * Phase 2：静态占位数据，标注待 Phase 4 实现真实硬件监控。
 * Phase 4 将集成 LibreHardwareMonitorLib（SPEC 4.x）：
 * - CPU 使用率（总体 + 各核心）
 * - 内存使用情况（已用/可用/总量）
 * - 温度监控（CPU/GPU/主板/硬盘）
 */
export function SystemStatus() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            系统状态
          </CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Phase 4
          </span>
        </div>
        <CardDescription>硬件监控占位 · 待接入实时数据</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {/* CPU 使用率（静态占位） */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              CPU
            </span>
            <span className="font-mono text-muted-foreground">— %</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary transition-all duration-200" />
          </div>
        </div>

        {/* 内存使用率（静态占位） */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MemoryStick className="h-3.5 w-3.5" />
              内存
            </span>
            <span className="font-mono text-muted-foreground">— / — GB</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary transition-all duration-200" />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>真实硬件监控将在 Phase 4 性能优化页统一实现。</span>
        </div>
      </CardContent>
    </Card>
  );
}
