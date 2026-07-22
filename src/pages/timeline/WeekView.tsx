import React, { useMemo } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course, ScheduleOverride, ClassPeriod } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { CourseBlock } from "./CourseBlock";
import {
  TimelineDndContext,
  useDraggableCourse,
  useDroppableCell,
  type DropTarget,
} from "./TimelineDndContext";
import {
  WEEKDAY_SHORT,
  getWeekday,
  isToday,
  weekDates,
  resolveDayCourses,
  timeToMinutes,
  type DisplayCourse,
} from "./utils";

interface WeekViewProps {
  semesterId: string;
  semesterStart: string;
  courses: Course[];
  periods: ClassPeriod[];
  /** 全学期的调课记录（组件内按周日期过滤） */
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  /** 点击空格子的回调（用于新增课程） */
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  /** 拖拽移动课程回调 */
  onMoveCourse?: (course: Course, target: DropTarget) => void | Promise<void>;
}

/**
 * 周视图（SPEC 3.5 页面 2 核心视图）
 *
 * 格点模式：7 列 × N 行（节次网格），每格一个课程块
 * 自由模式：7 列纵向时间轴，课程块按时间定位
 */
export function WeekView({
  semesterId,
  semesterStart,
  courses,
  periods,
  overrides,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  onMoveCourse,
}: WeekViewProps) {
  const editMode = useTimelineStore((s) => s.editMode);
  const currentWeek = useTimelineStore((s) => s.currentWeek);

  // 本周 7 天日期（周一到周日）
  const dates = useMemo(
    () => weekDates(semesterStart, currentWeek),
    [semesterStart, currentWeek]
  );

  // 每天的展示课程（合并调课）
  const dayCoursesMap = useMemo(() => {
    const map = new Map<string, DisplayCourse[]>();
    for (const date of dates) {
      const dayOfWeek = getWeekday(date);
      // 过滤当天的 override
      const dayOverrides = overrides.filter((o) => o.date === date);
      const display = resolveDayCourses(
        courses,
        dayOverrides,
        periods,
        dayOfWeek,
        currentWeek
      );
      map.set(date, display);
    }
    return map;
  }, [dates, courses, overrides, periods, currentWeek]);

  // 未提供 onMoveCourse 时不启用拖拽
  if (!onMoveCourse) {
    if (editMode === "grid") {
      return (
        <WeekGridView
          semesterId={semesterId}
          dates={dates}
          periods={periods}
          dayCoursesMap={dayCoursesMap}
          onCourseClick={onCourseClick}
          onCourseLongPress={onCourseLongPress}
          onCellClick={onCellClick}
        />
      );
    }
    return (
      <WeekFreeView
        semesterId={semesterId}
        dates={dates}
        dayCoursesMap={dayCoursesMap}
        onCourseClick={onCourseClick}
        onCourseLongPress={onCourseLongPress}
      />
    );
  }

  // 包裹 DndContext 启用拖拽
  return (
    <TimelineDndContext onMoveCourse={onMoveCourse}>
      {editMode === "grid" ? (
        <WeekGridView
          semesterId={semesterId}
          dates={dates}
          periods={periods}
          dayCoursesMap={dayCoursesMap}
          onCourseClick={onCourseClick}
          onCourseLongPress={onCourseLongPress}
          onCellClick={onCellClick}
          enableDnd
        />
      ) : (
        <WeekFreeView
          semesterId={semesterId}
          dates={dates}
          dayCoursesMap={dayCoursesMap}
          onCourseClick={onCourseClick}
          onCourseLongPress={onCourseLongPress}
          enableDnd
        />
      )}
    </TimelineDndContext>
  );
}

// ============================================================
// 格点模式：节次网格
// ============================================================

interface WeekGridViewProps {
  semesterId: string;
  dates: string[];
  periods: ClassPeriod[];
  dayCoursesMap: Map<string, DisplayCourse[]>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  /** 是否启用拖拽（由父组件根据 onMoveCourse 决定） */
  enableDnd?: boolean;
}

