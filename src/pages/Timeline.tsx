import { useEffect, useState, useCallback } from "react";
import { CalendarDays, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  semesterCommands,
  classPeriodCommands,
  courseCommands,
  overrideCommands,
  type Semester,
  type ClassPeriod,
  type Course,
  type ScheduleOverride,
  type OverrideType,
} from "@/lib/tauri";
import { useTimelineStore } from "@/stores/timeline";
import { TimelineToolbar } from "./timeline/TimelineToolbar";
import { WeekView } from "./timeline/WeekView";
import { DayView } from "./timeline/DayView";
import { MonthView } from "./timeline/MonthView";
import type { DropTarget } from "./timeline/TimelineDndContext";
import { CourseFormDialog } from "./timeline/CourseFormDialog";
import { CourseActionMenu, type CourseActionMenuPosition } from "./timeline/CourseActionMenu";
import { OverrideDialog } from "./timeline/OverrideDialog";
import { todayIso } from "./timeline/utils";

/**
 * 时间轴页面（SPEC 3.5 页面 2）
 *
 * 三视图：日 / 周 / 月
 * 拖拽模式：格点 / 自由
 * 长按 500ms 弹出操作菜单（触屏无右键）
 * 临时调课（不修改常规课表）
 * 多周课表（学期制）
 */
