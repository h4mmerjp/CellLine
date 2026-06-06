import { useState, useRef, useEffect, useReducer } from "react";
import { DEF_W, DEF_H, MIN_W, MIN_H, initGridState, historyReducer } from "./reducer";
import Grid from "./Grid";

const STORAGE_KEY = "cellline-state";
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; } };
const normSel = (r1, c1, r2, c2) => ({ r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) });

export default function App() {
  const [{ past, present, future }, dispatch] = useReducer(
    historyReducer, null,
    () => ({ past: [], present: initGridState(loadSaved()), future: [] }),
  );
  const { hLines, merges } = present;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const [selection, setSelection] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [editing, setEditing] = useState(null);
  const [labelDrag, setLabelDrag] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const labelDragRef = useRef(null);
  const labelStartRef = useRef(null);
  const labelTimerRef = useRef(null);
  const labelOrigRef = useRef(null);
  const cellTouchTimerRef = useRef(null);
  const cellTouchRef = useRef(null);
  const editingRef = useRef(editing);
  const colWRef = useRef(present.colWidths);
  const rowHRef = useRef(present.rowHeights);
  const selStartRef = useRef(selStart);

  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { colWRef.current = present.colWidths; }, [present.colWidths]);
  useEffect(() => { rowHRef.current = present.rowHeights; }, [present.rowHeights]);
  useEffect(() => { selStartRef.current = selStart; }, [selStart]);
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(present)), 500);
    return () => clearTimeout(id);
  }, [present]);
  useEffect(() => {
    const onKey = (e) => {
      if (editingRef.current) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); dispatch({ type: "REDO" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── merge ─────────────────────────────────────────────────────────
  const selIsMulti = selection && (selection.r2 > selection.r1 || selection.c2 > selection.c1);
  const selIsSingle = selection && selection.r1 === selection.r2 && selection.c1 === selection.c2;
  const singleMerge = selIsSingle ? (merges.find((m) => m.r === selection.r1 && m.c === selection.c1) ?? null) : null;
  const canMerge = !!selIsMulti;
  const canUnmerge = !!(singleMerge && (singleMerge.rowSpan > 1 || singleMerge.colSpan > 1));

  const doMerge = () => {
    if (!canMerge || !selection) return;
    const { r1, c1, r2, c2 } = selection;
    const hasExisting = merges.some((m) => { const mR2 = m.r + m.rowSpan - 1, mC2 = m.c + m.colSpan - 1; return mR2 >= r1 && m.r <= r2 && mC2 >= c1 && m.c <= c2; });
    if (hasExisting) { setErrorMsg("選択範囲内に結合セルが含まれています。解除してから再結合してください"); setTimeout(() => setErrorMsg(null), 3000); return; }
    dispatch({ type: "MERGE", r1, c1, r2, c2 });
    setSelection({ r1, c1, r2: r1, c2: c1 });
  };
  const doUnmerge = () => {
    if (!canUnmerge || !selection) return;
    if (!merges.find((m) => m.r === selection.r1 && m.c === selection.c1)) { setErrorMsg("選択範囲に一致する結合セルがありません"); setTimeout(() => setErrorMsg(null), 3000); return; }
    dispatch({ type: "UNMERGE", r: selection.r1, c: selection.c1 });
  };

  // ── export / import ───────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const doExport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(present, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: "cellline.json" }).click();
    URL.revokeObjectURL(url);
  };
  const doImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { try { dispatch({ type: "LOAD", data: JSON.parse(ev.target.result) }); } catch { setErrorMsg("ファイルの読み込みに失敗しました"); setTimeout(() => setErrorMsg(null), 3000); } };
    reader.readAsText(file); e.target.value = "";
  };

  // ── resize ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const pos = resizing.type === "col" ? (e.clientX ?? e.touches?.[0]?.clientX ?? 0) : (e.clientY ?? e.touches?.[0]?.clientY ?? 0);
      dispatch({ type: resizing.type === "col" ? "SET_COL_WIDTH" : "SET_ROW_HEIGHT", idx: resizing.idx, value: Math.max(resizing.type === "col" ? MIN_W : MIN_H, resizing.startSize + (pos - resizing.startPos)), skipHistory: true });
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
  }, [resizing]);
  const startResize = (type, idx, startPos, startSize) => { dispatch({ type: "HISTORY_CHECKPOINT" }); setResizing({ type, idx, startPos, startSize }); };

  // ── label drag ────────────────────────────────────────────────────
  useEffect(() => {
    const xy = (e) => ({ x: e.clientX ?? e.touches?.[0]?.clientX ?? 0, y: e.clientY ?? e.touches?.[0]?.clientY ?? 0 });
    const reorder = (arr, f, t) => { if (f === t) return arr; const a = [...arr]; const [x] = a.splice(f, 1); a.splice(t, 0, x); return a; };
    const onMove = (e) => {
      if (!labelDragRef.current || !labelStartRef.current || !labelOrigRef.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = xy(e); const { type, from } = labelDragRef.current; const maxIdx = labelOrigRef.current.length - 1;
      const newTo = type === "h"
        ? Math.max(0, Math.min(maxIdx, from + Math.round((y - labelStartRef.current.y) / (rowHRef.current[from] ?? DEF_H))))
        : Math.max(0, Math.min(maxIdx, from + Math.round((x - labelStartRef.current.x) / (colWRef.current[from] ?? DEF_W))));
      if (newTo !== labelDragRef.current.to) {
        labelDragRef.current = { ...labelDragRef.current, to: newTo }; setLabelDrag({ ...labelDragRef.current });
        const nl = reorder(labelOrigRef.current, from, newTo);
        dispatch(type === "h" ? { type: "SET_HLINES", hLines: nl, skipHistory: true } : { type: "SET_VLINES", vLines: nl, skipHistory: true });
      }
    };
    const cleanup = () => { clearTimeout(labelTimerRef.current); labelDragRef.current = null; labelStartRef.current = null; labelOrigRef.current = null; setLabelDrag(null); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", cleanup);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", cleanup); window.addEventListener("touchcancel", cleanup);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", cleanup); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", cleanup); window.removeEventListener("touchcancel", cleanup); };
    // eslint-disable-next-line
  }, []);
  const onHandleDown = (type, idx, e) => {
    e.preventDefault(); e.stopPropagation();
    labelStartRef.current = { x: e.clientX ?? e.touches?.[0]?.clientX ?? 0, y: e.clientY ?? e.touches?.[0]?.clientY ?? 0 };
    labelTimerRef.current = setTimeout(() => {
      dispatch({ type: "HISTORY_CHECKPOINT" });
      labelOrigRef.current = type === "h" ? [...present.hLines] : [...present.vLines];
      labelDragRef.current = { type, from: idx, to: idx }; setLabelDrag({ type, from: idx, to: idx });
    }, 400);
  };
  const onHandleUp = () => clearTimeout(labelTimerRef.current);

  // ── cell selection ────────────────────────────────────────────────
  const onCellDown = (r, c, e) => {
    if (editing?.r === r && editing?.c === c) return;
    e.preventDefault(); e.stopPropagation();
    if (e.shiftKey && selection) setSelection(normSel(selection.r1, selection.c1, r, c));
    else { setSelStart({ r, c }); setSelection(normSel(r, c, r, c)); }
  };
  const onCellTouchStart = (r, c, e) => {
    if (editing?.r === r && editing?.c === c) return;
    const t = e.touches[0]; cellTouchRef.current = { r, c, x: t.clientX, y: t.clientY };
    cellTouchTimerRef.current = setTimeout(() => { cellTouchRef.current = null; setSelStart({ r, c }); setSelection(normSel(r, c, r, c)); }, 400);
  };
  useEffect(() => {
    const onMove = (e) => { if (!cellTouchRef.current) return; const t = e.touches[0]; if (Math.hypot(t.clientX - cellTouchRef.current.x, t.clientY - cellTouchRef.current.y) > 10) { clearTimeout(cellTouchTimerRef.current); cellTouchRef.current = null; } };
    const onEnd = () => { clearTimeout(cellTouchTimerRef.current); cellTouchRef.current = null; };
    window.addEventListener("touchmove", onMove, { passive: true }); window.addEventListener("touchend", onEnd); window.addEventListener("touchcancel", onEnd);
    return () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); window.removeEventListener("touchcancel", onEnd); };
  }, []);
  const onCellEnter = (r, c) => { if (!selStart) return; setSelection(normSel(selStart.r, selStart.c, r, c)); };
  useEffect(() => {
    if (!selStart) return;
    const up = () => setSelStart(null);
    window.addEventListener("mouseup", up); window.addEventListener("touchend", up);
    const onTouch = (e) => {
      if (!selStartRef.current) return; if (e.cancelable) e.preventDefault();
      const t = e.touches[0]; const cell = document.elementFromPoint(t.clientX, t.clientY)?.closest("[data-row]");
      if (cell) { const { r: sr, c: sc } = selStartRef.current; setSelection(normSel(sr, sc, +cell.dataset.row, +cell.dataset.col)); }
    };
    window.addEventListener("touchmove", onTouch, { passive: false });
    return () => { window.removeEventListener("mouseup", up); window.removeEventListener("touchend", up); window.removeEventListener("touchmove", onTouch); };
  }, [selStart]);

  // ── render ────────────────────────────────────────────────────────
  const toolBtn = (color, on = true) => ({ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: `1.5px solid ${on ? color : "#ddd"}`, borderRadius: 5, background: "#fff", color: on ? color : "#ccc", cursor: on ? "pointer" : "default", transition: "all 0.15s" });

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding: "28px 24px", color: "#333", userSelect: resizing || labelDrag ? "none" : "auto", cursor: resizing?.type === "col" ? "col-resize" : resizing?.type === "row" ? "row-resize" : "default" }}
      onClick={() => { if (!selStart) { setSelection(null); setEditing(null); } }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>ラベル付きグリッド</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo} style={toolBtn("#555", canUndo)}>↩ 元に戻す</button>
        <button onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo} style={toolBtn("#555", canRedo)}>↪ やり直し</button>
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        {[{ label: "+ 縦線（末尾）", type: "ADD_COL", c: "#4a90d9" }, { label: "− 縦線", type: "REMOVE_COL", c: "#e05c5c" }, { label: "+ 横線（末尾）", type: "ADD_ROW", c: "#3aaa7a" }, { label: "− 横線", type: "REMOVE_ROW", c: "#e09a3a" }].map((b) => (
          <button key={b.label} onClick={() => dispatch({ type: b.type })} style={toolBtn(b.c)}>{b.label}</button>
        ))}
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        <button onClick={doMerge} disabled={!canMerge} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "1.5px solid #8b5cf6", borderRadius: 5, background: canMerge ? "#8b5cf6" : "#f3f0ff", color: canMerge ? "#fff" : "#c4b5fd", cursor: canMerge ? "pointer" : "default", transition: "all 0.15s" }}>⊞ セル結合</button>
        <button onClick={doUnmerge} disabled={!canUnmerge} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "1.5px solid #8b5cf6", borderRadius: 5, background: canUnmerge ? "#fff" : "#f3f0ff", color: canUnmerge ? "#8b5cf6" : "#c4b5fd", cursor: canUnmerge ? "pointer" : "default", transition: "all 0.15s" }}>⊟ 解除</button>
        {selection && <span style={{ fontSize: 11, color: "#999" }}>{selIsMulti ? `${selection.r2 - selection.r1 + 1}行 × ${selection.c2 - selection.c1 + 1}列 選択中` : canUnmerge ? `結合セル (${singleMerge.rowSpan}×${singleMerge.colSpan})` : null}</span>}
        {errorMsg && <span style={{ background: "#fef2f2", color: "#dc2626", padding: "4px 10px", borderRadius: 4, fontSize: 11 }}>{errorMsg}</span>}
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        <button onClick={doExport} style={toolBtn("#888")}>↓ 保存</button>
        <button onClick={() => fileInputRef.current?.click()} style={toolBtn("#888")}>↑ 読込</button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={doImport} style={{ display: "none" }} />
      </div>

      <Grid
        present={present} dispatch={dispatch}
        selection={selection} editing={editing} labelDrag={labelDrag} resizing={resizing}
        onCellDown={onCellDown} onCellTouchStart={onCellTouchStart} onCellEnter={onCellEnter}
        startResize={startResize} onHandleDown={onHandleDown} onHandleUp={onHandleUp}
        setEditing={setEditing} setSelection={setSelection}
      />

      <p style={{ marginTop: 20, fontSize: 11, color: "#bbb", lineHeight: 2 }}>
        💡 <strong style={{ color: "#4a90d9" }}>▼</strong>/<strong style={{ color: "#3aaa7a" }}>▶</strong>ハンドルをドラッグでサイズ変更。
        <strong style={{ color: "#4a90d9" }}>青い＋</strong>で列を右に挿入。<strong style={{ color: "#3aaa7a" }}>緑の＋</strong>で行を下に挿入。
        <strong style={{ color: "#aaa" }}>⠿ 長押し</strong>でラベル並び替え。
        <strong style={{ color: "#8b5cf6" }}>ドラッグ選択→⊞結合 / 結合セル→⊟解除</strong>。
        ダブルクリックで編集。<strong>Ctrl+Z</strong> / <strong>Ctrl+Shift+Z</strong> で Undo/Redo。
      </p>
    </div>
  );
}
