import { useState, useRef, useEffect, useReducer } from "react";
import { initGridState, historyReducer } from "./reducer";
import { useResize } from "./hooks/useResize";
import { useLabelDrag } from "./hooks/useLabelDrag";
import { useCellSelection } from "./hooks/useCellSelection";
import { useCellReorder } from "./hooks/useCellReorder";
import Grid from "./Grid";

const STORAGE_KEY = "cellline-state";
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
};

export default function App() {
  const [{ past, present, future }, dispatch] = useReducer(
    historyReducer,
    null,
    () => ({ past: [], present: initGridState(loadSaved()), future: [] }),
  );
  const { hLines, vLines, colWidths, rowHeights, merges } = present;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const [editing, setEditing] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(null); // { r1,c1,r2,c2, data:string[][] }
  const [toastMsg, setToastMsg] = useState(null);
  const copiedRef = useRef(null);
  const copyTimerRef = useRef(null);
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    copiedRef.current = copied;
  }, [copied]);
  // 編集モード開始時にコピー予約をキャンセル（ダブルタップ対策）
  useEffect(() => {
    if (editing) clearTimeout(copyTimerRef.current);
  }, [editing]);

  useEffect(() => {
    const id = setTimeout(
      () => localStorage.setItem(STORAGE_KEY, JSON.stringify(present)),
      500,
    );
    return () => clearTimeout(id);
  }, [present]);

  useEffect(() => {
    const onKey = (e) => {
      if (editingRef.current) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const { resizing, startResize } = useResize(dispatch);
  const { labelDrag, onHandleDown, onHandleUp } = useLabelDrag(
    dispatch,
    hLines,
    vLines,
    colWidths,
    rowHeights,
  );

  const onCellTapRef = useRef(null);
  const {
    selection,
    setSelection,
    selStart,
    onCellDown,
    onCellTouchStart,
    onCellEnter,
  } = useCellSelection(editingRef, onCellTapRef);

  // タップ時のコピー／ペースト／通常選択ロジック（毎レンダーで最新の値を参照）
  onCellTapRef.current = (r, c, currentSel, isInSel) => {
    clearTimeout(copyTimerRef.current); // 直前のコピー予約を常にキャンセル
    if (copiedRef.current) {
      dispatch({ type: "HISTORY_CHECKPOINT" });
      dispatch({ type: "PASTE_CELLS", r, c, data: copiedRef.current.data });
      setSelection({ r1: r, c1: c, r2: r, c2: c });
      return true;
    }
    if (isInSel && currentSel) {
      // ダブルタップと区別するため280ms後にコピー実行
      // 編集モードが始まった場合はキャンセル（useEffect[editing]で clearTimeout）
      const { r1, c1, r2, c2 } = currentSel;
      const data = present.cells
        .slice(r1, r2 + 1)
        .map((row) => row.slice(c1, c2 + 1));
      copyTimerRef.current = setTimeout(() => {
        if (editingRef.current) return;
        setCopied({ r1, c1, r2, c2, data });
        showToast("コピーしました");
      }, 280);
      return true;
    }
    return false;
  };

  const { cellReorder, onCellHandleDown, onCellHandleUp } = useCellReorder(
    dispatch,
    colWidths,
    rowHeights,
  );

  // セル結合
  const selIsMulti =
    selection && (selection.r2 > selection.r1 || selection.c2 > selection.c1);
  const selIsSingle =
    selection && selection.r1 === selection.r2 && selection.c1 === selection.c2;
  const singleMerge = selIsSingle
    ? (merges.find((m) => m.r === selection.r1 && m.c === selection.c1) ?? null)
    : null;
  const canMerge = !!selIsMulti;
  const canUnmerge = !!(
    singleMerge &&
    (singleMerge.rowSpan > 1 || singleMerge.colSpan > 1)
  );

  const doMerge = () => {
    if (!canMerge || !selection) return;
    const { r1, c1, r2, c2 } = selection;
    const hasExisting = merges.some((m) => {
      const mR2 = m.r + m.rowSpan - 1,
        mC2 = m.c + m.colSpan - 1;
      return mR2 >= r1 && m.r <= r2 && mC2 >= c1 && m.c <= c2;
    });
    if (hasExisting) {
      setErrorMsg(
        "選択範囲内に結合セルが含まれています。解除してから再結合してください",
      );
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    dispatch({ type: "MERGE", r1, c1, r2, c2 });
    setSelection({ r1, c1, r2: r1, c2: c1 });
  };
  const doUnmerge = () => {
    if (!canUnmerge || !selection) return;
    if (!merges.find((m) => m.r === selection.r1 && m.c === selection.c1)) {
      setErrorMsg("選択範囲に一致する結合セルがありません");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    dispatch({ type: "UNMERGE", r: selection.r1, c: selection.c1 });
  };

  // 保存 / 読込
  const fileInputRef = useRef(null);
  const doExport = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(present, null, 2)], {
        type: "application/json",
      }),
    );
    Object.assign(document.createElement("a"), {
      href: url,
      download: "cellline.json",
    }).click();
    URL.revokeObjectURL(url);
  };
  const doImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        dispatch({ type: "LOAD", data: JSON.parse(ev.target.result) });
      } catch {
        setErrorMsg("ファイルの読み込みに失敗しました");
        setTimeout(() => setErrorMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toolBtn = (color, on = true) => ({
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: `1.5px solid ${on ? color : "#ddd"}`,
    borderRadius: 5,
    background: "#fff",
    color: on ? color : "#ccc",
    cursor: on ? "pointer" : "default",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif",
        padding: "28px 24px",
        color: "#333",
        userSelect: resizing || labelDrag ? "none" : "auto",
        cursor:
          resizing?.type === "col"
            ? "col-resize"
            : resizing?.type === "row"
              ? "row-resize"
              : "default",
      }}
      onClick={() => {
        if (!selStart) {
          setSelection(null);
          setEditing(null);
          setCopied(null);
        }
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        ラベル付きグリッド
      </h1>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={!canUndo}
          style={toolBtn("#555", canUndo)}
        >
          ↩ 元に戻す
        </button>
        <button
          onClick={() => dispatch({ type: "REDO" })}
          disabled={!canRedo}
          style={toolBtn("#555", canRedo)}
        >
          ↪ やり直し
        </button>
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        {[
          { label: "+ 縦線（末尾）", type: "ADD_COL", c: "#4a90d9" },
          { label: "− 縦線", type: "REMOVE_COL", c: "#e05c5c" },
          { label: "+ 横線（末尾）", type: "ADD_ROW", c: "#3aaa7a" },
          { label: "− 横線", type: "REMOVE_ROW", c: "#e09a3a" },
        ].map((b) => (
          <button
            key={b.label}
            onClick={() => dispatch({ type: b.type })}
            style={toolBtn(b.c)}
          >
            {b.label}
          </button>
        ))}
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        <button
          onClick={doMerge}
          disabled={!canMerge}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "1.5px solid #8b5cf6",
            borderRadius: 5,
            background: canMerge ? "#8b5cf6" : "#f3f0ff",
            color: canMerge ? "#fff" : "#c4b5fd",
            cursor: canMerge ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          ⊞ セル結合
        </button>
        <button
          onClick={doUnmerge}
          disabled={!canUnmerge}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "1.5px solid #8b5cf6",
            borderRadius: 5,
            background: canUnmerge ? "#fff" : "#f3f0ff",
            color: canUnmerge ? "#8b5cf6" : "#c4b5fd",
            cursor: canUnmerge ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          ⊟ 解除
        </button>
        {selection && (
          <span style={{ fontSize: 11, color: "#999" }}>
            {selIsMulti
              ? `${selection.r2 - selection.r1 + 1}行 × ${selection.c2 - selection.c1 + 1}列 選択中`
              : canUnmerge
                ? `結合セル (${singleMerge.rowSpan}×${singleMerge.colSpan})`
                : null}
          </span>
        )}
        {errorMsg && (
          <span
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            {errorMsg}
          </span>
        )}
        <div style={{ width: 1, height: 24, background: "#ddd" }} />
        <button onClick={doExport} style={toolBtn("#888")}>
          ↓ 保存
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={toolBtn("#888")}
        >
          ↑ 読込
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={doImport}
          style={{ display: "none" }}
        />
      </div>

      <Grid
        present={present}
        dispatch={dispatch}
        selection={selection}
        editing={editing}
        copied={copied}
        labelDrag={labelDrag}
        resizing={resizing}
        onCellDown={onCellDown}
        onCellTouchStart={onCellTouchStart}
        onCellEnter={onCellEnter}
        startResize={startResize}
        onHandleDown={onHandleDown}
        onHandleUp={onHandleUp}
        cellReorder={cellReorder}
        onCellHandleDown={onCellHandleDown}
        onCellHandleUp={onCellHandleUp}
        setEditing={setEditing}
        setSelection={setSelection}
      />

      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "rgba(0,0,0,0.72)",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            zIndex: 1000,
            pointerEvents: "none",
            letterSpacing: "0.03em",
          }}
        >
          {toastMsg}
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 11, color: "#bbb", lineHeight: 2 }}>
        💡 <strong style={{ color: "#4a90d9" }}>▼</strong>/
        <strong style={{ color: "#3aaa7a" }}>▶</strong>
        ハンドルをドラッグでサイズ変更。
        <strong style={{ color: "#4a90d9" }}>青い＋</strong>で列を右に挿入。
        <strong style={{ color: "#3aaa7a" }}>緑の＋</strong>で行を下に挿入。
        <strong style={{ color: "#aaa" }}>⠿ 長押し</strong>でラベル並び替え。
        <strong style={{ color: "#8b5cf6" }}>
          ドラッグ選択→⊞結合 / 結合セル→⊟解除
        </strong>
        。 ダブルクリックで編集。<strong>Ctrl+Z</strong> /{" "}
        <strong>Ctrl+Shift+Z</strong> で Undo/Redo。
      </p>
    </div>
  );
}
