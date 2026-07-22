import { useMemo } from "react";
import { Plus, CalendarX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Course, ScheduleOverride, ClassPeriod } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { CourseBlock } from "./CourseBlock";
import {
  WEEKDAY_LABELS,
  getWeekday,
  isToday,
  resolveDayCourses,
  timeToMinutes,
  weekDates,
} from "./utils";

interface DayViewProps {
  semesterId: string;
  semesterStart: string;
  courses: Course[];
  periods: ClassPeriod[];
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
}

/**
 * 日视图（SPEC 3.5 页面 2）
 *
 * 单日时间轴列表，左侧节次/时间，右侧课程详情。
 * 支持格点模式（按节次分行）与自由模式（按时间定位）。
 */
export function DayView({
  semesterId,
  semesterStart,
  courses,
  periods,
  overrides,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
}: DayViewProps) {
  const editMode = useTimelineStore((s) => s.editMode);
  const currentWeek = useTimelineStore((s) => s.currentWeek);
  const selectedDate = useTimelineStore((s) => s.selectedDate);

  // 当前周日期列表，用于定位选中日是否在本周
  const weekDateList = useMemo(
    () => weekDates(semesterStart, currentWeek),
    [semesterStart, currentWeek]
  );

  // selectedDate 应对应当前周的某一天（由 TimelineToolbar 切换周次时同步）
  // 这里取 selectedDate 的星期几，并从 weekDateList 中取对应日期
  const dayOfWeek = getWeekday(selectedDate);
  // 周一(1) → weekDateList[0]，周日(0) → weekDateList[6]
  const dateIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const displayDate = weekDateList[dateIndex] ?? selectedDate;

  const dayOverrides = useMemo(
    () => overrides.filter((o) => o.date === displayDate),
    [overrides, displayDate]
  );

  const displayCourses = useMemo(
    () =>
      resolveDayCourses(
        courses,
        dayOverrides,
        periods,
        dayOfWeek,
        currentWeek
      ),
    [courses, dayOverrides, periods, dayOfWeek, currentWeek]
  );

  const today = isToday(displayDate);

  if (displayCourses.length === 0 && editMode === "grid" && periods.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <CalendarX className="h-10 w-10 opacity-40" />
        <p className="text-sm">当前学期尚未配置节次时间</p>
        <p className="text-xs">请在学期设置中添加节次定义</p>
      </div>
    );
  }

  if (editMode === "grid") {
    return (
      <DayGridView
        displayDate={displayDate}
        dayOfWeek={dayOfWeek}
        today={today}
        periods={periods}
        displayCourses={displayCourses}
        onCourseClick={onCourseClick}
        onCourseLongPress={onCourseLongPress}
        onCellClick={onCellClick}
      />
    );
  }

  return (
    <DayFreeView
      displayDate={displayDate}
      dayOfWeek={dayOfWeek}
      today={today}
      displayCourses={displayCourses}
      onCourseClick={onCourseClick}
      onCourseLongPress={onCourseLongPress}
    />
  );
}

// ============================================================
// 格点模式
// ============================================================

interface DayGridViewProps {
  displayDate: string;
  dayOfWeek: number;
  today: boolean;
  periods: ClassPeriod[];
  displayCourses: ReturnType<typeof resolveDayCourses>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  onCellClick?: (dayOfWeek: number, periodIndex: number | null) => void;
}

