import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Copy,
  CalendarX,
  CalendarClock,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course } from "@/lib/tauri";

export interface CourseActionMenuPosition {
  /** 菜单显示的 x 坐标（视口坐标） */
  x: number;
  /** 菜单显示的 y 坐标（视口坐标） */
  y: number;
}

interface CourseActionMenuProps {
  /** 菜单定位（长按触发时记录的坐标） */
  position: CourseActionMenuPosition | null;
  /** 目标课程 */
  course: Course | null;
  /** 关闭菜单 */
  onClose: () => void;
  /** 编辑课程 */
  onEdit?: (course: Course) => void;
  /** 复制到其他时间 */
  onDuplicate?: (course: Course) => void;
  /** 临时取消该课程（当天） */
  onCancelOccurrence?: (course: Course) => void;
  /** 临时调整该课程（当天） */
  onMoveOccurrence?: (course: Course) => void;
  /** 删除课程（永久） */
  onDelete?: (course: Course) => void;
}

/**
 * 课程长按操作菜单（SPEC 3.5：触屏无右键，长按 500ms 弹出）
 *
 * 浮动定位到长按坐标，提供：
 * - 编辑（打开表单）
 * - 复制（创建副本到其他时间）
 * - 临时取消（当天取消，不修改常规课表）
 * - 临时调整（当天换时间）
 * - 删除（永久删除）
 */
export function CourseActionMenu({
  position,
  course,
  onClose,
  onEdit,
  onDuplicate,
  onCancelOccurrence,
  onMoveOccurrence,
  onDelete,
}: CourseActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<CourseActionMenuPosition | null>(null);

  // 根据视口边界调整菜单位置，避免溢出
  useEffect(() => {
    if (!position) {
      setAdjustedPos(null);
      return;
    }
    // 等下一帧让菜单渲染后再测量尺寸
    requestAnimationFrame(() => {
      if (!menuRef.current) {
        setAdjustedPos(position);
        return;
      }
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let { x, y } = position;
      // 右溢出 → 向左偏移
      if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
      // 下溢出 → 向上偏移
      if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
      setAdjustedPos({ x, y });
    });
  }, [position]);

  // ESC 关闭
  useEffect(() => {
    if (!position) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [position, onClose]);

  if (!position || !course) return null;

  const actions = [
    { icon: Pencil, label: "编辑课程", onClick: onEdit, danger: false },
    { icon: Copy, label: "复制到...", onClick: onDuplicate, danger: false },
    { icon: CalendarX, label: "临时取消当天", onClick: onCancelOccurrence, danger: false },
    { icon: CalendarClock, label: "临时调整当天", onClick: onMoveOccurrence, danger: false },
    { icon: Trash2, label: "永久删除", onClick: onDelete, danger: true },
  ].filter((a) => a.onClick !== undefined);

  return (
    <>
      {/* 透明遮罩，点击关闭 */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        style={{
          left: (adjustedPos ?? position).x,
          top: (adjustedPos ?? position).y,
        }}
      >
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {course.subject_name}
        </div>
        <div className="h-px bg-muted" />
        {actions.map((action) => (
          <button
            key={action.label}
            role="menuitem"
            onClick={() => {
              action.onClick?.(course);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
              action.danger && "text-destructive hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
