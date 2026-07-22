import { useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { Course } from "@/lib/tauri";

/**
 * 拖拽上下文（SPEC 3.5 页面 2：拖拽编辑）
 *
 * 使用 @dnd-kit 提供触摸/鼠标/键盘三模式支持，
 * 适配 30Hz 触屏（PointerSensor 阈值 8px，避免误触）。
 *
 * 拖拽语义：
 * - 格点模式：从一个节次格拖到另一格 → 调用 onMoveCourse 更新 period_index
 * - 自由模式：从一个时间段拖到另一时间段 → 调用 onMoveCourse 更新 start_time/end_time
 */

export interface DragPayload {
  /** 拖拽的课程对象 */
  course: Course;
  /** 源位置标识（格点模式 "day-week-period"，自由模式 "day-week"） */
  sourceId: string;
}

export interface DropTarget {
  /** 目标位置标识 */
  targetId: string;
  /** 目标星期几 */
  dayOfWeek: number;
  /** 目标节次（格点模式） */
  periodIndex: number | null;
  /** 目标开始时间（自由模式） */
  startTime?: string;
  /** 目标结束时间（自由模式） */
  endTime?: string;
}

interface TimelineDndContextProps {
  children: React.ReactNode;
  /** 拖拽结束回调：将课程移动到新位置 */
  onMoveCourse: (
    course: Course,
    target: DropTarget
  ) => void | Promise<void>;
}

interface InternalDragState {
  payload: DragPayload;
}

/**
 * 拖拽上下文 Provider
 *
 * 包裹时间轴视图，提供拖拽能力。
 * 子组件通过 useDraggableCourse / useDroppableCell 接入。
 */
export function TimelineDndContext({
  children,
  onMoveCourse,
}: TimelineDndContextProps) {
  const sensors = useSensors(
    // PointerSensor：统一鼠标/触摸/笔输入，8px 激活阈值避免误触
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    // TouchSensor：触摸专用，延迟 200ms + 8px 移动激活
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    // KeyboardSensor：无障碍支持
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const payload = active.data.current?.payload as DragPayload | undefined;
      const target = over.data.current?.target as DropTarget | undefined;
      if (!payload || !target) return;
      if (payload.sourceId === target.targetId) return;

      onMoveCourse(payload.course, target);
    },
    [onMoveCourse]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {children}
    </DndContext>
  );
}

/**
 * 可拖拽课程 hook
 *
 * 在 CourseBlock 上调用，注入拖拽 props。
 */
export function useDraggableCourse(payload: DragPayload) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: payload.sourceId,
    data: { payload },
  });

  return {
    dragAttributes: attributes,
    dragListeners: listeners,
    setNodeRef,
    isDragging,
  };
}

/**
 * 可放置单元格 hook
 *
 * 在周视图/日视图的格子上调用，接收拖入的课程。
 */
export function useDroppableCell(target: DropTarget) {
  const { setNodeRef, isOver } = useDroppable({
    id: target.targetId,
    data: { target },
  });

  return {
    setDropNodeRef: setNodeRef,
    isOver,
  };
}
