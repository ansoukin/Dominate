import { useEffect, useRef, useState, useCallback } from "react";

/**
 * 长按 hook（SPEC 3.5 页面 2：长按课程块 500ms 弹出操作菜单）
 *
 * 触屏无右键，统一用长按替代。同时支持鼠标与触摸：
 * - 鼠标：mousedown 开始计时，mouseup/mouseleave 取消
 * - 触摸：touchstart 开始计时，touchend/touchmove 取消
 *
 * @param duration 长按持续时间（毫秒），默认 500
 * @returns { onPointerDown, onPointerUp, onPointerLeave, isLongPress }
 */
export function useLongPress(
  onLongPress: () => void,
  duration = 500
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsLongPress(true);
      onLongPress();
    }, duration);
  }, [onLongPress, duration, clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    setIsLongPress(false);
  }, [clearTimer]);

  // 卸载时清理
  useEffect(() => clearTimer, [clearTimer]);

  return {
    isLongPress,
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
