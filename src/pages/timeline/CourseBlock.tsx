import { MapPin, User, Zap, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course } from "@/lib/tauri";
import { useLongPress } from "./useLongPress";
import { formatTimeRange } from "./utils";

/**
 * 课程块默认色板（当 course.color 为空时按科目名 hash 分配）
 *
 * 使用 Win11 色板的 HSL 变量，避免硬编码 hex 导致深浅模式不兼容。
 */
const DEFAULT_COLORS = [
  "hsl(206 100% 42%)",
  "hsl(122 78% 27%)",
  "hsl(14 97% 43%)",
  "hsl(265 53% 37%)",
  "hsl(352 86% 49%)",
  "hsl(187 100% 38%)",
  "hsl(322 100% 44%)",
  "hsl(45 100% 50%)",
];

/** 按字符串 hash 选择默认颜色 */
function hashColor(subjectName: string): string {
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = ((hash << 5) - hash + subjectName.charCodeAt(i)) | 0;
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

interface CourseBlockProps {
  course: Course;
  /** 课程开始时间（已根据节次定义或自由模式解析） */
  startTime: string;
  /** 课程结束时间 */
  endTime: string;
  /** 是否已取消（临时调课 cancel） */
  cancelled?: boolean;
  /** 是否为临时新增课程 */
  isOverride?: boolean;
  /** 点击展开详情 */
  onClick?: (course: Course) => void;
  /** 长按弹出操作菜单（SPEC 3.5：触屏无右键） */
  onLongPress?: (course: Course) => void;
  /** 拖拽 props 注入（步骤 5 由 dnd-kit 提供） */
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  isDragging?: boolean;
  /** dnd-kit ref 注入（用于可拖拽元素） */
  setNodeRef?: (el: HTMLElement | null) => void;
  /** 是否紧凑显示（月视图用） */
  compact?: boolean;
  className?: string;
}

/**
 * 课程块组件（SPEC 3.5 页面 2：信息丰富型）
 *
 * 显示：科目名 + 时间 + 关联指令图标 + 颜色标识
 * 交互：点击展开详情，长按 500ms 弹出操作菜单
 */
export function CourseBlock({
  course,
  startTime,
  endTime,
  cancelled = false,
  isOverride = false,
  onClick,
  onLongPress,
  dragAttributes,
  dragListeners,
  isDragging = false,
  setNodeRef,
  compact = false,
  className,
}: CourseBlockProps) {
  const color = course.color || hashColor(course.subject_name);
  const longPress = useLongPress(() => onLongPress?.(course), 500);

  if (compact) {
    // 月视图紧凑模式：仅显示色条 + 科目名
    return (
      <div
        ref={setNodeRef}
        {...dragAttributes}
        {...dragListeners}
        {...longPress}
        onClick={(e) => {
          e.stopPropagation();
          if (!longPress.isLongPress) onClick?.(course);
        }}
        className={cn(
          "flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium",
          cancelled && "opacity-40 line-through",
          isDragging && "opacity-50",
          className
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          color: color,
        }}
        title={`${course.subject_name} ${startTime}-${endTime}`}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{course.subject_name}</span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...dragAttributes}
      {...dragListeners}
      {...longPress}
      onClick={(e) => {
        e.stopPropagation();
        if (!longPress.isLongPress) onClick?.(course);
      }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-md border-l-4 p-2 text-left transition-opacity duration-200",
        "hover:shadow-md",
        cancelled && "opacity-40",
        isOverride && "ring-1 ring-dashed ring-primary/50",
        isDragging && "opacity-50 shadow-lg",
        className
      )}
      style={{
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, hsl(var(--card)))`,
      }}
      title={course.subject_name}
    >
      {/* 顶部：科目名 + 关联指令图标 */}
      <div className="flex items-start justify-between gap-1">
        <span
          className="text-sm font-semibold leading-tight"
          style={{ color: color }}
        >
          {course.subject_name}
        </span>
        {course.flow_id && (
          <Zap
            className="h-3.5 w-3.5 shrink-0 opacity-60"
            style={{ color: color }}
          />
        )}
      </div>

      {/* 时间段 */}
      <span className="mt-0.5 text-xs text-muted-foreground">
        {formatTimeRange(startTime, endTime)}
      </span>

      {/* 底部：地点 + 教师（如有） */}
      {!compact && (course.location || course.teacher) && (
        <div className="mt-auto flex flex-col gap-0.5 pt-1 text-xs text-muted-foreground">
          {course.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {course.location}
            </span>
          )}
          {course.teacher && (
            <span className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0" />
              {course.teacher}
            </span>
          )}
        </div>
      )}

      {/* 取消标记 */}
      {cancelled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <X className="h-6 w-6 text-destructive" />
        </div>
      )}

      {/* 临时调课标记 */}
      {isOverride && (
        <span className="absolute right-1 top-1 rounded bg-primary/80 px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
          临时
        </span>
      )}
    </div>
  );
}
