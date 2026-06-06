export const DEF_W = 120,
  DEF_H = 70,
  MIN_W = 40,
  MIN_H = 30;
export const MAX_HISTORY = 50;

const makeGrid = (r, c) => Array.from({ length: r }, () => Array(c).fill(""));

export const initGridState = (saved) => ({
  vLines: saved?.vLines ?? ["", "", "", "", ""],
  hLines: saved?.hLines ?? ["", "", "", "", ""],
  cells: saved?.cells ?? makeGrid(4, 4),
  colWidths: saved?.colWidths ?? Array(4).fill(DEF_W),
  rowHeights: saved?.rowHeights ?? Array(4).fill(DEF_H),
  merges: saved?.merges ?? [],
});

// 並び替え後に結合セルの座標を更新（跨ぐものは破棄）
const reorderMerges = (merges, axis, f, t) => {
  const mapIdx = (i) => {
    if (f < t) {
      if (i === f) return t;
      if (i > f && i <= t) return i - 1;
    } else {
      if (i === f) return t;
      if (i >= t && i < f) return i + 1;
    }
    return i;
  };
  return merges
    .map((m) => {
      if (axis === "h") {
        const rows = Array.from({ length: m.rowSpan }, (_, i) => m.r + i)
          .map(mapIdx)
          .sort((a, b) => a - b);
        if (!rows.every((r, i) => i === 0 || r === rows[i - 1] + 1))
          return null;
        return { ...m, r: rows[0] };
      } else {
        const cols = Array.from({ length: m.colSpan }, (_, i) => m.c + i)
          .map(mapIdx)
          .sort((a, b) => a - b);
        if (!cols.every((c, i) => i === 0 || c === cols[i - 1] + 1))
          return null;
        return { ...m, c: cols[0] };
      }
    })
    .filter(Boolean);
};

