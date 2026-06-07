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
  const cellTouchRef = useRef(null);

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
  };

  // タップ検知：スクロール（10px超移動）でキャンセル、指を離したら選択
  useEffect(() => {
    const onMove = (e) => {
      if (!cellTouchRef.current) return;
      const t = e.touches[0];
      if (
        Math.hypot(
          t.clientX - cellTouchRef.current.x,
          t.clientY - cellTouchRef.current.y,
        ) > 10
      ) {
        cellTouchRef.current = null;
      }
    };
    const onEnd = () => {
      if (cellTouchRef.current) {
        const { r, c } = cellTouchRef.current;
        setSelection(normSel(r, c, r, c));
      }
      cellTouchRef.current = null;
    };
    const onCancel = () => {
      cellTouchRef.current = null;
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onCancel);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, []);

  const onCellEnter = (r, c) => {
    if (!selStart) return;
    setSelection(normSel(selStart.r, selStart.c, r, c));
  };

  // 選択拡張（マウス解放 / タッチスワイプ）
  useEffect(() => {
    if (!selStart) return;
    const up = () => setSelStart(null);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    const onTouch = (e) => {
      if (!selStartRef.current) return;
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      const cell = document
        .elementFromPoint(t.clientX, t.clientY)
        ?.closest("[data-row]");
      if (cell) {
        const { r: sr, c: sc } = selStartRef.current;
        setSelection(normSel(sr, sc, +cell.dataset.row, +cell.dataset.col));
      }
    };
    window.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchmove", onTouch);
    };
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