export default function TimelinePage() {
  const view = useTimelineStore((s) => s.view);
  const activeSemesterId = useTimelineStore((s) => s.activeSemesterId);
  const setActiveSemester = useTimelineStore((s) => s.setActiveSemester);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 对话框 / 菜单状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formDefaultDay, setFormDefaultDay] = useState<number>(1);
  const [formDefaultPeriod, setFormDefaultPeriod] = useState<number | null>(null);

  const [menuPosition, setMenuPosition] = useState<CourseActionMenuPosition | null>(null);
  const [menuCourse, setMenuCourse] = useState<Course | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideType, setOverrideType] = useState<OverrideType>("cancel");
  const [overrideCourse, setOverrideCourse] = useState<Course | null>(null);

  // 加载学期列表 + 激活学期
  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setError(null);
    try {
      const list = await semesterCommands.list();
      setSemesters(list);
      // 若 store 中无选中学期，优先取 is_active 或第一个
      if (!activeSemesterId && list.length > 0) {
        const active = list.find((s) => s.is_active) ?? list[0];
        setActiveSemester(active.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSemestersLoading(false);
    }
  }, [activeSemesterId, setActiveSemester]);

  // 加载学期相关数据（节次/课程/调课）
  const loadSemesterData = useCallback(async (semesterId: string) => {
    setDataLoading(true);
    setError(null);
    try {
      const [periodsData, coursesData, overridesData] = await Promise.all([
        classPeriodCommands.list(semesterId),
        courseCommands.list(semesterId),
        overrideCommands.list(semesterId),
      ]);
      setPeriods(periodsData);
      setCourses(coursesData);
      setOverrides(overridesData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (activeSemesterId) {
      loadSemesterData(activeSemesterId);
    } else {
      // 无选中学期时清空数据
      setPeriods([]);
      setCourses([]);
      setOverrides([]);
    }
  }, [activeSemesterId, loadSemesterData]);

  const activeSemester = semesters.find((s) => s.id === activeSemesterId);
  const totalWeeks = activeSemester?.total_weeks ?? 1;

  function handleRefresh() {
    loadSemesters();
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }

  // 点击课程 → 打开编辑表单
  const handleCourseClick = useCallback((course: Course) => {
    setEditingCourse(course);
    setFormDefaultDay(course.day_of_week);
    setFormDefaultPeriod(course.period_index);
    setFormOpen(true);
  }, []);

  // 点击空格 → 打开新建表单
  const handleCellClick = useCallback(
    (dayOfWeek: number, periodIndex: number | null) => {
      setEditingCourse(null);
      setFormDefaultDay(dayOfWeek);
      setFormDefaultPeriod(periodIndex);
      setFormOpen(true);
    },
    []
  );

  // 长按课程 → 弹出操作菜单（SPEC 3.5：触屏无右键）
  const handleCourseLongPress = useCallback(
    (course: Course) => {
      // 使用最后触发事件的坐标（长按 hook 无法直接传坐标，取屏幕中央作为兜底）
      // 实际场景中 pointer event 已在 CourseBlock 内消费，这里用视口中央
      const x = window.innerWidth / 2 - 90;
      const y = window.innerHeight / 2 - 100;
      setMenuPosition({ x, y });
      setMenuCourse(course);
    },
    []
  );

  // 表单保存成功 → 刷新数据
  const handleFormSaved = useCallback(() => {
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }, [activeSemesterId, loadSemesterData]);

  // 菜单动作：编辑
  const handleMenuEdit = useCallback(
    (course: Course) => {
      setEditingCourse(course);
      setFormDefaultDay(course.day_of_week);
      setFormDefaultPeriod(course.period_index);
      setFormOpen(true);
    },
    []
  );

  // 菜单动作：复制（打开新建表单，预填原课程数据）
  const handleMenuDuplicate = useCallback(
    (course: Course) => {
      // 复制：新建一个相同属性的课程，用表单预填
      const duplicated: Course = {
        ...course,
        id: "", // 空 ID 表示新建
      };
      setEditingCourse(duplicated);
      setFormDefaultDay(course.day_of_week);
      setFormDefaultPeriod(course.period_index);
      setFormOpen(true);
    },
    []
  );

  // 菜单动作：临时取消当天
  const handleMenuCancelOccurrence = useCallback(
    (course: Course) => {
      setOverrideCourse(course);
      setOverrideType("cancel");
      setOverrideOpen(true);
    },
    []
  );

  // 菜单动作：临时调整当天
  const handleMenuMoveOccurrence = useCallback(
    (course: Course) => {
      setOverrideCourse(course);
      setOverrideType("move");
      setOverrideOpen(true);
    },
    []
  );

  // 菜单动作：永久删除
  const handleMenuDelete = useCallback(
    async (course: Course) => {
      if (!confirm(`确定永久删除「${course.subject_name}」？此操作不可撤销。`)) return;
      try {
        await courseCommands.delete(course.id);
        if (activeSemesterId) await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  // 调课保存成功 → 刷新数据
  const handleOverrideSaved = useCallback(() => {
    if (activeSemesterId) loadSemesterData(activeSemesterId);
  }, [activeSemesterId, loadSemesterData]);

  /**
   * 拖拽移动课程（SPEC 3.5：拖拽编辑）
   *
   * 格点模式：更新 day_of_week + period_index，清空 start/end_time
   * 自由模式：更新 day_of_week + start/end_time，清空 period_index
   */
  const handleMoveCourse = useCallback(
    async (course: Course, target: DropTarget) => {
      try {
        if (target.periodIndex !== null && target.periodIndex !== undefined) {
          // 格点模式 drop
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: target.periodIndex,
            start_time: null,
            end_time: null,
          });
        } else if (target.startTime && target.endTime) {
          // 自由模式 drop（带明确时间）
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: null,
            start_time: target.startTime,
            end_time: target.endTime,
          });
        } else {
          // 自由模式 drop 到列（无明确时间，保留原时长，仅换日）
          const origStart = course.start_time || "08:00";
          const origEnd = course.end_time || "08:45";
          await courseCommands.update(course.id, {
            day_of_week: target.dayOfWeek,
            period_index: null,
            start_time: origStart,
            end_time: origEnd,
          });
        }
        // 刷新数据
        if (activeSemesterId) await loadSemesterData(activeSemesterId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeSemesterId, loadSemesterData]
  );

  function renderView() {
    if (!activeSemester) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <CalendarDays className="h-12 w-12 opacity-30" />
          <p className="text-sm">
            {semestersLoading ? "加载学期中..." : "暂无学期，请先创建学期"}
          </p>
        </div>
      );
    }

    if (dataLoading) {
      return (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载课程数据...
        </div>
      );
    }

    switch (view) {
      case "week":
        return (
          <WeekView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
            onCellClick={handleCellClick}
            onMoveCourse={handleMoveCourse}
          />
        );
      case "day":
        return (
          <DayView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            courses={courses}
            periods={periods}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
            onCellClick={handleCellClick}
          />
        );
      case "month":
        return (
          <MonthView
            semesterId={activeSemester.id}
            semesterStart={activeSemester.start_date}
            totalWeeks={totalWeeks}
            courses={courses}
            overrides={overrides}
            onCourseClick={handleCourseClick}
            onCourseLongPress={handleCourseLongPress}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 页面标题栏 */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">时间轴</h1>
            <p className="text-xs text-muted-foreground">
              日 / 周 / 月三视图 · 拖拽编辑 · 多周课表
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-9">
          刷新
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">数据加载失败：{error}</span>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            重试
          </Button>
        </div>
      )}

      {/* 工具栏（视图/模式/学期/周次切换） */}
      <TimelineToolbar
        semesters={semesters}
        semestersLoading={semestersLoading}
        totalWeeks={totalWeeks}
      />

      {/* 视图主体 */}
      {renderView()}

      {/* 课程新建/编辑表单 */}
      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editingCourse && editingCourse.id ? editingCourse : null}
        semesterId={activeSemesterId ?? ""}
        periods={periods}
        defaultDayOfWeek={formDefaultDay}
        defaultPeriodIndex={formDefaultPeriod}
        onSaved={handleFormSaved}
      />

      {/* 长按操作菜单 */}
      <CourseActionMenu
        position={menuPosition}
        course={menuCourse}
        onClose={() => {
          setMenuPosition(null);
          setMenuCourse(null);
        }}
        onEdit={handleMenuEdit}
        onDuplicate={handleMenuDuplicate}
        onCancelOccurrence={handleMenuCancelOccurrence}
        onMoveOccurrence={handleMenuMoveOccurrence}
        onDelete={handleMenuDelete}
      />

      {/* 临时调课对话框 */}
      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        course={overrideCourse}
        semesterId={activeSemesterId ?? ""}
        periods={periods}
        defaultDate={todayIso()}
        type={overrideType}
        onSaved={handleOverrideSaved}
      />
    </div>
  );
}
