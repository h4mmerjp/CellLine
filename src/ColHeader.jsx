import { DEF_W } from "./reducer";
import { LabelBox, InsertBtn } from "./components";

const GUTTER = 110;

const lColor = (l) => (l ? "#333" : "#ddd");
const lWeight = (l) => (l ? 2 : 1);

const resizeHandleStyle = {
  position: "absolute",
  left: 0,
  bottom: 0,
  transform: "translateX(-50%)",
  cursor: "col-resize",
  color: "#4a90d9",
  zIndex: 15,
  fontSize: 11,
  lineHeight: 1,
  userSelect: "none",
  touchAction: "none",
};

export default function ColHeader({
  vLines,
  colWidths,
  dispatch,
  labelDrag,
  onHandleDown,
  onHandleUp,
  cellReorder,
  onCellHandleDown,
  onCellHandleUp,
  startResize,
  selection,
}) {
  return (
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
            {/* 選択列インジケーター */}
            {!isLast &&
              selection &&
              vi >= selection.c1 &&
              vi <= selection.c2 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#e8f2ff",
                    borderLeft: "2px solid #4a90d9",
                    borderRight: "2px solid #4a90d9",
                    borderTop: "2px solid #4a90d9",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
              )}
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
            {/* 列幅リサイズ */}
            {vi > 0 && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startResize("col", vi - 1, e.clientX, colWidths[vi - 1]);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startResize(
                    "col",
                    vi - 1,
                    e.touches[0].clientX,
                    colWidths[vi - 1],
                  );
                }}
                style={resizeHandleStyle}
                title="ドラッグで幅変更"
              >
                ▼
              </div>
            )}
            {/* ラベル */}
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
                onChange={(v) =>
                  dispatch({ type: "SET_VLINE", idx: vi, value: v })
                }
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
            {/* 列セル並び替えハンドル */}
            {!isLast && (
              <div
                onMouseDown={(e) => onCellHandleDown("v", vi, e)}
                onMouseUp={onCellHandleUp}
                onTouchStart={(e) => onCellHandleDown("v", vi, e)}
                onTouchEnd={onCellHandleUp}
                onContextMenu={(e) => e.preventDefault()}
                title="長押しで列を移動（ラベル固定）"
                style={{
                  position: "absolute",
                  right: 2,
                  top: 2,
                  cursor: "grab",
                  fontSize: 9,
                  color:
                    cellReorder?.type === "v" && cellReorder.to === vi
                      ? "#f59e0b"
                      : "#bbb",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  touchAction: "none",
                  zIndex: 6,
                  transform: "rotate(90deg)",
                }}
              >
                ⠿
              </div>
            )}
            {/* 列挿入 */}
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
                onClick={() =>
                  isLast
                    ? dispatch({ type: "ADD_COL" })
                    : dispatch({ type: "INSERT_COL_AFTER", idx: vi })
                }
                axis="col"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
