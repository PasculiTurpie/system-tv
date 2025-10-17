import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import api from "../../utils/api";
import EquipoDetail from "../Equipment/EquipoDetail";
import EquipoIrd from "../Equipment/EquipoIrd";
import {
  isRouterNode,
  summarizeRouterEdges,
  getNodeHandleUsage,
  collectNodeMulticastConflicts,
} from "./diagramUtils";

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

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const NodeEquipmentSidebar = ({
  node,
  edges = [],
  readOnly = false,
  onLabelChange,
  onDataPatch,
  onLabelPositionChange,
  onMulticastPositionChange,
  onFocusNode,
  onDuplicateNode,
  onToggleNodeLock,
  onEnsureRouterEdges,
  onRegenerateRouterEdges,
  persistLabelPositions,
}) => {
  const [pinned, setPinned] = useState(false);
  const [activeNode, setActiveNode] = useState(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [labelPosDraft, setLabelPosDraft] = useState({ x: "", y: "" });
  const [multicastPosDraft, setMulticastPosDraft] = useState({ x: "", y: "" });
  const [feedback, setFeedback] = useState(null);

  const [equipoState, setEquipoState] = useState(() => createEmptyState());
  const [irdState, setIrdState] = useState(() => createEmptyState());

  useEffect(() => {
    if (node) {
      setActiveNode(node);
      return;
    }
    if (!pinned) {
      setActiveNode(null);
    }
  }, [node, pinned]);

  useEffect(() => {
    if (!activeNode) {
      setLabelDraft("");
      setImageDraft("");
      setTagsDraft([]);
      setLabelPosDraft({ x: "", y: "" });
      setMulticastPosDraft({ x: "", y: "" });
      setFeedback(null);
      return;
    }
    setFeedback(null);
    setLabelDraft(activeNode.data?.label ?? "");
    setImageDraft(activeNode.data?.image ?? "");
    const tags = Array.isArray(activeNode.data?.tags)
      ? activeNode.data.tags.map((tag) => String(tag))
      : [];
    setTagsDraft(tags);
    setLabelPosDraft({
      x: activeNode.data?.labelPosition?.x ?? "",
      y: activeNode.data?.labelPosition?.y ?? "",
    });
    setMulticastPosDraft({
      x: activeNode.data?.multicastPosition?.x ?? "",
      y: activeNode.data?.multicastPosition?.y ?? "",
    });
  }, [activeNode]);

  const equipoId = useMemo(() => {
    if (!activeNode) return null;
    const fromData = extractId(activeNode?.data?.equipoId ?? activeNode?.data?.equipo);
    const fromRoot = extractId(activeNode?.equipoId ?? activeNode?.equipo);
    return fromData ?? fromRoot ?? null;
  }, [activeNode]);

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
          error:
            err?.response?.data?.message || err?.message || "Error al cargar el equipo",
        });
      });

    return () => {
      active = false;
    };
  }, [equipoId]);

  useEffect(() => {
    let active = true;

    if (!activeNode) {
      setIrdState(createEmptyState());
      return () => {
        active = false;
      };
    }

    const equipoData = equipoState.data;
    const irdCandidate =
      extractId(activeNode?.data?.irdId ?? activeNode?.data?.irdRef ?? activeNode?.data?.ird) ??
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
  }, [activeNode, equipoState.data]);

  const handleUsage = useMemo(
    () => getNodeHandleUsage(activeNode, edges),
    [activeNode, edges]
  );

  const routerSummary = useMemo(
    () => (activeNode && isRouterNode(activeNode) ? summarizeRouterEdges(activeNode, edges) : null),
    [activeNode, edges]
  );

  const multicastConflicts = useMemo(
    () => collectNodeMulticastConflicts(activeNode?.id, edges),
    [activeNode?.id, edges]
  );

  const pendingEdges = useMemo(
    () =>
      edges.filter(
        (edge) =>
          !!edge?.data?.pending &&
          (edge.source === activeNode?.id || edge.target === activeNode?.id)
      ),
    [edges, activeNode?.id]
  );

  const locked = Boolean(activeNode?.data?.locked);

  const submitLabel = useCallback(() => {
    if (!activeNode || readOnly) return;
    const next = labelDraft.trim();
    onLabelChange?.(activeNode.id, next);
  }, [activeNode, labelDraft, onLabelChange, readOnly]);

  const submitImage = useCallback(() => {
    if (!activeNode || readOnly) return;
    onDataPatch?.(activeNode.id, { image: imageDraft.trim() || undefined });
  }, [activeNode, imageDraft, onDataPatch, readOnly]);

  const submitTags = useCallback(
    (nextTags) => {
      if (!activeNode || readOnly) return;
      setTagsDraft(nextTags);
      onDataPatch?.(activeNode.id, { tags: nextTags });
    },
    [activeNode, onDataPatch, readOnly]
  );

  const handleAddTag = useCallback(() => {
    const candidate = tagInput.trim();
    if (!candidate) return;
    if (tagsDraft.includes(candidate)) {
      setTagInput("");
      return;
    }
    const nextTags = [...tagsDraft, candidate];
    setTagInput("");
    submitTags(nextTags);
  }, [tagInput, tagsDraft, submitTags]);

  const handleRemoveTag = useCallback(
    (tag) => {
      const nextTags = tagsDraft.filter((item) => item !== tag);
      submitTags(nextTags);
    },
    [tagsDraft, submitTags]
  );

  const persistNodePosition = useCallback(
    (key, value) => {
      if (!persistLabelPositions || !activeNode) return;
      persistLabelPositions({
        nodes: {
          [activeNode.id]: {
            [key]: value,
          },
        },
      });
    },
    [persistLabelPositions, activeNode]
  );

  const submitLabelPosition = useCallback(() => {
    if (!activeNode || readOnly) return;
    const x = toNumberOrNull(labelPosDraft.x);
    const y = toNumberOrNull(labelPosDraft.y);
    const next = x === null || y === null ? null : { x, y };
    onLabelPositionChange?.(activeNode.id, next);
    persistNodePosition("labelPosition", next);
  }, [activeNode, labelPosDraft, onLabelPositionChange, persistNodePosition, readOnly]);

  const submitMulticastPosition = useCallback(() => {
    if (!activeNode || readOnly) return;
    const x = toNumberOrNull(multicastPosDraft.x);
    const y = toNumberOrNull(multicastPosDraft.y);
    const next = x === null || y === null ? null : { x, y };
    onMulticastPositionChange?.(activeNode.id, next);
    persistNodePosition("multicastPosition", next);
  }, [activeNode, multicastPosDraft, onMulticastPositionChange, persistNodePosition, readOnly]);

  const handleEnsureRouterEdges = useCallback(
    (force = false) => {
      if (!activeNode || !isRouterNode(activeNode)) return;
      const action = force ? onRegenerateRouterEdges : onEnsureRouterEdges;
      if (!action) return;
      const result = action(activeNode) || { added: 0, removed: 0 };
      if (result.added || result.removed) {
        setFeedback(
          force
            ? `Router actualizado: ${result.removed} aristas reemplazadas, ${result.added} generadas.`
            : `Router actualizado: ${result.added} aristas creadas.`
        );
      } else {
        setFeedback("Sin cambios en las aristas automáticas del router.");
      }
    },
    [activeNode, onEnsureRouterEdges, onRegenerateRouterEdges]
  );

  const closePanel = useCallback(() => {
    setPinned(false);
    setActiveNode(null);
  }, []);

  const handleDuplicate = useCallback(() => {
    if (!activeNode || readOnly) return;
    onDuplicateNode?.(activeNode.id);
  }, [activeNode, onDuplicateNode, readOnly]);

  const handleLockToggle = useCallback(() => {
    if (!activeNode || readOnly) return;
    onToggleNodeLock?.(activeNode.id, !locked);
  }, [activeNode, onToggleNodeLock, locked, readOnly]);

  return (
    <aside className="channel-diagram__sidebar" aria-live="polite">
      <div className="channel-diagram__sidebar-header">
        <div>
          <h2 className="channel-diagram__sidebar-title">Inspector de nodo</h2>
          <p className="channel-diagram__sidebar-subtitle">
            {activeNode ? activeNode.data?.label || activeNode.id : "Sin selección"}
          </p>
        </div>
        <div className="channel-diagram__sidebar-actions">
          <button
            type="button"
            className={`channel-diagram__pin ${pinned ? "is-active" : ""}`}
            onClick={() => setPinned((value) => !value)}
            aria-pressed={pinned}
          >
            {pinned ? "Desfijar" : "Fijar"}
          </button>
          <button
            type="button"
            className="channel-diagram__close"
            onClick={closePanel}
            aria-label="Cerrar panel"
          >
            ×
          </button>
        </div>
      </div>

      {!activeNode && (
        <p className="channel-diagram__sidebar-empty">
          Selecciona un nodo para editarlo o fíjalo para revisar sus datos.
        </p>
      )}

      {activeNode && (
        <>
          <div className="channel-diagram__sidebar-section" data-section="summary">
            <dl className="channel-diagram__definition-list">
              <div>
                <dt>ID nodo</dt>
                <dd>{activeNode.id}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{activeNode.type || "custom"}</dd>
              </div>
              <div>
                <dt>Equipo asociado</dt>
                <dd>{equipoId || "—"}</dd>
              </div>
              <div>
                <dt>Creado</dt>
                <dd>{formatDate(activeNode.data?.createdAt)}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{formatDate(activeNode.data?.updatedAt)}</dd>
              </div>
            </dl>
            <div className="channel-diagram__quick-actions">
              <button
                type="button"
                onClick={() => onFocusNode?.(activeNode.id)}
                className="channel-diagram__button"
              >
                Centrar vista
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className="channel-diagram__button"
                disabled={readOnly}
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={handleLockToggle}
                className="channel-diagram__button"
                disabled={readOnly}
              >
                {locked ? "Desbloquear" : "Bloquear posición"}
              </button>
            </div>
          </div>

          <div className="channel-diagram__sidebar-section" data-section="editable">
            <label className="channel-diagram__label" htmlFor="node-label-input">
              Etiqueta
            </label>
            <input
              id="node-label-input"
              className="channel-diagram__input"
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              onBlur={submitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitLabel();
                }
              }}
              disabled={readOnly}
            />

            <label className="channel-diagram__label" htmlFor="node-image-input">
              Imagen/Icono (URL)
            </label>
            <input
              id="node-image-input"
              className="channel-diagram__input"
              value={imageDraft}
              onChange={(event) => setImageDraft(event.target.value)}
              onBlur={submitImage}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitImage();
                }
              }}
              disabled={readOnly}
            />

            <div className="channel-diagram__tags">
              <label className="channel-diagram__label" htmlFor="node-tag-input">
                Tags
              </label>
              <div className="channel-diagram__tag-editor">
                <input
                  id="node-tag-input"
                  className="channel-diagram__input"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={readOnly}
                  placeholder="Añadir tag y presionar Enter"
                />
                <button
                  type="button"
                  className="channel-diagram__button"
                  onClick={handleAddTag}
                  disabled={readOnly}
                >
                  Añadir
                </button>
              </div>
              <div className="channel-diagram__chips">
                {tagsDraft.map((tag) => (
                  <span key={tag} className="channel-diagram__chip">
                    {tag}
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Eliminar ${tag}`}
                        onClick={() => handleRemoveTag(tag)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {!tagsDraft.length && <span className="channel-diagram__chip is-empty">Sin tags</span>}
              </div>
            </div>
          </div>

          <div className="channel-diagram__sidebar-section" data-section="positions">
            <h3 className="channel-diagram__sidebar-subtitle">Posiciones de etiquetas</h3>
            <div className="channel-diagram__grid-two">
              <label className="channel-diagram__label" htmlFor="label-pos-x">
                Label X
              </label>
              <input
                id="label-pos-x"
                className="channel-diagram__input"
                value={labelPosDraft.x}
                onChange={(event) =>
                  setLabelPosDraft((prev) => ({ ...prev, x: event.target.value }))
                }
                onBlur={submitLabelPosition}
                disabled={readOnly}
                inputMode="numeric"
              />
              <label className="channel-diagram__label" htmlFor="label-pos-y">
                Label Y
              </label>
              <input
                id="label-pos-y"
                className="channel-diagram__input"
                value={labelPosDraft.y}
                onChange={(event) =>
                  setLabelPosDraft((prev) => ({ ...prev, y: event.target.value }))
                }
                onBlur={submitLabelPosition}
                disabled={readOnly}
                inputMode="numeric"
              />
            </div>

            <div className="channel-diagram__grid-two">
              <label className="channel-diagram__label" htmlFor="multicast-pos-x">
                Multicast X
              </label>
              <input
                id="multicast-pos-x"
                className="channel-diagram__input"
                value={multicastPosDraft.x}
                onChange={(event) =>
                  setMulticastPosDraft((prev) => ({ ...prev, x: event.target.value }))
                }
                onBlur={submitMulticastPosition}
                disabled={readOnly}
                inputMode="numeric"
              />
              <label className="channel-diagram__label" htmlFor="multicast-pos-y">
                Multicast Y
              </label>
              <input
                id="multicast-pos-y"
                className="channel-diagram__input"
                value={multicastPosDraft.y}
                onChange={(event) =>
                  setMulticastPosDraft((prev) => ({ ...prev, y: event.target.value }))
                }
                onBlur={submitMulticastPosition}
                disabled={readOnly}
                inputMode="numeric"
              />
            </div>
          </div>

          {isRouterNode(activeNode) && (
            <div className="channel-diagram__sidebar-section" data-section="router">
              <h3 className="channel-diagram__sidebar-subtitle">Router</h3>
              {routerSummary && (
                <p className="channel-diagram__info">
                  {`Aristas esperadas: ${routerSummary.expected}. Existentes: ${routerSummary.existing}. Faltantes: ${routerSummary.missing}.`}
                </p>
              )}
              <div className="channel-diagram__quick-actions">
                <button
                  type="button"
                  className="channel-diagram__button"
                  onClick={() => handleEnsureRouterEdges(false)}
                  disabled={readOnly}
                >
                  Crear edges por defecto
                </button>
                <button
                  type="button"
                  className="channel-diagram__button"
                  onClick={() => handleEnsureRouterEdges(true)}
                  disabled={readOnly}
                >
                  Regenerar edges
                </button>
              </div>
            </div>
          )}

          <div className="channel-diagram__sidebar-section" data-section="handles">
            <h3 className="channel-diagram__sidebar-subtitle">Puertos conectados</h3>
            <table className="channel-diagram__handles-table">
              <thead>
                <tr>
                  <th>Handle</th>
                  <th>Tipo</th>
                  <th>Conexiones</th>
                </tr>
              </thead>
              <tbody>
                {handleUsage.map((entry) => (
                  <tr key={entry.id} className={entry.connections.length > 1 ? "is-warning" : ""}>
                    <td>{entry.id}</td>
                    <td>{entry.kind === "in" ? "Entrada" : "Salida"}</td>
                    <td>
                      {entry.connections.length ? (
                        <ul>
                          {entry.connections.map((connection) => (
                            <li key={connection.edgeId}>
                              {connection.edgeId}
                              {connection.multicast && (
                                <span className="channel-diagram__badge">{connection.multicast}</span>
                              )}
                              {connection.pending && (
                                <span className="channel-diagram__badge is-pending">Pendiente</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="channel-diagram__muted">Sin conexiones</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(multicastConflicts.length > 0 || pendingEdges.length > 0) && (
            <div className="channel-diagram__sidebar-section" data-section="alerts">
              <h3 className="channel-diagram__sidebar-subtitle">Alertas</h3>
              {multicastConflicts.map((conflict) => (
                <div key={conflict.key} className="channel-diagram__alert">
                  <strong>Multicast duplicado:</strong> {conflict.key}
                  <ul>
                    {conflict.edges.map((edge) => (
                      <li key={edge.id}>{edge.id}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {pendingEdges.length > 0 && (
                <div className="channel-diagram__alert">
                  <strong>Edges pendientes:</strong>
                  <ul>
                    {pendingEdges.map((edge) => (
                      <li key={edge.id}>{edge.id}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="channel-diagram__sidebar-section" data-section="details">
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

          {feedback && (
            <div className="channel-diagram__toast" role="status">
              {feedback}
              <button type="button" onClick={() => setFeedback(null)}>
                Cerrar
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
};

NodeEquipmentSidebar.propTypes = {
  node: PropTypes.object,
  edges: PropTypes.arrayOf(PropTypes.object),
  readOnly: PropTypes.bool,
  onLabelChange: PropTypes.func,
  onDataPatch: PropTypes.func,
  onLabelPositionChange: PropTypes.func,
  onMulticastPositionChange: PropTypes.func,
  onFocusNode: PropTypes.func,
  onDuplicateNode: PropTypes.func,
  onToggleNodeLock: PropTypes.func,
  onEnsureRouterEdges: PropTypes.func,
  onRegenerateRouterEdges: PropTypes.func,
  persistLabelPositions: PropTypes.func,
};

export default NodeEquipmentSidebar;
