import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Course, ScheduleOverride } from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { CourseBlock } from "./CourseBlock";
import {
  MONTH_LABELS,
  WEEKDAY_SHORT,
  getWeekday,
  isToday,
  monthGrid,
  resolveDayCourses,
  toIsoDate,
  weekOfDate,
} from "./utils";

interface MonthViewProps {
  semesterId: string;
  semesterStart: string;
  totalWeeks: number;
  courses: Course[];
  /** 节次定义（月视图只需判断当天是否有课，不显示具体时间） */
  overrides: ScheduleOverride[];
  onCourseClick?: (course: Course) => void;
  onCourseLongPress?: (course: Course) => void;
  /** 点击某天 → 跳转日视图 */
  onDayClick?: (date: string) => void;
}

/**
 * 月视图（SPEC 3.5 页面 2）
 *
 * 月历网格，每个日期格显示当日课程指示（紧凑课程块）。
 * 点击日期 → 跳转日视图查看详情。
 */
export function MonthView({
  semesterId,
  semesterStart,
  totalWeeks,
  courses,
  overrides,
  onCourseClick,
  onCourseLongPress,
  onDayClick,
}: MonthViewProps) {
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setView = useTimelineStore((s) => s.setView);
  const setCurrentWeek = useTimelineStore((s) => s.setCurrentWeek);

  // 月视图内部维护当前显示的年月（独立于周次导航）
  const initial = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const grid = useMemo(
    () => monthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToday() {
    const today = toIsoDate(new Date());
    const d = new Date(today + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  }

  function handleDayClick(date: string) {
    setSelectedDate(date);
    // 同步周次（若日期在学期内）
    const week = weekOfDate(date, semesterStart, totalWeeks);
    setCurrentWeek(week);
    onDayClick?.(date);
    setView("day");
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 月份导航 */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {viewYear} 年 {MONTH_LABELS[viewMonth]}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="h-8"
          >
            今天
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={prevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {WEEKDAY_SHORT.map((label, i) => (
          <div
            key={i}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日历网格 */}
      <div className="grid flex-1 grid-cols-7 overflow-auto scrollbar-fluent">
        {grid.map((date) => {
          const d = new Date(date + "T00:00:00");
          const isCurrentMonth = d.getMonth() === viewMonth;
          const today = isToday(date);
          const dayOfWeek = getWeekday(date);
          const week = weekOfDate(date, semesterStart, totalWeeks);
          const dayOverrides = overrides.filter((o) => o.date === date);
          // 月视图不传 periods，仅判断有无课程
          const dayCourses = resolveDayCourses(
            courses,
            dayOverrides,
            [],
            dayOfWeek,
            week
          ).filter((c) => !c.cancelled);

          return (
            <div
              key={date}
              onClick={() => handleDayClick(date)}
              className={cn(
                "min-h-[96px] cursor-pointer border-r border-b p-1 transition-colors hover:bg-accent/40",
                !isCurrentMonth && "bg-muted/20 opacity-50",
                today && "bg-primary/5 ring-1 ring-inset ring-primary/30"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  today
                    ? "bg-primary text-primary-foreground"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayCourses.slice(0, 3).map((dc) => (
                  <CourseBlock
                    key={dc.course.id + (dc.isOverride ? "-ov" : "")}
                    course={dc.course}
                    startTime={dc.startTime}
                    endTime={dc.endTime}
                    cancelled={dc.cancelled}
                    isOverride={dc.isOverride}
                    onClick={onCourseClick}
                    onLongPress={onCourseLongPress}
                    compact
                  />
                ))}
                {dayCourses.length > 3 && (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    +{dayCourses.length - 3} 门
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
