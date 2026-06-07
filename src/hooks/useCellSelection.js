import { useState, useRef, useEffect } from "react";

export const selKey = (r, c) => `${r},${c}`;

const addRect = (base, r1, c1, r2, c2) => {
  const next = new Set(base);
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      next.add(selKey(r, c));
  return next;
};

export function useCellSelection(editingRef) {
  const [selection, _setSelection] = useState(null); // null | Set<"r,c">
  const [selStart, setSelStart] = useState(null);
  const selRef = useRef(null); // mirrors selection to avoid stale closure
  const selStartRef = useRef(null);
  const timerRef = useRef(null);
  const touchStartRef = useRef(null); // { r, c, x, y }
  const preDragRef = useRef(null); // selection snapshot at drag start

  const setSelection = (val) => {
    const next = typeof val === "function" ? val(selRef.current) : val;
    selRef.current = next;
    _setSelection(next);
  };

  // always-on: touch を一元管理（race condition 回避）
  useEffect(() => {
    const onMove = (e) => {
      // 長押し待機中: 10px 以上動いたらキャンセル
      if (touchStartRef.current) {
        const t = e.touches[0];
        if (
          Math.hypot(
            t.clientX - touchStartRef.current.x,
            t.clientY - touchStartRef.current.y,
          ) > 10
        ) {
          clearTimeout(timerRef.current);
          touchStartRef.current = null;
        }
      }
      // 選択ドラッグ中: pre-drag ベース + アンカーから指下セルの矩形を追加
      if (selStartRef.current) {
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        const cell = document
          .elementFromPoint(t.clientX, t.clientY)
          ?.closest("[data-row]");
        if (cell) {
          const dr = +cell.dataset.row;
          const dc = +cell.dataset.col;
          const { r: sr, c: sc } = selStartRef.current;
          setSelection(
            addRect(preDragRef.current ?? new Set(), sr, sc, dr, dc),
          );
        }
      }
    };
    const onEnd = () => {
      clearTimeout(timerRef.current);
      // 既存選択あり＋タップ（長押しなし・移動なし）→ そのセルを追加
      if (touchStartRef.current && selRef.current) {
        const { r, c } = touchStartRef.current;
        setSelection(addRect(selRef.current, r, c, r, c));
      }
      touchStartRef.current = null;
      selStartRef.current = null;
      preDragRef.current = null;
      setSelStart(null);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []); // eslint-disable-line

  // マウス解放で選択確定
  useEffect(() => {
    if (!selStart) return;
    const up = () => {
      selStartRef.current = null;
      preDragRef.current = null;
      setSelStart(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [selStart]);

  const onCellDown = (r, c, e) => {
    if (editingRef.current?.r === r && editingRef.current?.c === c) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && selStartRef.current) {
      const { r: sr, c: sc } = selStartRef.current;
      setSelection(addRect(new Set(), sr, sc, r, c));
    } else {
      selStartRef.current = { r, c };
      setSelStart({ r, c });
      setSelection(new Set([selKey(r, c)]));
    }
  };

  const onCellTouchStart = (r, c, e) => {
    if (editingRef.current?.r === r && editingRef.current?.c === c) return;
    const t = e.touches[0];
    touchStartRef.current = { r, c, x: t.clientX, y: t.clientY };
    timerRef.current = setTimeout(() => {
      touchStartRef.current = null;
      selStartRef.current = { r, c };
      setSelStart({ r, c });
      // pre-drag: 現在の選択を保存してからアンカーセルを追加
      preDragRef.current = selRef.current ?? new Set();
      setSelection(addRect(preDragRef.current, r, c, r, c));
    }, 400);
  };

  // マウスドラッグで範囲選択
  const onCellEnter = (r, c) => {
    if (!selStartRef.current) return;
    const { r: sr, c: sc } = selStartRef.current;
    setSelection(addRect(new Set(), sr, sc, r, c));
  };

  return {
    selection,
    setSelection,
    selStart,
    onCellDown,
    onCellTouchStart,
    onCellEnter,
  };
}
