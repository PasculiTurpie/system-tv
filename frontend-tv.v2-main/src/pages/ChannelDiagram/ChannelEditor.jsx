import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow, 
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Handle,
  Position,
} from "@xyflow/react";
import Select from "react-select";
import "@xyflow/react/dist/style.css";
import Swal from "sweetalert2";
import api from "../../utils/api";
import "./ChannelDiagram.css";

// Componente para nodos personalizados
const CustomNode = ({ data }) => {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "2px solid #555",
        backgroundColor: data.bgColor || "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 120,
      }}
    >
      <img
        src={data.icon}
        alt={data.label}
        style={{ width: 40, height: 40, marginBottom: 5 }}
      />
      <strong>{data.label}</strong>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Registro de íconos según tipo de equipo
const iconsMap = {
  antena: "https://cdn-icons-png.flaticon.com/512/1048/1048953.png",
  ird: "https://cdn-icons-png.flaticon.com/512/609/609803.png",
  encoder: "https://cdn-icons-png.flaticon.com/512/338/338843.png",
  dcm: "https://cdn-icons-png.flaticon.com/512/1048/1048928.png",
  switch: "https://cdn-icons-png.flaticon.com/512/3703/3703626.png",
  default: "https://cdn-icons-png.flaticon.com/512/565/565547.png",
};

function ChannelEditor() {
  const [channels, setChannels] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [channelData, setChannelData] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [newEdgeLabel, setNewEdgeLabel] = useState("");
  const [selectedElements, setSelectedElements] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tipo de nodo personalizado
  const nodeTypes = { custom: CustomNode };

  const loadSignals = async () => {
    try {
      const res = await api.getSignal();
      const options = res.data.map((s) => ({
        value: s._id,
        label: s.nameChannel || "Sin nombre",
      }));
      setChannels(options);
    } catch (error) {
      console.error("No se pudo cargar las señales", error);
      Swal.fire("Error", "No se pudo cargar las señales", "error");
    }
  };

  const loadChannelBySignal = useCallback(async (signalId) => {
    if (!signalId) {
      setChannelData(null);
      setNodes([]);
      setEdges([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getChannelDiagramBySignal(signalId);
      const channelsFound = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      if (channelsFound.length > 0) {
        const ch = channelsFound[0];
        setChannelData(ch);
        setNodes(ch.nodes || []);
        setEdges(ch.edges || []);
      } else {
        setChannelData(null);
        setNodes([]);
        setEdges([]);
      }
    } catch (error) {
      console.error("Error al cargar el canal", error);
      Swal.fire("Error", "Error al cargar el canal", "error");
    } finally {
      setLoading(false);
    }
  }, [setChannelData, setEdges, setLoading, setNodes]);

  useEffect(() => {
    loadSignals();
  }, []);

  useEffect(() => {
    loadChannelBySignal(selectedSignal?.value);
  }, [loadChannelBySignal, selectedSignal]);

  const onConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      const id = `edge-${Date.now()}`;
      const newEdge = {
        id,
        source: connection.source,
        target: connection.target,
        type: "smoothstep",
        label: newEdgeLabel,
        animated: true,
        style: { stroke: "red" },
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setNewEdgeLabel("");
    },
    [newEdgeLabel, setEdges]
  );

  const addNode = (type = "default") => {
    const id = `node-${Date.now()}`;
    const newNode = {
      id,
      type: "custom",
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `${type.toUpperCase()} ${id}`,
        icon: iconsMap[type] || iconsMap.default,
        bgColor: "#f0f0f0",
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const deleteSelected = () => {
    if (!selectedElements || selectedElements.length === 0) {
      Swal.fire("Info", "Selecciona nodos o enlaces para eliminar", "info");
      return;
    }
    const selectedNodeIds = selectedElements
      .filter((el) => el.source === undefined)
      .map((node) => node.id);
    const selectedEdgeIds = selectedElements
      .filter((el) => el.source !== undefined)
      .map((edge) => edge.id);
    setNodes((nds) => nds.filter((node) => !selectedNodeIds.includes(node.id)));
    setEdges((eds) => eds.filter((edge) => !selectedEdgeIds.includes(edge.id)));
    setSelectedElements([]);
  };

  const saveChanges = async () => {
    if (!selectedSignal) {
      Swal.fire("Error", "Debes seleccionar una señal primero", "error");
      return;
    }
    if (nodes.length === 0) {
      Swal.fire("Error", "Debe haber al menos un nodo", "error");
      return;
    }
    const payload = {
      signal: selectedSignal.value,
      nodes,
      edges,
    };
    try {
      const response = channelData?._id
        ? await api.updateChannelDiagram(channelData._id, payload)
        : await api.createChannelDiagram(payload);
      Swal.fire("Éxito", "Cambios guardados correctamente", "success");
      setChannelData(response);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Error desconocido";
      Swal.fire("Error", "Error al guardar: " + message, "error");
    }
  };

  return (
    <div className="outlet-main">
      <h2>Editor de Channel</h2>

      <label style={{ fontWeight: "bold" }}>Selecciona una señal</label>
      <Select
        className="select-width"
        options={channels}
        value={selectedSignal}
        onChange={setSelectedSignal}
        placeholder="Selecciona una señal..."
        isClearable
      />

      {loading && <p>Cargando canal...</p>}

      {!loading && selectedSignal && (
        <>
          <div style={{ marginTop: 10 }}>
            <label style={{ fontWeight: "bold" }}>
              Etiqueta para nuevo enlace:
            </label>
            <input
              type="text"
              value={newEdgeLabel}
              onChange={(e) => setNewEdgeLabel(e.target.value)}
              placeholder="Etiqueta para enlace nuevo"
              style={{ width: "100%", padding: 8, fontSize: "1rem" }}
            />
          </div>

          <div
            style={{
              width: "80%",
              height: 600,
              marginTop: 10,
              border: "1px solid #ccc",
              borderRadius: 4,
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              connectionLineType="smoothstep"
              snapToGrid
              snapGrid={[15, 15]}
              onSelectionChange={(els) => setSelectedElements(els || [])}
              multiSelectionKeyCode={null}
              nodeTypes={nodeTypes}
            >
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", border: '1px solid red' }}>
            <button onClick={() => addNode("antena")} className="btn-green">
              + Antena
            </button>
            <button onClick={() => addNode("ird")} className="btn-green">
              + IRD
            </button>
            <button onClick={() => addNode("encoder")} className="btn-green">
              + Encoder
            </button>
            <button onClick={() => addNode("dcm")} className="btn-green">
              + DCM
            </button>
            <button onClick={() => addNode("switch")} className="btn-green">
              + Switch
            </button>

            <button onClick={deleteSelected} className="btn-red">
              🗑 Eliminar Seleccionados
            </button>

            <button
              onClick={saveChanges}
              className="btn-blue"
              style={{ marginLeft: "auto" }}
            >
              Guardar Cambios
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ChannelEditor;
