import { create } from "zustand";

/**
 * 应用页面标识
 *
 * 对应 SPEC 3.3 侧边栏 5 项导航：
 * 首页 / 时间轴 / 快捷指令 / 性能优化 / 设置
 */
export type PageId =
  | "home"
  | "timeline"
  | "quick-actions"
  | "performance"
  | "settings";

interface AppState {
  /** 当前激活的页面 */
  currentPage: PageId;
  /** 侧边栏是否折叠（SPEC 3.3：可折叠） */
  sidebarCollapsed: boolean;

  /** 切换页面 */
  setPage: (page: PageId) => void;
  /** 切换侧边栏折叠状态 */
  toggleSidebar: () => void;
  /** 设置侧边栏折叠状态 */
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "home",
  sidebarCollapsed: false,

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),
}));
