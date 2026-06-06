import { useState } from "react";

// ── LabelBox ─────────────────────────────────────────────────────────
export const LabelBox = ({
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
            background: drag ? "#e8f4ff" : "transparent",
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

// ── InsertBtn ─────────────────────────────────────────────────────────
export const InsertBtn = ({ onClick, axis }) => (
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
