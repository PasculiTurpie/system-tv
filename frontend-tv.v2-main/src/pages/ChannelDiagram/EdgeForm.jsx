import React, { useEffect, useMemo, useState } from "react";

/**
 * Formulario simple para editar un edge:
 * - label (principal, centro)
 * - multicast (badge en el origen)
 *
 * Si isAuth = false, se muestran deshabilitados.
 */
export default function EdgeForm({ isAuth, edge, onChange, onClose }) {
  const initial = useMemo(() => ({
    label: edge?.label ?? edge?.data?.label ?? "",
    multicast: edge?.data?.multicast ?? "",
  }), [edge]);

  const [label, setLabel] = useState(initial.label);
  const [multicast, setMulticast] = useState(initial.multicast);

  useEffect(() => {
    // si cambias de edge seleccionado, sincroniza
    setLabel(initial.label);
    setMulticast(initial.multicast);
  }, [initial]);

  if (!edge) return null;

  const apply = () => {
    onChange?.({ label, multicast });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        <div><b>ID:</b> {edge.id}</div>
        <div><b>Source:</b> {edge.source} <b>→</b> <b>Target:</b> {edge.target}</div>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Label</span>
        <input
          type="text"
          value={label}
          disabled={!isAuth}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Texto del enlace (centro)"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 10px",
            outline: "none",
          }}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 600 }}>Multicast (opcional)</span>
        <input
          type="text"
          value={multicast}
          disabled={!isAuth}
          onChange={(e) => setMulticast(e.target.value)}
          placeholder="p.ej. 239.2.3.222"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 10px",
            outline: "none",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={!isAuth}
          onClick={apply}
          style={{
            background: "#375d9d",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: isAuth ? "pointer" : "not-allowed",
          }}
        >
          Guardar
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "#e5e7eb",
            color: "#111827",
            border: 0,
            borderRadius: 8,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cerrar
        </button>

        <button
          type="button"
          disabled={!isAuth}
          onClick={() => { setMulticast(""); onChange?.({ label, multicast: "" }); }}
          style={{
            marginLeft: "auto",
            background: "#f59e0b",
            color: "#111827",
            border: 0,
            borderRadius: 8,
            padding: "8px 12px",
            fontWeight: 600,
            cursor: isAuth ? "pointer" : "not-allowed",
          }}
          title="Limpiar multicast"
        >
          Limpiar multicast
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280" }}>
        * Los cambios se guardan en la base automáticamente.
      </div>
    </div>
  );
}
