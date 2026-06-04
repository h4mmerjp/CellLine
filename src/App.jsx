import { useState, useRef, useEffect, Fragment, useCallback } from "react";

// LINE_H 行を廃止。横線ラベルはセルの borderTop 上に絶対配置で「線の横」に表示。
const GUTTER = 110;
const LAST_ROW_H = 20; // 最下線ラベル用の薄い行
const MIN_W = 40,
  MIN_H = 30,
  DEF_W = 120,
  DEF_H = 70;

const makeGrid = (r, c) => Array.from({ length: r }, () => Array(c).fill(""));

const STORAGE_KEY = "cellline-state";
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
};
const normSel = (r1, c1, r2, c2) => ({
  r1: Math.min(r1, r2),
  r2: Math.max(r1, r2),
  c1: Math.min(c1, c2),
  c2: Math.max(c1, c2),
});

// ── LabelBox（コンポーネント外部） ──────────────────────────────────
const LabelBox = ({
  value,
  onChange,
  type,
  idx,
  width,
  placeholder,
  labelDrag,
  onHandleDown,
  onHandleUp,
}) => {
  const [localEdit, setLocalEdit] = useState(false);
  const drag = labelDrag?.type === type && labelDrag.to === idx;
  const target = false;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        outline: drag ? "2px solid #4a90d9" : "none",
        borderRadius: 2,
        padding: 1,
      }}
    >
      <div
        onMouseDown={(e) => onHandleDown(type, idx, e)}
        onMouseUp={onHandleUp}
        onTouchStart={(e) => onHandleDown(type, idx, e)}
        onTouchEnd={onHandleUp}
        onContextMenu={(e) => e.preventDefault()}
        title="長押しでラベル移動"
        style={{
          cursor: "grab",
          padding: "1px 2px",
          fontSize: 9,
          color: "#bbb",
          opacity: drag ? 1 : 0.5,
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        ⠿
      </div>
      {localEdit ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setLocalEdit(false)}
          onClick={(e) => e.stopPropagation()}
          placeholder={placeholder ?? "ラベル"}
          style={{
            width: width ?? "100%",
            fontSize: 11,
            fontWeight: 600,
            border: "none",
            outline: "none",
            background: target ? "#fffde8" : drag ? "#e8f4ff" : "transparent",
            color: type === "h" ? "#3aaa7a" : "#4a90d9",
            padding: "1px 2px",
            borderRadius: 2,
            boxSizing: "border-box",
            minWidth: 0,
          }}
        />
      ) : (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setLocalEdit(true);
          }}
          style={{
            width: width ?? "100%",
            fontSize: 11,
            fontWeight: 600,
            color: value ? (type === "h" ? "#3aaa7a" : "#4a90d9") : "#ccc",
            padding: "1px 2px",
            cursor: "default",
            minWidth: 0,
          }}
        >
          {value || placeholder || "ラベル"}
        </span>
      )}
    </div>
  );
};

// ── InsertBtn（コンポーネント外部） ──────────────────────────────────
const InsertBtn = ({ onClick, axis }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      width: 14,
      height: 14,
      borderRadius: "50%",
      border: `1.5px solid ${axis === "col" ? "#4a90d9" : "#3aaa7a"}`,
      background: "#fff",
      color: axis === "col" ? "#4a90d9" : "#3aaa7a",
      fontSize: 10,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      flexShrink: 0,
      opacity: 0.7,
      transition: "opacity 0.15s,transform 0.15s",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.opacity = "1";
      e.currentTarget.style.transform = "scale(1.2)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.opacity = "0.7";
      e.currentTarget.style.transform = "scale(1)";
    }}
  >
    +
  </button>
);

