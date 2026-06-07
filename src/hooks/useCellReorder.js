import { useState, useRef, useEffect } from "react";
import { DEF_W, DEF_H } from "../reducer";

// ラベルを固定したまま、セル・高さ幅・結合のみを並び替えるフック
export function useCellReorder(dispatch, colWidths, rowHeights) {
  const [cellReorder, setCellReorder] = useState(null);
  const reorderRef = useRef(null);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const origRef = useRef(null);
  const colWRef = useRef(colWidths);
  const rowHRef = useRef(rowHeights);

  useEffect(() => {
    colWRef.current = colWidths;
  }, [colWidths]);
  useEffect(() => {
    rowHRef.current = rowHeights;
  }, [rowHeights]);

  useEffect(() => {
    const xy = (e) => ({
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    });
    const onMove = (e) => {
      if (!reorderRef.current || !startRef.current || !origRef.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = xy(e);
      const { type, to: currentTo } = reorderRef.current;
      const { origFrom, size } = origRef.current;
      const maxIdx =
        type === "h" ? rowHRef.current.length - 1 : colWRef.current.length - 1;
      const newTo =
        type === "h"
          ? Math.max(
              0,
              Math.min(
                maxIdx,
                origFrom + Math.round((y - startRef.current.y) / size),
              ),
            )
          : Math.max(
              0,
              Math.min(
                maxIdx,
                origFrom + Math.round((x - startRef.current.x) / size),
              ),
            );
      if (newTo !== currentTo) {
        reorderRef.current = { ...reorderRef.current, to: newTo };
        setCellReorder({ ...reorderRef.current });
        dispatch({
          type: type === "h" ? "REORDER_ROW_CELLS" : "REORDER_COL_CELLS",
          from: currentTo,
          to: newTo,
          skipHistory: true,
        });
      }
    };
    const cleanup = () => {
      clearTimeout(timerRef.current);
      reorderRef.current = null;
      startRef.current = null;
      origRef.current = null;
      setCellReorder(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", cleanup);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", cleanup);
    window.addEventListener("touchcancel", cleanup);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", cleanup);
      window.removeEventListener("touchcancel", cleanup);
    };
    // eslint-disable-next-line
  }, []);

  const onCellHandleDown = (type, idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = {
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    };
    timerRef.current = setTimeout(() => {
      dispatch({ type: "HISTORY_CHECKPOINT" });
      origRef.current = {
        origFrom: idx,
        size:
          type === "h"
            ? (rowHRef.current[idx] ?? DEF_H)
            : (colWRef.current[idx] ?? DEF_W),
      };
      reorderRef.current = { type, from: idx, to: idx };
      setCellReorder({ type, from: idx, to: idx });
    }, 400);
  };

  const onCellHandleUp = () => clearTimeout(timerRef.current);

  return { cellReorder, onCellHandleDown, onCellHandleUp };
}
