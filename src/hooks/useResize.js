import { useState, useEffect } from "react";
import { MIN_W, MIN_H } from "../reducer";

export function useResize(dispatch) {
  const [resizing, setResizing] = useState(null);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const pos =
        resizing.type === "col"
          ? (e.clientX ?? e.touches?.[0]?.clientX ?? 0)
          : (e.clientY ?? e.touches?.[0]?.clientY ?? 0);
      dispatch({
        type: resizing.type === "col" ? "SET_COL_WIDTH" : "SET_ROW_HEIGHT",
        idx: resizing.idx,
        value: Math.max(
          resizing.type === "col" ? MIN_W : MIN_H,
          resizing.startSize + (pos - resizing.startPos),
        ),
        skipHistory: true,
      });
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [resizing]);

  const startResize = (type, idx, startPos, startSize) => {
    dispatch({ type: "HISTORY_CHECKPOINT" });
    setResizing({ type, idx, startPos, startSize });
  };

  return { resizing, startResize };
}