export default function App() {
  const [vLines, setVLines] = useState(
    () => loadSaved()?.vLines ?? ["", "", "", "", ""],
  );
  const [hLines, setHLines] = useState(
    () => loadSaved()?.hLines ?? ["", "", "", "", ""],
  );
  const [cells, setCells] = useState(
    () => loadSaved()?.cells ?? makeGrid(4, 4),
  );
  const [colWidths, setColWidths] = useState(
    () => loadSaved()?.colWidths ?? Array(4).fill(DEF_W),
  );
  const [rowHeights, setRowHeights] = useState(
    () => loadSaved()?.rowHeights ?? Array(4).fill(DEF_H),
  );
  const [merges, setMerges] = useState(() => loadSaved()?.merges ?? []);
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
  const colWRef = useRef(colWidths);
  const rowHRef = useRef(rowHeights);
  const selStartRef = useRef(selStart);
  useEffect(() => {
    colWRef.current = colWidths;
  }, [colWidths]);
  useEffect(() => {
    rowHRef.current = rowHeights;
  }, [rowHeights]);
  useEffect(() => {
    selStartRef.current = selStart;
  }, [selStart]);
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          vLines,
          hLines,
          cells,
          colWidths,
          rowHeights,
          merges,
        }),
      );
    }, 500);
    return () => clearTimeout(id);
  }, [vLines, hLines, cells, colWidths, rowHeights, merges]);

  const rows = hLines.length - 1;
  const cols = vLines.length - 1;

  // ── 結合ヘルパー ────────────────────────────────────────────────
  const getMerge = (r, c) => merges.find((m) => m.r === r && m.c === c) ?? null;
  const isCovered = (r, c) =>
    merges.some(
      (m) =>
        !(m.r === r && m.c === c) &&
        m.r <= r &&
        r < m.r + m.rowSpan &&
        m.c <= c &&
        c < m.c + m.colSpan,
    );
  const inSel = (r, c) =>
    !!selection &&
    r >= selection.r1 &&
    r <= selection.r2 &&
    c >= selection.c1 &&
    c <= selection.c2;

  const selIsMulti =
    selection && (selection.r2 > selection.r1 || selection.c2 > selection.c1);
  const selIsSingle =
    selection && selection.r1 === selection.r2 && selection.c1 === selection.c2;
  const singleMerge = selIsSingle ? getMerge(selection.r1, selection.c1) : null;
  const canMerge = !!selIsMulti;
  const canUnmerge = !!(
    singleMerge &&
    (singleMerge.rowSpan > 1 || singleMerge.colSpan > 1)
  );

  const doMerge = () => {
    if (!canMerge || !selection) return;
    const { r1, c1, r2, c2 } = selection;
    // 選択範囲内に既存の結合セルがないかチェック
    const hasExistingMerge = merges.some((m) => {
      if (m.r >= r1 && m.r <= r2 && m.c >= c1 && m.c <= c2) return true;
      // 部分的にかかっている結合セル（隣接問題）
      const mR2 = m.r + m.rowSpan - 1,
        mC2 = m.c + m.colSpan - 1;
      if (mR2 >= r1 && m.r <= r2 && mC2 >= c1 && m.c <= c2) return true;
      return false;
    });
    if (hasExistingMerge) {
      setErrorMsg(
        "選択範囲内に結合セルが含まれています。解除してから再結合してください",
      );
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setMerges((prev) => [
      ...prev.filter(
        (m) =>
          m.r + m.rowSpan - 1 < r1 ||
          m.r > r2 ||
          m.c + m.colSpan - 1 < c1 ||
          m.c > c2,
      ),
      { r: r1, c: c1, rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 },
    ]);
    setSelection({ r1, c1, r2: r1, c2: c1 });
  };
  const doUnmerge = () => {
    if (!canUnmerge || !selection) return;
    // 選択範囲と一致する結合セルがあるかチェック
    const match = merges.find(
      (m) => m.r === selection.r1 && m.c === selection.c1,
    );
    if (!match) {
      setErrorMsg("選択範囲に一致する結合セルがありません");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setMerges((prev) =>
      prev.filter((m) => !(m.r === selection.r1 && m.c === selection.c1)),
    );
  };

  // ── エクスポート / インポート ────────────────────────────────────
  const fileInputRef = useRef(null);
  const doExport = () => {
    const data = JSON.stringify(
      { vLines, hLines, cells, colWidths, rowHeights, merges },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cellline.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.vLines) setVLines(d.vLines);
        if (d.hLines) setHLines(d.hLines);
        if (d.cells) setCells(d.cells);
        if (d.colWidths) setColWidths(d.colWidths);
        if (d.rowHeights) setRowHeights(d.rowHeights);
        if (d.merges) setMerges(d.merges);
      } catch {
        setErrorMsg("ファイルの読み込みに失敗しました");
        setTimeout(() => setErrorMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── 結合対応の挿入/削除 ──────────────────────────────────────────
  const adjMCol = (ci, ms) =>
    ms.map((m) => {
      if (m.c > ci) return { ...m, c: m.c + 1 };
      if (m.c + m.colSpan - 1 >= ci + 1)
        return { ...m, colSpan: m.colSpan + 1 };
      return m;
    });
  const adjMRow = (hi, ms) =>
    ms.map((m) => {
      if (m.r > hi) return { ...m, r: m.r + 1 };
      if (m.r + m.rowSpan - 1 >= hi + 1)
        return { ...m, rowSpan: m.rowSpan + 1 };
      return m;
    });

  const insertColAfter = (ci) => {
    setEditing(null);
    setVLines((p) => {
      const a = [...p];
      a.splice(ci + 1, 0, "");
      return a;
    });
    setCells((p) =>
      p.map((r) => {
        const a = [...r];
        a.splice(ci + 1, 0, "");
        return a;
      }),
    );
    setColWidths((p) => {
      const a = [...p];
      a.splice(ci + 1, 0, DEF_W);
      return a;
    });
    setMerges((prev) => adjMCol(ci, prev));
  };
  const insertRowAfter = (hi) => {
    setEditing(null);
    setHLines((p) => {
      const a = [...p];
      a.splice(hi + 1, 0, "");
      return a;
    });
    setCells((p) => {
      const a = [...p];
      a.splice(hi + 1, 0, Array(p[0]?.length ?? 1).fill(""));
      return a;
    });
    setRowHeights((p) => {
      const a = [...p];
      a.splice(hi + 1, 0, DEF_H);
      return a;
    });
    setMerges((prev) => adjMRow(hi, prev));
  };

  const addCol = () => {
    setVLines((p) => [...p, ""]);
    setCells((p) => p.map((r) => [...r, ""]));
    setColWidths((p) => [...p, DEF_W]);
  };
  const addRow = () => {
    setHLines((p) => [...p, ""]);
    setCells((p) => [...p, Array(cols).fill("")]);
    setRowHeights((p) => [...p, DEF_H]);
  };
  const removeCol = () => {
    if (cols <= 1) return;
    const rc = cols - 1;
    setVLines((p) => p.slice(0, -1));
    setCells((p) => p.map((r) => r.slice(0, -1)));
    setColWidths((p) => p.slice(0, -1));
    setMerges((prev) =>
      prev
        .map((m) => {
          if (m.c >= rc) return null;
          if (m.c + m.colSpan - 1 >= rc) {
            const cs = rc - m.c;
            return cs < 1 ? null : { ...m, colSpan: cs };
          }
          return m;
        })
        .filter(Boolean),
    );
    setSelection(null);
  };
  const removeRow = () => {
    if (rows <= 1) return;
    const rr = rows - 1;
    setHLines((p) => p.slice(0, -1));
    setCells((p) => p.slice(0, -1));
    setRowHeights((p) => p.slice(0, -1));
    setMerges((prev) =>
      prev
        .map((m) => {
          if (m.r >= rr) return null;
          if (m.r + m.rowSpan - 1 >= rr) {
            const rs = rr - m.r;
            return rs < 1 ? null : { ...m, rowSpan: rs };
          }
          return m;
        })
        .filter(Boolean),
    );
    setSelection(null);
  };

  // ── 並べ替え ─────────────────────────────────────────────────────
  const reorderH = (from, to) => {
    if (from === to) return;
    setHLines((p) => {
      const a = [...p];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  };
  const reorderV = (from, to) => {
    if (from === to) return;
    setVLines((p) => {
      const a = [...p];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  };

  // ── リサイズ ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const pos =
        resizing.type === "col"
          ? (e.clientX ?? e.touches?.[0]?.clientX ?? 0)
          : (e.clientY ?? e.touches?.[0]?.clientY ?? 0);
      const d = pos - resizing.startPos;
      if (resizing.type === "col")
        setColWidths((p) =>
          p.map((w, i) =>
            i === resizing.idx ? Math.max(MIN_W, resizing.startSize + d) : w,
          ),
        );
      else
        setRowHeights((p) =>
          p.map((h, i) =>
            i === resizing.idx ? Math.max(MIN_H, resizing.startSize + d) : h,
          ),
        );
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

  // ── ラベルドラッグ ────────────────────────────────────────────────
  useEffect(() => {
    const xy = (e) => ({
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    });
    const applyReorder = (orig, from, to) => {
      if (from === to) return orig;
      const a = [...orig];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
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
      let newTo;
      if (type === "h") {
        const dy = y - labelStartRef.current.y;
        newTo = Math.max(
          0,
          Math.min(
            maxIdx,
            from + Math.round(dy / (rowHRef.current[from] ?? DEF_H)),
          ),
        );
      } else {
        const dx = x - labelStartRef.current.x;
        newTo = Math.max(
          0,
          Math.min(
            maxIdx,
            from + Math.round(dx / (colWRef.current[from] ?? DEF_W)),
          ),
        );
      }
      if (newTo !== labelDragRef.current.to) {
        labelDragRef.current = { ...labelDragRef.current, to: newTo };
        setLabelDrag({ ...labelDragRef.current });
        const newLines = applyReorder(labelOrigRef.current, from, newTo);
        if (type === "h") setHLines(newLines);
        else setVLines(newLines);
      }
    };
    const onUp = () => {
      clearTimeout(labelTimerRef.current);
      labelDragRef.current = null;
      labelStartRef.current = null;
      labelOrigRef.current = null;
      setLabelDrag(null);
    };
    const onCancel = () => {
      clearTimeout(labelTimerRef.current);
      labelDragRef.current = null;
      labelStartRef.current = null;
      labelOrigRef.current = null;
      setLabelDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onCancel);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onCancel);
    };
    // eslint-disable-next-line
  }, []);

  const onHandleDown = (type, idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    labelStartRef.current = { x, y };
    labelTimerRef.current = setTimeout(() => {
      labelOrigRef.current = type === "h" ? [...hLines] : [...vLines];
      labelDragRef.current = { type, from: idx, to: idx };
      setLabelDrag({ type, from: idx, to: idx });
    }, 400);
  };
  const onHandleUp = () => clearTimeout(labelTimerRef.current);

  // ── セル選択 ─────────────────────────────────────────────────────
  const onCellDown = (r, c, e) => {
    if (editing?.r === r && editing?.c === c) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey && selection) {
      setSelection(normSel(selection.r1, selection.c1, r, c));
    } else {
      setSelStart({ r, c });
      setSelection(normSel(r, c, r, c));
    }
  };
  const onCellEnter = (r, c) => {
    if (!selStart) return;
    setSelection(normSel(selStart.r, selStart.c, r, c));
  };
  useEffect(() => {
    if (!selStart) return;

    const up = () => setSelStart(null);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);

    // タッチスワイプで選択拡張
    const touchMove = (e) => {
      if (!selStartRef.current) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!el) return;
      const cell = el.closest("[data-row]");
      if (cell) {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const { r: sr, c: sc } = selStartRef.current;
        setSelection(normSel(sr, sc, r, c));
      }
    };
    window.addEventListener("touchmove", touchMove, { passive: false });

    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchmove", touchMove);
    };
  }, [selStart]);

  // ── ビジュアルヘルパー ────────────────────────────────────────────
  const lColor = (l) => (l ? "#333" : "#ddd");
  const lWeight = (l) => (l ? 2 : 1);
  const setVLine = (i, v) =>
    setVLines((p) => p.map((l, j) => (j === i ? v : l)));
  const setHLine = (i, v) =>
    setHLines((p) => p.map((l, j) => (j === i ? v : l)));
  const setCell = (r, c, v) =>
    setCells((p) =>
      p.map((row, ri) =>
        ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row,
      ),
    );

  // ── CSS Grid テンプレート ─────────────────────────────────────────
  // 行: セル行(rowHeights) + 最下線用の薄い行(LAST_ROW_H)
  // LINE_H 行なし → セル間に余白ゼロ
  const gridTCols = `${GUTTER}px ${colWidths.map((w) => `${w}px`).join(" ")}`;
  const gridTRows = [
    ...rowHeights.map((h) => `${h}px`),
    `${LAST_ROW_H}px`,
  ].join(" ");

  // 横線ラベルをガターセルの「線の横」に配置するスタイル
  // → top:0 + translateY(-50%) でラベルを borderTop 上に中央配置
  const hLabelStyle = {
    position: "absolute",
    top: 0,
    right: 4,
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    background: "#fafafa",
    padding: "0 3px",
    zIndex: 5,
    pointerEvents: "all",
  };

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
        }
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        ラベル付きグリッド
      </h1>

      {/* ── ツールバー ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {[
          { label: "+ 縦線（末尾）", fn: addCol, c: "#4a90d9" },
          { label: "− 縦線", fn: removeCol, c: "#e05c5c" },
          { label: "+ 横線（末尾）", fn: addRow, c: "#3aaa7a" },
          { label: "− 横線", fn: removeRow, c: "#e09a3a" },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              border: `1.5px solid ${b.c}`,
              borderRadius: 5,
              background: "#fff",
              color: b.c,
              cursor: "pointer",
            }}
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
        <button
          onClick={doExport}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "1.5px solid #888",
            borderRadius: 5,
            background: "#fff",
            color: "#555",
            cursor: "pointer",
          }}
        >
          ↓ 保存
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "1.5px solid #888",
            borderRadius: 5,
            background: "#fff",
            color: "#555",
            cursor: "pointer",
          }}
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

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-block" }}>
          {/* ── 縦線ラベル行（線の上）── */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: GUTTER, flexShrink: 0 }} />
            {vLines.map((label, vi) => {
              const isLast = vi === vLines.length - 1;
              const w = isLast ? 0 : (colWidths[vi] ?? DEF_W);
              return (
                <div
                  key={vi}
                  style={{
                    width: w,
                    flexShrink: 0,
                    position: "relative",
                    height: 28,
                    overflow: "visible",
                  }}
                >
                  {/* 縦線ビジュアル */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: lWeight(label),
                      background: lColor(label),
                    }}
                  />
                  {/* 列リサイズ ▼ハンドル（縦線の下端） */}
                  {vi > 0 && (
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setResizing({
                          type: "col",
                          idx: vi - 1,
                          startPos: e.clientX,
                          startSize: colWidths[vi - 1],
                        });
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setResizing({
                          type: "col",
                          idx: vi - 1,
                          startPos: e.touches[0].clientX,
                          startSize: colWidths[vi - 1],
                        });
                      }}
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: 0,
                        transform: "translateX(-50%)",
                        cursor: "col-resize",
                        zIndex: 15,
                        fontSize: 11,
                        color: "#4a90d9",
                        lineHeight: 1,
                        userSelect: "none",
                        touchAction: "none",
                      }}
                      title="ドラッグで幅変更"
                    >
                      ▼
                    </div>
                  )}
                  {/* ラベルを線の上に表示 */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 2,
                      background: "#fafafa",
                      padding: "0 3px",
                    }}
                  >
                    <LabelBox
                      value={label}
                      onChange={(v) => setVLine(vi, v)}
                      type="v"
                      idx={vi}
                      width={54}
                      placeholder="ラベル"
                      labelDrag={labelDrag}
                      onHandleDown={onHandleDown}
                      onHandleUp={onHandleUp}
                    />
                    <div
                      style={{
                        width: lWeight(label),
                        height: 4,
                        background: lColor(label),
                      }}
                    />
                  </div>
                  {/* 列挿入ボタン */}
                  {!isLast ? (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 2,
                        transform: "translateX(-50%)",
                        zIndex: 5,
                      }}
                    >
                      <InsertBtn
                        onClick={() => insertColAfter(vi)}
                        axis="col"
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 2,
                        transform: "translateX(-50%)",
                        zIndex: 5,
                      }}
                    >
                      <InsertBtn onClick={addCol} axis="col" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── メイン CSS Grid ──────────────────────────────────────
              行 = セル行(rowHeights) + 最下線行(LAST_ROW_H)
              LINE_H 行なし → セル間の余白ゼロ
              横線ラベルは各ガターセルの top:0 translateY(-50%) で線の横に配置
          ──────────────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTCols,
              gridTemplateRows: gridTRows,
              position: "relative",
            }}
          >
            {/* ─ セル行のガター (ri=0..rows-1) ─ */}
            {Array.from({ length: rows }, (_, ri) => (
              <div
                key={`g-${ri}`}
                style={{
                  gridColumn: 1,
                  gridRow: ri + 1,
                  position: "relative",
                  background: "#fafafa",
                  zIndex: 3,
                  // 行の上境界 = hLines[ri] の線と同じスタイル
                  borderTop: `${lWeight(hLines[ri])}px solid ${lColor(hLines[ri])}`,
                }}
              >
                {/* hLines[ri] のラベル → 線の真横（translateY(-50%) で borderTop に中央配置）*/}
                <div style={hLabelStyle}>
                  <LabelBox
                    value={hLines[ri]}
                    onChange={(v) => setHLine(ri, v)}
                    type="h"
                    idx={ri}
                    width={GUTTER - 22}
                    labelDrag={labelDrag}
                    onHandleDown={onHandleDown}
                    onHandleUp={onHandleUp}
                  />
                </div>
                {/* 行リサイズ ▶ハンドル（横線上） */}
                {ri > 0 && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setResizing({
                        type: "row",
                        idx: ri - 1,
                        startPos: e.clientY,
                        startSize: rowHeights[ri - 1],
                      });
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setResizing({
                        type: "row",
                        idx: ri - 1,
                        startPos: e.touches[0].clientY,
                        startSize: rowHeights[ri - 1],
                      });
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      transform: "translateY(-50%)",
                      cursor: "row-resize",
                      zIndex: 15,
                      fontSize: 11,
                      color: "#3aaa7a",
                      lineHeight: 1,
                      userSelect: "none",
                      touchAction: "none",
                    }}
                    title="ドラッグで高さ変更"
                  >
                    ▶
                  </div>
                )}
                {/* 行挿入ボタン（行の中央） */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                  }}
                >
                  <InsertBtn onClick={() => insertRowAfter(ri)} axis="row" />
                </div>
              </div>
            ))}

            {/* ─ 最下線行のガター（hLines[rows]） ─ */}
            <div
              style={{
                gridColumn: 1,
                gridRow: rows + 1,
                position: "relative",
                background: "#fafafa",
                zIndex: 3,
                borderTop: `${lWeight(hLines[rows])}px solid ${lColor(hLines[rows])}`,
              }}
            >
              <div style={hLabelStyle}>
                <LabelBox
                  value={hLines[rows]}
                  onChange={(v) => setHLine(rows, v)}
                  type="h"
                  idx={rows}
                  width={GUTTER - 22}
                  labelDrag={labelDrag}
                  onHandleDown={onHandleDown}
                  onHandleUp={onHandleUp}
                />
              </div>
              {/* 行追加ボタン（最下部） */}
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <InsertBtn onClick={addRow} axis="row" />
              </div>
              {/* 最終行リサイズ ▶ハンドル（横線上） */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setResizing({
                    type: "row",
                    idx: rows - 1,
                    startPos: e.clientY,
                    startSize: rowHeights[rows - 1],
                  });
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setResizing({
                    type: "row",
                    idx: rows - 1,
                    startPos: e.touches[0].clientY,
                    startSize: rowHeights[rows - 1],
                  });
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  transform: "translateY(-50%)",
                  cursor: "row-resize",
                  zIndex: 15,
                  fontSize: 11,
                  color: "#3aaa7a",
                  lineHeight: 1,
                  userSelect: "none",
                  touchAction: "none",
                }}
                title="ドラッグで高さ変更"
              >
                ▶
              </div>
            </div>

            {/* ─ 最下線ビジュアル（全セル列） ─ */}
            <div
              style={{
                gridColumn: `2/${cols + 2}`,
                gridRow: rows + 1,
                borderTop: `${lWeight(hLines[rows])}px solid ${lColor(hLines[rows])}`,
                pointerEvents: "none",
              }}
            />

            {/* ─ セル ─ */}
            {Array.from({ length: rows }, (_, ri) =>
              Array.from({ length: cols }, (_, ci) => {
                if (isCovered(ri, ci)) return null;
                const m = getMerge(ri, ci) ?? { rowSpan: 1, colSpan: 1 };
                const { rowSpan, colSpan } = m;
                const isMerged = rowSpan > 1 || colSpan > 1;
                const isSel = inSel(ri, ci);
                const isEdit = editing?.r === ri && editing?.c === ci;

                const bTop = `${lWeight(hLines[ri])}px solid ${lColor(hLines[ri])}`;
                const bLeft = `${lWeight(vLines[ci])}px solid ${lColor(vLines[ci])}`;
                const bRight =
                  ci + colSpan === cols
                    ? `${lWeight(vLines[ci + colSpan])}px solid ${lColor(vLines[ci + colSpan])}`
                    : "none";
                // 結合が最終行に達する場合、または最終行の単セル → 下線も表示
                const bBottom =
                  ri + rowSpan === rows
                    ? `${lWeight(hLines[rows])}px solid ${lColor(hLines[rows])}`
                    : "none";

                return (
                  <div
                    key={`c-${ri}-${ci}`}
                    data-row={ri}
                    data-col={ci}
                    style={{
                      gridRow: `${ri + 1}/span ${rowSpan}`,
                      gridColumn: `${ci + 2}/span ${colSpan}`,
                      borderTop: bTop,
                      borderLeft: bLeft,
                      borderRight: bRight,
                      borderBottom: bBottom,
                      background: isEdit
                        ? "#fffde8"
                        : isSel
                          ? "#e8f2ff"
                          : "#fff",
                      boxSizing: "border-box",
                      position: "relative",
                      outline: isSel ? "3px solid #4a90d9" : "none",
                      outlineOffset: -1,
                      boxShadow: isSel ? "0 0 0 2px #4a90d9" : "none",
                      overflow: "hidden",
                      cursor: "default",
                    }}
                    onMouseDown={(e) => onCellDown(ri, ci, e)}
                    onTouchStart={(e) => onCellDown(ri, ci, e)}
                    onMouseEnter={() => onCellEnter(ri, ci)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditing({ r: ri, c: ci });
                      setSelection(normSel(ri, ci, ri, ci));
                    }}
                  >
                    {isMerged && (
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          fontSize: 8,
                          color: "#c4b5fd",
                          pointerEvents: "none",
                        }}
                      >
                        ⊞
                      </div>
                    )}
                    {isEdit ? (
                      <textarea
                        autoFocus
                        value={cells[ri][ci]}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        onBlur={() => setEditing(null)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          outline: "2px solid #4a90d9",
                          outlineOffset: -2,
                          resize: "none",
                          padding: "6px 8px",
                          fontSize: 13,
                          fontFamily: "inherit",
                          background: "transparent",
                          color: "#333",
                          lineHeight: 1.6,
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          padding: "6px 8px",
                          fontSize: 13,
                          color: cells[ri][ci] ? "#333" : "#ddd",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          lineHeight: 1.6,
                          userSelect: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        {cells[ri][ci] || "・"}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 11, color: "#bbb", lineHeight: 2 }}>
        💡 <strong style={{ color: "#4a90d9" }}>▼</strong>/
        <strong style={{ color: "#3aaa7a" }}>▶</strong>
        ハンドルをドラッグでサイズ変更。
        <strong style={{ color: "#4a90d9" }}>青い＋</strong>で列を右に挿入。
        <strong style={{ color: "#3aaa7a" }}>緑の＋</strong>
        で行を下に挿入（結合も自動調整）。
        <strong style={{ color: "#aaa" }}>⠿ 長押し</strong>でラベル並び替え。
        <strong style={{ color: "#8b5cf6" }}>
          ドラッグ選択→⊞結合 / 結合セル→⊟解除
        </strong>
        。 ダブルクリックで編集。
      </p>
    </div>
  );
}
