import { useState, useRef, useEffect } from "react";

const normSel = (r1, c1, r2, c2) => ({
  r1: Math.min(r1, r2),
  r2: Math.max(r1, r2),
  c1: Math.min(c1, c2),
  c2: Math.max(c1, c2),
});

export function useCellSelection(editingRef) {
  const [selection, setSelection] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const selStartRef = useRef(selStart);
  const cellTouchRef = useRef(null); // { r, c, x, y } タッチ開始情報
  const longPressTimerRef = useRef(null);
  const selDragActiveRef = useRef(false); // 長押しドラッグ中フラグ

  useEffect(() => {
    selStartRef.current = selStart;
  }, [selStart]);

  const onCellDown = (r, c, e) => {
    if (editingRef.current?.r === r && editingRef.current?.c === c) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && selection) {
      setSelection(normSel(selection.r1, selection.c1, r, c));
    } else {
      setSelStart({ r, c });
      setSelection(normSel(r, c, r, c));
    }
  };

  const onCellTouchStart = (r, c, e) => {
    if (editingRef.current?.r === r && editingRef.current?.c === c) return;
    const t = e.touches[0];
    cellTouchRef.current = { r, c, x: t.clientX, y: t.clientY };
    selDragActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      // 長押し成立 → ドラッグ選択モード開始
      selDragActiveRef.current = true;
      setSelStart({ r, c });
      setSelection(normSel(r, c, r, c));
    }, 400);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!cellTouchRef.current) return;
      const t = e.touches[0];
      if (selDragActiveRef.current) {
        // ドラッグ選択モード：スクロールを抑止して選択範囲を拡張
        if (e.cancelable) e.preventDefault();
        const cell = document
          .elementFromPoint(t.clientX, t.clientY)
          ?.closest("[data-row]");
        if (cell && selStartRef.current) {
          const { r: sr, c: sc } = selStartRef.current;
          setSelection(normSel(sr, sc, +cell.dataset.row, +cell.dataset.col));
        }
      } else if (
        Math.hypot(
          t.clientX - cellTouchRef.current.x,
          t.clientY - cellTouchRef.current.y,
        ) > 10
      ) {
        // スクロール検知 → 長押しタイマーをキャンセル
        clearTimeout(longPressTimerRef.current);
        cellTouchRef.current = null;
      }
    };
    const onEnd = () => {
      clearTimeout(longPressTimerRef.current);
      if (!selDragActiveRef.current && cellTouchRef.current) {
        // タップ → シングル選択
        const { r, c } = cellTouchRef.current;
        setSelection(normSel(r, c, r, c));
      }
      if (selDragActiveRef.current) setSelStart(null);
      cellTouchRef.current = null;
      selDragActiveRef.current = false;
    };
    const onCancel = () => {
      clearTimeout(longPressTimerRef.current);
      cellTouchRef.current = null;
      selDragActiveRef.current = false;
      setSelStart(null);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onCancel);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
    // eslint-disable-next-line
  }, []);

  const onCellEnter = (r, c) => {
    if (!selStart) return;
    setSelection(normSel(selStart.r, selStart.c, r, c));
  };

  // マウスドラッグ選択の終了
  useEffect(() => {
    if (!selStart) return;
    const up = () => setSelStart(null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [selStart]);

  return {
    selection,
    setSelection,
    selStart,
    onCellDown,
    onCellTouchStart,
    onCellEnter,
  };
}
