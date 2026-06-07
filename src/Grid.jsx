import { DEF_H } from "./reducer";
import { LabelBox, InsertBtn } from "./components";
import ColHeader from "./ColHeader";

const lColor = (l) => (l ? "#333" : "#ddd");
const lWeight = (l) => (l ? 2 : 1);
const GUTTER = 110;
const LAST_ROW_H = 20;

const normSel = (r1, c1, r2, c2) => ({
  r1: Math.min(r1, r2),
  r2: Math.max(r1, r2),
  c1: Math.min(c1, c2),
  c2: Math.max(c1, c2),
});

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

const resizeHandle = (dir) => ({
  position: "absolute",
  ...(dir === "col"
    ? {
        left: 0,
        bottom: 0,
        transform: "translateX(-50%)",
        cursor: "col-resize",
        color: "#4a90d9",
      }
    : {
        top: 0,
        right: 0,
        transform: "translateY(-50%)",
        cursor: "row-resize",
        color: "#3aaa7a",
      }),
  zIndex: 15,
  fontSize: 11,
  lineHeight: 1,
  userSelect: "none",
  touchAction: "none",
});

export default function Grid({
  present,
  dispatch,
  selection,
  editing,
  labelDrag,
  resizing,
  onCellDown,
  onCellTouchStart,
  onCellEnter,
  startResize,
  onHandleDown,
  onHandleUp,
  cellReorder,
  onCellHandleDown,
  onCellHandleUp,
  setEditing,
  setSelection,
}) {
  const { vLines, hLines, cells, colWidths, rowHeights, merges } = present;
  const rows = hLines.length - 1;
  const cols = vLines.length - 1;

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

  const gridTCols = `${GUTTER}px ${colWidths.map((w) => `${w}px`).join(" ")}`;
  const gridTRows = [
    ...rowHeights.map((h) => `${h}px`),
    `${LAST_ROW_H}px`,
  ].join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-block" }}>
        {/* 縦線ラベル行 */}
        <ColHeader
          vLines={vLines}
          colWidths={colWidths}
          dispatch={dispatch}
          labelDrag={labelDrag}
          onHandleDown={onHandleDown}
          onHandleUp={onHandleUp}
          cellReorder={cellReorder}
          onCellHandleDown={onCellHandleDown}
          onCellHandleUp={onCellHandleUp}
          startResize={startResize}
        />

        {/* メイン CSS Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridTCols,
            gridTemplateRows: gridTRows,
            position: "relative",
          }}
        >
          {/* セル行ガター */}
          {Array.from({ length: rows }, (_, ri) => (
            <div
              key={`g-${ri}`}
              style={{
                gridColumn: 1,
                gridRow: ri + 1,
                position: "relative",
                background: "#fafafa",
                zIndex: 3,
              }}
            >
              <div style={{ ...hLabelStyle, background: "transparent" }}>
                <LabelBox
                  value={hLines[ri]}
                  onChange={(v) =>
                    dispatch({ type: "SET_HLINE", idx: ri, value: v })
                  }
                  type="h"
                  idx={ri}
                  width={GUTTER - 22}
                  labelDrag={labelDrag}
                  onHandleDown={onHandleDown}
                  onHandleUp={onHandleUp}
                />
              </div>
              {ri > 0 && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startResize("row", ri - 1, e.clientY, rowHeights[ri - 1]);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    startResize(
                      "row",
                      ri - 1,
                      e.touches[0].clientY,
                      rowHeights[ri - 1],
                    );
                  }}
                  style={resizeHandle("row")}
                  title="ドラッグで高さ変更"
                >
                  ▶
                </div>
              )}
              {/* 行セル並び替えハンドル */}
              <div
                onMouseDown={(e) => onCellHandleDown("h", ri, e)}
                onMouseUp={onCellHandleUp}
                onTouchStart={(e) => onCellHandleDown("h", ri, e)}
                onTouchEnd={onCellHandleUp}
                onContextMenu={(e) => e.preventDefault()}
                title="長押しで行を移動（ラベル固定）"
                style={{
                  position: "absolute",
                  left: 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "grab",
                  fontSize: 9,
                  color:
                    cellReorder?.type === "h" && cellReorder.to === ri
                      ? "#f59e0b"
                      : "#bbb",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  touchAction: "none",
                  zIndex: 4,
                }}
              >
                ⠿
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                }}
              >
                <InsertBtn
                  onClick={() =>
                    dispatch({ type: "INSERT_ROW_AFTER", idx: ri })
                  }
                  axis="row"
                />
              </div>
            </div>
          ))}

          {/* 最下線ガター */}
          <div
            style={{
              gridColumn: 1,
              gridRow: rows + 1,
              position: "relative",
              background: "#fafafa",
              zIndex: 3,
            }}
          >
            <div style={hLabelStyle}>
              <LabelBox
                value={hLines[rows]}
                onChange={(v) =>
                  dispatch({ type: "SET_HLINE", idx: rows, value: v })
                }
                type="h"
                idx={rows}
                width={GUTTER - 22}
                labelDrag={labelDrag}
                onHandleDown={onHandleDown}
                onHandleUp={onHandleUp}
              />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 4,
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <InsertBtn
                onClick={() => dispatch({ type: "ADD_ROW" })}
                axis="row"
              />
            </div>
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startResize("row", rows - 1, e.clientY, rowHeights[rows - 1]);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                startResize(
                  "row",
                  rows - 1,
                  e.touches[0].clientY,
                  rowHeights[rows - 1],
                );
              }}
              style={resizeHandle("row")}
              title="ドラッグで高さ変更"
            >
              ▶
            </div>
          </div>

          {/* 最下線ビジュアル */}
          <div
            style={{
              gridColumn: `2/${cols + 2}`,
              gridRow: rows + 1,
              borderTop: `${lWeight(hLines[rows])}px solid ${lColor(hLines[rows])}`,
              pointerEvents: "none",
            }}
          />

          {/* セル */}
          {Array.from({ length: rows }, (_, ri) =>
            Array.from({ length: cols }, (_, ci) => {
              if (isCovered(ri, ci)) return null;
              const m = getMerge(ri, ci) ?? { rowSpan: 1, colSpan: 1 };
              const { rowSpan, colSpan } = m;
              const isSel = inSel(ri, ci);
              const isEdit = editing?.r === ri && editing?.c === ci;
              const isDragRow =
                cellReorder?.type === "h" && cellReorder.to === ri;
              const isDragCol =
                cellReorder?.type === "v" && cellReorder.to === ci;
              const bTop = `${lWeight(hLines[ri])}px solid ${lColor(hLines[ri])}`;
              const bLeft = `${lWeight(vLines[ci])}px solid ${lColor(vLines[ci])}`;
              const bRight =
                ci + colSpan === cols
                  ? `${lWeight(vLines[ci + colSpan])}px solid ${lColor(vLines[ci + colSpan])}`
                  : "none";
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
                        : isDragRow || isDragCol
                          ? "#dbeafe"
                          : "#fff",
                    boxSizing: "border-box",
                    position: "relative",
                    outline: isSel ? "3px solid #4a90d9" : "none",
                    outlineOffset: -1,
                    boxShadow: isSel
                      ? "0 0 0 2px #4a90d9"
                      : isDragRow || isDragCol
                        ? "inset 0 0 0 2px #4a90d9"
                        : "none",
                    overflow: "hidden",
                    cursor: "default",
                  }}
                  onMouseDown={(e) => onCellDown(ri, ci, e)}
                  onTouchStart={(e) => onCellTouchStart(ri, ci, e)}
                  onMouseEnter={() => onCellEnter(ri, ci)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "HISTORY_CHECKPOINT" });
                    setEditing({ r: ri, c: ci });
                    setSelection(normSel(ri, ci, ri, ci));
                  }}
                >
                  {(rowSpan > 1 || colSpan > 1) && (
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
                      onChange={(e) =>
                        dispatch({
                          type: "SET_CELL",
                          r: ri,
                          c: ci,
                          value: e.target.value,
                          skipHistory: true,
                        })
                      }
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
  );
}