// ── Grid Reducer ─────────────────────────────────────────────────────
export const gridReducer = (state, action) => {
  switch (action.type) {
    case "SET_VLINE":
      return {
        ...state,
        vLines: state.vLines.map((l, i) =>
          i === action.idx ? action.value : l,
        ),
      };
    case "SET_HLINE":
      return {
        ...state,
        hLines: state.hLines.map((l, i) =>
          i === action.idx ? action.value : l,
        ),
      };
    case "SET_VLINES":
      return { ...state, vLines: action.vLines };
    case "SET_HLINES":
      return { ...state, hLines: action.hLines };
    case "SET_CELL":
      return {
        ...state,
        cells: state.cells.map((row, ri) =>
          ri === action.r
            ? row.map((x, ci) => (ci === action.c ? action.value : x))
            : row,
        ),
      };
    case "SET_COL_WIDTH":
      return {
        ...state,
        colWidths: state.colWidths.map((w, i) =>
          i === action.idx ? action.value : w,
        ),
      };
    case "SET_ROW_HEIGHT":
      return {
        ...state,
        rowHeights: state.rowHeights.map((h, i) =>
          i === action.idx ? action.value : h,
        ),
      };
    case "ADD_COL":
      return {
        ...state,
        vLines: [...state.vLines, ""],
        cells: state.cells.map((r) => [...r, ""]),
        colWidths: [...state.colWidths, DEF_W],
      };
    case "REMOVE_COL": {
      const cols = state.vLines.length - 1;
      if (cols <= 1) return state;
      const rc = cols - 1;
      return {
        ...state,
        vLines: state.vLines.slice(0, -1),
        cells: state.cells.map((r) => r.slice(0, -1)),
        colWidths: state.colWidths.slice(0, -1),
        merges: state.merges
          .map((m) => {
            if (m.c >= rc) return null;
            if (m.c + m.colSpan - 1 >= rc) {
              const cs = rc - m.c;
              return cs < 1 ? null : { ...m, colSpan: cs };
            }
            return m;
          })
          .filter(Boolean),
      };
    }
    case "ADD_ROW":
      return {
        ...state,
        hLines: [...state.hLines, ""],
        cells: [...state.cells, Array(state.vLines.length - 1).fill("")],
        rowHeights: [...state.rowHeights, DEF_H],
      };
    case "REMOVE_ROW": {
      const rows = state.hLines.length - 1;
      if (rows <= 1) return state;
      const rr = rows - 1;
      return {
        ...state,
        hLines: state.hLines.slice(0, -1),
        cells: state.cells.slice(0, -1),
        rowHeights: state.rowHeights.slice(0, -1),
        merges: state.merges
          .map((m) => {
            if (m.r >= rr) return null;
            if (m.r + m.rowSpan - 1 >= rr) {
              const rs = rr - m.r;
              return rs < 1 ? null : { ...m, rowSpan: rs };
            }
            return m;
          })
          .filter(Boolean),
      };
    }
    case "INSERT_COL_AFTER": {
      const ci = action.idx;
      const vLines = [...state.vLines];
      vLines.splice(ci + 1, 0, "");
      const cells = state.cells.map((r) => {
        const a = [...r];
        a.splice(ci + 1, 0, "");
        return a;
      });
      const colWidths = [...state.colWidths];
      colWidths.splice(ci + 1, 0, DEF_W);
      const merges = state.merges.map((m) => {
        if (m.c > ci) return { ...m, c: m.c + 1 };
        if (m.c + m.colSpan - 1 >= ci + 1)
          return { ...m, colSpan: m.colSpan + 1 };
        return m;
      });
      return { ...state, vLines, cells, colWidths, merges };
    }
    case "INSERT_ROW_AFTER": {
      const hi = action.idx;
      const hLines = [...state.hLines];
      hLines.splice(hi + 1, 0, "");
      const cells = [...state.cells];
      cells.splice(hi + 1, 0, Array(state.vLines.length - 1).fill(""));
      const rowHeights = [...state.rowHeights];
      rowHeights.splice(hi + 1, 0, DEF_H);
      const merges = state.merges.map((m) => {
        if (m.r > hi) return { ...m, r: m.r + 1 };
        if (m.r + m.rowSpan - 1 >= hi + 1)
          return { ...m, rowSpan: m.rowSpan + 1 };
        return m;
      });
      return { ...state, hLines, cells, rowHeights, merges };
    }
    case "MERGE": {
      const { r1, c1, r2, c2 } = action;
      return {
        ...state,
        merges: [
          ...state.merges.filter(
            (m) =>
              m.r + m.rowSpan - 1 < r1 ||
              m.r > r2 ||
              m.c + m.colSpan - 1 < c1 ||
              m.c > c2,
          ),
          { r: r1, c: c1, rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 },
        ],
      };
    }
    case "UNMERGE":
      return {
        ...state,
        merges: state.merges.filter(
          (m) => !(m.r === action.r && m.c === action.c),
        ),
      };
    case "REORDER_ROW": {
      // cells・rowHeights・hLines を同時に並び替え（行ごと移動）
      const { from: f, to: t } = action;
      if (f === t) return state;
      const ra = (arr) => {
        const a = [...arr];
        const [x] = a.splice(f, 1);
        a.splice(t, 0, x);
        return a;
      };
      return {
        ...state,
        hLines: ra(state.hLines),
        cells: ra(state.cells),
        rowHeights: ra(state.rowHeights),
        merges: reorderMerges(state.merges, "h", f, t),
      };
    }
    case "REORDER_COL": {
      // cells・colWidths・vLines を同時に並び替え（列ごと移動）
      const { from: f, to: t } = action;
      if (f === t) return state;
      const ra = (arr) => {
        const a = [...arr];
        const [x] = a.splice(f, 1);
        a.splice(t, 0, x);
        return a;
      };
      return {
        ...state,
        vLines: ra(state.vLines),
        cells: state.cells.map((row) => ra(row)),
        colWidths: ra(state.colWidths),
        merges: reorderMerges(state.merges, "v", f, t),
      };
    }
    case "REORDER_ROW_CELLS": {
      // ラベルは動かさず、セル・高さ・結合だけ並び替え
      const { from: f, to: t } = action;
      if (f === t) return state;
      const ra = (arr) => {
        const a = [...arr];
        const [x] = a.splice(f, 1);
        a.splice(t, 0, x);
        return a;
      };
      return {
        ...state,
        cells: ra(state.cells),
        rowHeights: ra(state.rowHeights),
        merges: reorderMerges(state.merges, "h", f, t),
      };
    }
    case "REORDER_COL_CELLS": {
      // ラベルは動かさず、セル・幅・結合だけ並び替え
      const { from: f, to: t } = action;
      if (f === t) return state;
      const ra = (arr) => {
        const a = [...arr];
        const [x] = a.splice(f, 1);
        a.splice(t, 0, x);
        return a;
      };
      return {
        ...state,
        cells: state.cells.map((row) => ra(row)),
        colWidths: ra(state.colWidths),
        merges: reorderMerges(state.merges, "v", f, t),
      };
    }
    case "LOAD":
      return {
        vLines: action.data.vLines ?? state.vLines,
        hLines: action.data.hLines ?? state.hLines,
        cells: action.data.cells ?? state.cells,
        colWidths: action.data.colWidths ?? state.colWidths,
        rowHeights: action.data.rowHeights ?? state.rowHeights,
        merges: action.data.merges ?? state.merges,
      };
    default:
      return state;
  }
};

// ── History Reducer ───────────────────────────────────────────────────
// HISTORY_CHECKPOINT : 現在の present を past に積む
// skipHistory: true  : present を更新するが past には積まない（ライブ更新）
// 通常アクション     : present を更新して past に積む
export const historyReducer = (state, action) => {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "REDO") {
    if (state.future.length === 0) return state;
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  if (action.type === "HISTORY_CHECKPOINT") {
    return {
      past: [...state.past, state.present].slice(-MAX_HISTORY),
      present: state.present,
      future: [],
    };
  }
  const newPresent = gridReducer(state.present, action);
  if (newPresent === state.present) return state;
  if (action.skipHistory) {
    return { ...state, present: newPresent };
  }
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: newPresent,
    future: [],
  };
};
