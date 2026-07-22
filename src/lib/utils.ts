import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui 标准的 className 合并工具
 * 合并 clsx 条件类名与 tailwind-merge 去重
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
