import { memo, useMemo } from "react";

const baseStyle = Object.freeze({
  padding: 12,
  borderRadius: 12,
  border: "1px solid #1f2937",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 600,
  minWidth: 160,
  textAlign: "center",
  userSelect: "none",
  position: "relative",
  boxShadow: "0 8px 16px rgba(15, 23, 42, 0.08)",
});

const labelStyle = Object.freeze({
  fontSize: 14,
  lineHeight: "18px",
  marginBottom: 4,
});

const FlowNodeShell = ({ data, children }) => {
  const label = useMemo(() => {
    const raw = data?.label ?? data?.name;
    if (!raw) return "Nodo";
    return String(raw);
  }, [data]);

  const backgroundImage = data?.backgroundImage || data?.icon;

  const style = useMemo(() => {
    if (!backgroundImage) return baseStyle;
    return {
      ...baseStyle,
      backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url(${backgroundImage})`,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    };
  }, [backgroundImage]);

  return (
    <div style={style} title={label} aria-label={label} role="group">
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
};

export default memo(FlowNodeShell);