function DayGridView({
  displayDate,
  dayOfWeek,
  today,
  periods,
  displayCourses,
  onCourseClick,
  onCourseLongPress,
  onCellClick,
}: DayGridViewProps) {
  return (
    <div className="flex-1 overflow-auto scrollbar-fluent">
      <div className="mx-auto max-w-3xl p-6">
        {/* 日期标题 */}
        <div className="mb-4 flex items-baseline gap-2">
          <h2
            className={cn(
              "text-lg font-semibold",
              today && "text-primary"
            )}
          >
            {displayDate}
          </h2>
          <span className="text-sm text-muted-foreground">
            {WEEKDAY_LABELS[dayOfWeek]}
            {today && " · 今天"}
          </span>
        </div>

        {periods.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            暂无节次配置
          </div>
        ) : (
          <div className="space-y-2">
            {periods.map((period) => {
              const cellCourses = displayCourses.filter(
                (c) => c.periodIndex === period.period_index
              );
              return (
                <div
                  key={period.id}
                  className="grid grid-cols-[120px_1fr] gap-3"
                >
                  {/* 节次标签 */}
                  <div className="flex flex-col justify-center rounded-md bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium">
                      第{period.period_index}节
                      {period.label && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {period.label}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {period.start_time} - {period.end_time}
                    </span>
                  </div>

                  {/* 课程块 / 空格 */}
                  <div
                    className={cn(
                      "min-h-[64px] rounded-md border p-1",
                      cellCourses.length === 0 &&
                        "border-dashed cursor-pointer hover:bg-accent/50"
                    )}
                    onClick={() => {
                      if (cellCourses.length === 0) {
                        onCellClick?.(dayOfWeek, period.period_index);
                      }
                    }}
                  >
                    {cellCourses.length === 0 ? (
                      <button
                        className="flex h-full w-full items-center justify-center text-muted-foreground/40 hover:text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCellClick?.(dayOfWeek, period.period_index);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      cellCourses.map((dc) => (
                        <CourseBlock
                          key={dc.course.id + (dc.isOverride ? "-ov" : "")}
                          course={dc.course}
                          startTime={dc.startTime}
                          endTime={dc.endTime}
                          cancelled={dc.cancelled}
                          isOverride={dc.isOverride}
                          onClick={onCourseClick}
                          onLongPress={onCourseLongPress}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 自由模式
// ============================================================

interface DayFreeViewProps {
  displayDate: string;
  dayOfWeek: number;
  today: boolean;
  displayCourses: ReturnType<typeof resolveDayCourses>;
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
}

function DayFreeView({
  displayDate,
  dayOfWeek,
  today,
  displayCourses,
  onCourseClick,
  onCourseLongPress,
}: DayFreeViewProps) {
  const START_MIN = 7 * 60;
  const END_MIN = 22 * 60;
  const TOTAL_MIN = END_MIN - START_MIN;
  const HOUR_HEIGHT = 56;
  const totalHeight = (TOTAL_MIN / 60) * HOUR_HEIGHT;

  const hourMarks = Array.from({ length: TOTAL_MIN / 60 + 1 }, (_, i) => ({
    minutes: START_MIN + i * 60,
    label: `${String(Math.floor((START_MIN + i * 60) / 60)).padStart(2, "0")}:00`,
    top: i * HOUR_HEIGHT,
  }));

  return (
    <div className="flex-1 overflow-auto scrollbar-fluent">
      <div className="mx-auto max-w-2xl p-6">
        {/* 日期标题 */}
        <div className="mb-4 flex items-baseline gap-2">
          <h2
            className={cn(
              "text-lg font-semibold",
              today && "text-primary"
            )}
          >
            {displayDate}
          </h2>
          <span className="text-sm text-muted-foreground">
            {WEEKDAY_LABELS[dayOfWeek]}
            {today && " · 今天"}
          </span>
        </div>

        {displayCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center text-muted-foreground">
            <CalendarX className="h-8 w-8 opacity-40" />
            <p className="text-sm">今日无课程</p>
          </div>
        ) : (
          <div className="relative" style={{ height: totalHeight }}>
            {/* 时间刻度 */}
            {hourMarks.map((m) => (
              <div
                key={m.minutes}
                className="absolute left-0 right-0 border-t border-border/40"
                style={{ top: m.top }}
              >
                <span className="absolute -top-2 left-0 bg-card px-1 text-xs text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}

            {/* 课程块 */}
            {displayCourses.map((dc) => {
              const startMin = timeToMinutes(dc.startTime);
              const endMin = timeToMinutes(dc.endTime);
              const clampedStart = Math.max(startMin, START_MIN);
              const clampedEnd = Math.min(endMin, END_MIN);
              if (clampedEnd <= clampedStart) return null;

              const top = ((clampedStart - START_MIN) / 60) * HOUR_HEIGHT;
              const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;

              return (
                <div
                  key={dc.course.id + (dc.isOverride ? "-ov" : "")}
                  className="absolute left-20 right-0"
                  style={{ top, height: Math.max(height, 32) }}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