function WeekGridView({
  dates,
  periods,
  dayCoursesMap,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  enableDnd = false,
}: WeekGridViewProps) {
  // 周视图表头：周一(1) 到 周日(0)，dates 已按周一到周日排序
  // dates[0] = 周一，dates[6] = 周日
  const dayHeaders = dates.map((date, i) => {
    const weekday = getWeekday(date); // 0=周日
    // dates[0] 是周一，对应 weekday=1；dates[6] 是周日，对应 weekday=0
    const label = WEEKDAY_SHORT[weekday];
    const today = isToday(date);
    return { date, label, today, key: `header-${i}-${date}` };
  });

  if (periods.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <p className="text-sm">当前学期尚未配置节次时间</p>
        <p className="text-xs">请在学期设置中添加节次定义（如第1节 08:00-08:45）</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-fluent">
      <div className="min-w-[800px]">
        {/* 表头：空格 + 7 天 */}
        <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b bg-card">
          <div className="border-r" />
          {dayHeaders.map(({ date, label, today, key }) => (
            <div
              key={key}
              className={cn(
                "border-r px-2 py-2 text-center text-sm font-medium",
                today && "bg-primary/10 text-primary"
              )}
            >
              <div>{label}</div>
              <div
                className={cn(
                  "text-xs",
                  today ? "text-primary" : "text-muted-foreground"
                )}
              >
                {parseInt(date.slice(8), 10)}
              </div>
            </div>
          ))}
        </div>

        {/* 节次行 */}
        {periods.map((period) => (
          <div
            key={period.id}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0"
          >
            {/* 节次标签 */}
            <div className="flex flex-col items-center justify-center border-r bg-muted/30 px-1 py-1 text-center">
              <span className="text-xs font-medium">
                第{period.period_index}节
              </span>
              <span className="text-[10px] text-muted-foreground">
                {period.start_time}
              </span>
            </div>

            {/* 每天的单元格 */}
            {dates.map((date, dayIdx) => (
              <GridCell
                key={`cell-${dayIdx}-${date}-${period.period_index}`}
                date={date}
                period={period}
                dayCourses={dayCoursesMap.get(date) || []}
                onCourseClick={onCourseClick}
                onCourseLongPress={onCourseLongPress}
                onCellClick={onCellClick}
                enableDnd={enableDnd}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 单个格点单元格（支持拖拽接入） */
function GridCell({
  date,
  period,
  dayCourses,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
  enableDnd,
}: {
  date: string;
  period: ClassPeriod;
  dayCourses: DisplayCourse[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
  enableDnd?: boolean;
}) {
  const cellCourses = dayCourses.filter(
    (c) => c.periodIndex === period.period_index
  );
  const dayOfWeek = getWeekday(date);
  const today = isToday(date);

  // 拖拽目标
  const target: DropTarget = {
    targetId: `cell-${date}-${period.period_index}`,
    dayOfWeek,
    periodIndex: period.period_index,
  };
  const { setDropNodeRef, isOver } = useDroppableCell(target);

  return (
    <div
      ref={enableDnd ? setDropNodeRef : undefined}
      className={cn(
        "group relative min-h-[64px] border-r p-1 transition-colors",
        today && "bg-primary/5",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
        cellCourses.length === 0 && "hover:bg-accent/50 cursor-pointer"
      )}
      onClick={() => {
        if (cellCourses.length === 0) {
          onCellClick?.(dayOfWeek, period.period_index);
        }
      }}
    >
      {cellCourses.map((dc) => (
        <DraggableCourseWrapper
          key={dc.course.id + (dc.isOverride ? "-ov" : "")}
          course={dc.course}
          sourceId={`course-${dc.course.id}-${date}-${period.period_index}`}
          enableDnd={enableDnd && !dc.cancelled && !dc.isOverride}
        >
          <CourseBlock
            course={dc.course}
            startTime={dc.startTime}
            endTime={dc.endTime}
            cancelled={dc.cancelled}
            isOverride={dc.isOverride}
            onClick={onCourseClick}
            onLongPress={onCourseLongPress}
            className="mb-1 last:mb-0"
          />
        </DraggableCourseWrapper>
      ))}
      {cellCourses.length === 0 && (
        <button
          className="absolute inset-1 flex items-center justify-center rounded text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onCellClick?.(dayOfWeek, period.period_index);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** 拖拽包裹器：将普通 CourseBlock 接入 dnd-kit */
function DraggableCourseWrapper({
  course,
  sourceId,
  enableDnd,
  children,
}: {
  course: Course;
  sourceId: string;
  enableDnd: boolean;
  children: React.ReactNode;
}) {
  const { dragAttributes, dragListeners, setNodeRef, isDragging } =
    useDraggableCourse({ course, sourceId });

  if (!enableDnd) {
    return <>{children}</>;
  }

  // 将 dnd 的 ref 与 listeners 注入到子组件
  // React.Children.cloneElement 方式注入 props
  const child = children as React.ReactElement<{
    dragAttributes?: Record<string, unknown>;
    dragListeners?: Record<string, unknown>;
    isDragging?: boolean;
    setNodeRef?: (el: HTMLElement | null) => void;
  }>;
  return React.cloneElement(child, {
    dragAttributes,
    dragListeners,
    isDragging,
    setNodeRef,
  });
}

// ============================================================
// 自由模式：时间轴定位
// ============================================================

interface WeekFreeViewProps {
  semesterId: string;
  dates: string[];
  dayCoursesMap: Map<string, DisplayCourse[]>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  enableDnd?: boolean;
}

function WeekFreeView({
  dates,
  dayCoursesMap,
  onCourseClick,
  onCourseLongPress,
  enableDnd = false,
}: WeekFreeViewProps) {
  // 时间轴范围：7:00 - 22:00（15 小时 = 900 分钟）
  const START_MIN = 7 * 60;
  const END_MIN = 22 * 60;
  const TOTAL_MIN = END_MIN - START_MIN;
  const HOUR_HEIGHT = 48; // 每小时 48px
  const totalHeight = (TOTAL_MIN / 60) * HOUR_HEIGHT;

  const dayHeaders = dates.map((date, i) => {
    const weekday = getWeekday(date);
    const label = WEEKDAY_SHORT[weekday];
    const today = isToday(date);
    return { date, label, today, key: `free-header-${i}-${date}` };
  });

  // 小时刻度线
  const hourMarks = Array.from({ length: TOTAL_MIN / 60 + 1 }, (_, i) => {
    const minutes = START_MIN + i * 60;
    return {
      minutes,
      label: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`,
      top: (i * 60 / 60) * HOUR_HEIGHT,
    };
  });

  return (
    <div className="flex-1 overflow-auto scrollbar-fluent">
      <div className="min-w-[900px]">
        {/* 表头 */}
        <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b bg-card">
          <div className="border-r" />
          {dayHeaders.map(({ date, label, today, key }) => (
            <div
              key={key}
              className={cn(
                "border-r px-2 py-2 text-center text-sm font-medium",
                today && "bg-primary/10 text-primary"
              )}
            >
              <div>{label}</div>
              <div
                className={cn(
                  "text-xs",
                  today ? "text-primary" : "text-muted-foreground"
                )}
              >
                {parseInt(date.slice(8), 10)}
              </div>
            </div>
          ))}
        </div>

        {/* 时间轴主体 */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* 左侧时间刻度列 */}
          <div className="relative border-r bg-muted/30" style={{ height: totalHeight }}>
            {hourMarks.map((m) => (
              <div
                key={m.minutes}
                className="absolute left-0 right-0 border-t border-border/50 px-1 text-[10px] text-muted-foreground"
                style={{ top: m.top }}
              >
                <span className="absolute -top-2 left-1">{m.label}</span>
              </div>
            ))}
          </div>

          {/* 每天的列 */}
          {dates.map((date, dayIdx) => (
            <FreeDayColumn
              key={`free-col-${dayIdx}-${date}`}
              date={date}
              dayCourses={dayCoursesMap.get(date) || []}
              startMin={START_MIN}
              endMin={END_MIN}
              hourHeight={HOUR_HEIGHT}
              totalHeight={totalHeight}
              hourMarks={hourMarks}
              onCourseClick={onCourseClick}
              onCourseLongPress={onCourseLongPress}
              enableDnd={enableDnd}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 自由模式单日列（含拖拽接入） */
function FreeDayColumn({
  date,
  dayCourses,
  startMin,
  endMin,
  hourHeight,
  totalHeight,
  hourMarks,
  onCourseClick,
  onCourseLongPress,
  enableDnd,
}: {
  date: string;
  dayCourses: DisplayCourse[];
  startMin: number;
  endMin: number;
  hourHeight: number;
  totalHeight: number;
  hourMarks: Array<{ minutes: number; label: string; top: number }>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  enableDnd?: boolean;
}) {
  const dayOfWeek = getWeekday(date);
  const today = isToday(date);

  // 自由模式：整列为一个 drop target，drop 时按高度计算时间
  const target: DropTarget = {
    targetId: `free-${date}`,
    dayOfWeek,
    periodIndex: null,
  };
  const { setDropNodeRef, isOver } = useDroppableCell(target);

  return (
    <div
      ref={enableDnd ? setDropNodeRef : undefined}
      className={cn(
        "relative border-r",
        today && "bg-primary/5",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30"
      )}
      style={{ height: totalHeight }}
    >
      {/* 横向刻度线 */}
      {hourMarks.map((m) => (
        <div
          key={m.minutes}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: m.top }}
        />
      ))}

      {/* 课程块（按时间定位） */}
      {dayCourses.map((dc) => {
        const dcStartMin = timeToMinutes(dc.startTime);
        const dcEndMin = timeToMinutes(dc.endTime);
        // 限制在可视范围内
        const clampedStart = Math.max(dcStartMin, startMin);
        const clampedEnd = Math.min(dcEndMin, endMin);
        if (clampedEnd <= clampedStart) return null;

        const top = ((clampedStart - startMin) / 60) * hourHeight;
        const height = ((clampedEnd - clampedStart) / 60) * hourHeight;

        return (
          <div
            key={dc.course.id + (dc.isOverride ? "-ov" : "")}
            className="absolute left-1 right-1"
            style={{ top, height: Math.max(height, 24) }}
          >
            <DraggableCourseWrapper
              course={dc.course}
              sourceId={`course-${dc.course.id}-${date}-free`}
              enableDnd={enableDnd && !dc.cancelled && !dc.isOverride}
            >
              <CourseBlock
                course={dc.course}
                startTime={dc.startTime}
                endTime={dc.endTime}
                cancelled={dc.cancelled}
                isOverride={dc.isOverride}
                onClick={onCourseClick}
                onLongPress={onCourseLongPress}
              />
            </DraggableCourseWrapper>
          </div>
        );
      })}
    </div>
  );
}
