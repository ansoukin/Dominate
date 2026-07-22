import { create } from "zustand";

/**
 * 时间轴视图模式（SPEC 3.5 页面 2）
 * - day：日视图
 * - week：周视图（节次网格，默认）
 * - month：月视图
 */
export type TimelineView = "day" | "week" | "month";

/**
 * 拖拽编辑模式（SPEC 3.5 页面 2）
 * - grid：节次格点模式（默认，结构化）
 * - free：自由模式（任意时间）
 */
export type TimelineEditMode = "grid" | "free";

interface TimelineState {
  /** 当前视图 */
  view: TimelineView;
  /** 拖拽编辑模式 */
  editMode: TimelineEditMode;
  /** 当前选中的学期 ID */
  activeSemesterId: string | null;
  /** 当前周次（1-based，学期内第几周） */
  currentWeek: number;
  /** 选中日期（ISO "2026-07-22"），日视图/月视图聚焦用 */
  selectedDate: string;

  setView: (view: TimelineView) => void;
  setEditMode: (mode: TimelineEditMode) => void;
  setActiveSemester: (id: string | null) => void;
  setCurrentWeek: (week: number) => void;
  setSelectedDate: (date: string) => void;
  /** 周次往前一周（不低于 1） */
  prevWeek: () => void;
  /** 周次往后一周（不超过 totalWeeks，由调用方传入） */
  nextWeek: (totalWeeks: number) => void;
}

/** 今日 ISO 日期（本地时区） */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  view: "week",
  editMode: "grid",
  activeSemesterId: null,
  currentWeek: 1,
  selectedDate: todayIso(),

  setView: (view) => set({ view }),
  setEditMode: (editMode) => set({ editMode }),
  setActiveSemester: (activeSemesterId) => set({ activeSemesterId }),
  setCurrentWeek: (currentWeek) => set({ currentWeek }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  prevWeek: () => set((s) => ({ currentWeek: Math.max(1, s.currentWeek - 1) })),
  nextWeek: (totalWeeks) =>
    set((s) => ({ currentWeek: Math.min(totalWeeks, s.currentWeek + 1) })),
}));
