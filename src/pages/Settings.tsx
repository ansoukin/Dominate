import { Settings as SettingsIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * 设置页面（SPEC 3.5 页面 5）
 *
 * Phase 2 仅占位骨架，Phase 6 实现 5 个分区：
 * 1. 外观：深浅模式 + 8 色主题色 + Mica 背景
 * 2. 通用：侧边栏折叠 + 开机自启 + 关闭主窗口行为 + 更新检查频率
 * 3. 更新：自动更新 + 强制更新 + 渠道
 * 4. 关于：基本信息 + 技术栈 + MIT 许可 + GitHub 链接 + 更新历史
 * 5. 帮助：内置帮助页
 */
export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      </div>
      <Card className="flex flex-1 flex-col items-center justify-center border-dashed text-center">
        <p className="text-base font-medium text-muted-foreground">
          Phase 6 实现
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          外观 · 通用 · 更新 · 关于 · 帮助
        </p>
      </Card>
    </div>
  );
}
