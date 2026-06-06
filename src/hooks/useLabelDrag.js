import { useState, useRef, useEffect } from "react";
import { DEF_W, DEF_H } from "../reducer";

export function useLabelDrag(dispatch, hLines, vLines, colWidths, rowHeights) {
  const [labelDrag, setLabelDrag] = useState(null);
  const labelDragRef = useRef(null);
  const labelStartRef = useRef(null);
  const labelTimerRef = useRef(null);
  const labelOrigRef = useRef(null);
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
    const reorder = (arr, f, t) => {
      if (f === t) return arr;
      const a = [...arr];
      const [x] = a.splice(f, 1);
      a.splice(t, 0, x);
      return a;
    };
    const onMove = (e) => {
      if (
        !labelDragRef.current ||
        !labelStartRef.current ||
        !labelOrigRef.current
      )
        return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = xy(e);
      const { type, from } = labelDragRef.current;
      const maxIdx = labelOrigRef.current.length - 1;
      const newTo =
        type === "h"
          ? Math.max(
              0,
              Math.min(
                maxIdx,
                from +
                  Math.round(
                    (y - labelStartRef.current.y) /
                      (rowHRef.current[from] ?? DEF_H),
                  ),
              ),
            )
          : Math.max(
              0,
              Math.min(
                maxIdx,
                from +
                  Math.round(
                    (x - labelStartRef.current.x) /
                      (colWRef.current[from] ?? DEF_W),
                  ),
              ),
            );
      if (newTo !== labelDragRef.current.to) {
        labelDragRef.current = { ...labelDragRef.current, to: newTo };
        setLabelDrag({ ...labelDragRef.current });
        const nl = reorder(labelOrigRef.current, from, newTo);
        dispatch(
          type === "h"
            ? { type: "SET_HLINES", hLines: nl, skipHistory: true }
            : { type: "SET_VLINES", vLines: nl, skipHistory: true },
        );
      }
    };
    const cleanup = () => {
      clearTimeout(labelTimerRef.current);
      labelDragRef.current = null;
      labelStartRef.current = null;
      labelOrigRef.current = null;
      setLabelDrag(null);
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

  const onHandleDown = (type, idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    labelStartRef.current = {
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    };
    labelTimerRef.current = setTimeout(() => {
      dispatch({ type: "HISTORY_CHECKPOINT" });
      labelOrigRef.current = type === "h" ? [...hLines] : [...vLines];
      labelDragRef.current = { type, from: idx, to: idx };
      setLabelDrag({ type, from: idx, to: idx });
    }, 400);
  };

  const onHandleUp = () => clearTimeout(labelTimerRef.current);

  return { labelDrag, onHandleDown, onHandleUp };
}
