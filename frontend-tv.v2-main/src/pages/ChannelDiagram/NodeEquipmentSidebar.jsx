import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import api from "../../utils/api";
import EquipoDetail from "../Equipment/EquipoDetail";
import EquipoIrd from "../Equipment/EquipoIrd";

const createEmptyState = () => ({ loading: false, data: null, error: null });

const extractId = (value) => {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    const str = String(value).trim();
    return str.length ? str : null;
  }
  if (typeof value === "object") {
    const candidates = [value._id, value.id, value.value, value.key];
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const str = String(candidate).trim();
      if (str.length) return str;
    }
  }
  return null;
};

const NodeEquipmentSidebar = ({ node }) => {
  const [equipoState, setEquipoState] = useState(() => createEmptyState());
  const [irdState, setIrdState] = useState(() => createEmptyState());

  const equipoId = useMemo(() => {
    if (!node) return null;
    const fromData = extractId(node?.data?.equipoId ?? node?.data?.equipo);
    const fromRoot = extractId(node?.equipoId ?? node?.equipo);
    return fromData ?? fromRoot ?? null;
  }, [node]);

  useEffect(() => {
    let active = true;

    if (!equipoId) {
      setEquipoState(createEmptyState());
      setIrdState(createEmptyState());
      return () => {
        active = false;
      };
    }

    setEquipoState({ loading: true, data: null, error: null });
    setIrdState(createEmptyState());

    api
      .getIdEquipo(equipoId)
      .then((res) => {
        if (!active) return;
        const data = res?.data ?? res;
        setEquipoState({ loading: false, data, error: null });
      })
      .catch((err) => {
        if (!active) return;
        setEquipoState({
          loading: false,
          data: null,
          error: err?.response?.data?.message || err?.message || "Error al cargar el equipo",
        });
      });

    return () => {
      active = false;
    };
  }, [equipoId]);

  useEffect(() => {
    let active = true;

    if (!node) {
      setIrdState(createEmptyState());
      return () => {
        active = false;
      };
    }

    const equipoData = equipoState.data;
    const irdCandidate =
      extractId(node?.data?.irdId ?? node?.data?.irdRef ?? node?.data?.ird) ??
      extractId(equipoData?.irdRef ?? equipoData?.ird);

    if (!irdCandidate) {
      setIrdState(createEmptyState());
      return () => {
        active = false;
      };
    }

    setIrdState({ loading: true, data: null, error: null });

    api
      .getIdIrd(irdCandidate)
      .then((res) => {
        if (!active) return;
        const data = res?.data ?? res;
        setIrdState({ loading: false, data, error: null });
      })
      .catch((err) => {
        if (!active) return;
        setIrdState({
          loading: false,
          data: null,
          error: err?.response?.data?.message || err?.message || "Error al cargar el IRD",
        });
      });

    return () => {
      active = false;
    };
  }, [node, equipoState.data]);

  return (
    <aside className="channel-diagram__sidebar">
      <div className="channel-diagram__sidebar-section">
        <h2 className="channel-diagram__sidebar-title">Detalle del nodo</h2>
        {node ? (
          <div className="channel-diagram__node-summary">
            <div>
              <span className="channel-diagram__summary-label">Nombre:</span>
              <span className="channel-diagram__summary-value">{node?.data?.label || node?.label || node.id}</span>
            </div>
            <div>
              <span className="channel-diagram__summary-label">ID nodo:</span>
              <span className="channel-diagram__summary-value">{node?.id}</span>
            </div>
            <div>
              <span className="channel-diagram__summary-label">Tipo:</span>
              <span className="channel-diagram__summary-value">{node?.type || "custom"}</span>
            </div>
            <div>
              <span className="channel-diagram__summary-label">Equipo asociado:</span>
              <span className="channel-diagram__summary-value">{equipoId || "—"}</span>
            </div>
          </div>
        ) : (
          <p className="channel-diagram__sidebar-empty">Selecciona un nodo para consultar sus detalles.</p>
        )}
      </div>

      {node && (
        <div className="channel-diagram__sidebar-section">
          <EquipoDetail
            equipo={equipoState.data}
            loading={equipoState.loading}
            error={equipoState.error}
            compact
            title="Información del equipo"
          />

          <EquipoIrd
            ird={irdState.data}
            loading={irdState.loading}
            error={irdState.error}
            compact
            title="Información IRD"
          />
        </div>
      )}
    </aside>
  );
};

NodeEquipmentSidebar.propTypes = {
  node: PropTypes.object,
};

export default NodeEquipmentSidebar;
