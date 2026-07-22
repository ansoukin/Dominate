import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  Clock,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Semester } from "@/lib/tauri";
import {
  useTimelineStore,
  type TimelineEditMode,
  type TimelineView,
} from "@/stores/timeline";
import {
  WEEKDAY_LABELS,
  getWeekday,
  isToday,
  weekStartDate,
} from "./utils";

interface TimelineToolbarProps {
  semesters: Semester[];
  semestersLoading: boolean;
  totalWeeks: number;
  /** 周次变化时重新加载 */
  onSemesterChange?: (id: string) => void;
}

/**
 * 时间轴顶部工具栏
 *
 * 三大切换器：
 * 1. 学期切换（SPEC：多周课表，通过侧边栏按钮切换学期）
 * 2. 视图切换（日 / 周 / 月）
 * 3. 拖拽模式切换（格点 / 自由）
 *
 * 周次导航：上一周 / 下一周 + 当前周显示
 */
export function TimelineToolbar({
  semesters,
  semestersLoading,
  totalWeeks,
  onSemesterChange,
}: TimelineToolbarProps) {
  const view = useTimelineStore((s) => s.view);
  const editMode = useTimelineStore((s) => s.editMode);
  const activeSemesterId = useTimelineStore((s) => s.activeSemesterId);
  const currentWeek = useTimelineStore((s) => s.currentWeek);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const setView = useTimelineStore((s) => s.setView);
  const setEditMode = useTimelineStore((s) => s.setEditMode);
  const setActiveSemester = useTimelineStore((s) => s.setActiveSemester);
  const setCurrentWeek = useTimelineStore((s) => s.setCurrentWeek);
  const prevWeek = useTimelineStore((s) => s.prevWeek);
  const nextWeek = useTimelineStore((s) => s.nextWeek);

  const activeSemester = semesters.find((s) => s.id === activeSemesterId);

  function handleSemesterChange(id: string) {
    setActiveSemester(id);
    setCurrentWeek(1);
    onSemesterChange?.(id);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-card/50 px-6 py-3">
      {/* 学期切换 */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {semestersLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : semesters.length === 0 ? (
          <span className="text-sm text-muted-foreground">暂无学期</span>
        ) : (
          <select
            value={activeSemesterId ?? ""}
            onChange={(e) => handleSemesterChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? " · 当前" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* 视图切换：日 / 周 / 月 */}
      <div className="flex items-center rounded-md border bg-background p-0.5">
        {(["day", "week", "month"] as TimelineView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "h-8 rounded px-3 text-sm font-medium transition-colors",
              view === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "day" ? "日" : v === "week" ? "周" : "月"}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* 拖拽模式切换：格点 / 自由 */}
      <div className="flex items-center rounded-md border bg-background p-0.5">
        <button
          onClick={() => setEditMode("grid")}
          className={cn(
            "flex h-8 items-center gap-1 rounded px-3 text-sm font-medium transition-colors",
            editMode === "grid"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="节次格点模式（结构化）"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          格点
        </button>
        <button
          onClick={() => setEditMode("free")}
          className={cn(
            "flex h-8 items-center gap-1 rounded px-3 text-sm font-medium transition-colors",
            editMode === "free"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          title="自由模式（任意时间）"
        >
          <Clock className="h-3.5 w-3.5" />
          自由
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* 周次导航（仅周/日视图显示） */}
        {view !== "month" && activeSemester && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={prevWeek}
              disabled={currentWeek <= 1}
              title="上一周"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm font-medium">
              第 {currentWeek} 周
              {view === "day" && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {WEEKDAY_LABELS[getWeekday(selectedDate)]}
                  {isToday(selectedDate) ? " · 今天" : ""}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => nextWeek(totalWeeks)}
              disabled={currentWeek >= totalWeeks}
              title="下一周"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* 周视图下的周起始日期提示 */}
        {view === "week" && activeSemester && (
          <span className="text-xs text-muted-foreground">
            起始 {weekStartDate(activeSemester.start_date, currentWeek)}
          </span>
        )}
      </div>
    </div>
  );
}
