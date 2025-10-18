import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Palette from '../../components/Palette.jsx';
import RightInspector from '../../components/RightInspector/RightInspector.jsx';
import { nodeTypes } from '../../components/NodeTypes/nodeTypes.js';
import { edgeTypes } from '../../components/EdgeTypes/edgeTypes.js';
import { useAutosave } from '../../hooks/useAutosave.js';
import { useDirtyBlocker } from '../../hooks/useDirtyBlocker.js';
import { useChannelsApi } from '../../services/channels.api.js';
import {
  useDiagramStore,
  useDiagramSelection,
  useHistoryState,
} from '../../store/useDiagramStore.js';
import { generateRouterEdges, isHandleAvailable } from '../../utils/edges.js';
import { validateConnection } from '../../utils/validation.js';

const defaultEdgeOptions = {
  type: 'signal',
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: true,
  style: { strokeWidth: 2, stroke: '#38bdf8' },
};

export default function DiagramEditor() {
  const { channelId } = useParams();
  const { getChannel, patchChannelNodes, patchChannelEdges } = useChannelsApi();
  const selection = useDiagramSelection();
  const { canUndo, canRedo } = useHistoryState();
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setInitialData,
    selectNode,
    selectEdge,
    clearSelection,
    updateNode,
    updateEdge,
    addEdges,
    flagNodeInitialized,
    markDirty,
    meta,
    undo,
    redo,
  } = useDiagramStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  useEffect(() => {
    let active = true;
    getChannel(channelId).then((channel) => {
      if (!active) return;
      setInitialData(channel.nodes, channel.edges, channel.meta ?? {});
      setNodes(channel.nodes);
      setEdges(channel.edges);
    });
    return () => {
      active = false;
    };
  }, [channelId, getChannel, setEdges, setInitialData, setNodes]);

  useEffect(() => {
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);

  useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  useEffect(() => {
    const newRouters = storeNodes.filter((node) => node.type === 'router' && !node.data?.initialized);
    if (!newRouters.length) return;
    newRouters.forEach((router) => {
      const routerEdges = generateRouterEdges(router.id).filter((edge) => isHandleAvailable(edge, storeEdges));
      addEdges(routerEdges);
      flagNodeInitialized(router.id);
      patchChannelEdges(channelId, routerEdges);
    });
  }, [storeNodes, storeEdges, addEdges, flagNodeInitialized, patchChannelEdges, channelId]);

  useAutosave(channelId);
  useDirtyBlocker(meta.status === 'dirty');

  const onConnect = useCallback(
    (connection) => {
      if (!validateConnection(connection, nodes, edges)) return;
      const connectionId = `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`;
      const nextEdges = addEdge(
        { ...connection, ...defaultEdgeOptions, id: connectionId },
        edges
      );
      setEdges(nextEdges);
      addEdges(nextEdges.filter((edge) => !edges.some((e) => e.id === edge.id)));
      markDirty();
    },
    [nodes, edges, setEdges, addEdges, markDirty]
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes?.[0]) {
        selectNode(selectedNodes[0]);
      } else if (selectedEdges?.[0]) {
        selectEdge(selectedEdges[0]);
      } else {
        clearSelection();
      }
    },
    [selectNode, selectEdge, clearSelection]
  );

  const onNodeDragStop = useCallback(() => {
    markDirty();
  }, [markDirty]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          patchChannelNodes(channelId, nodes);
          patchChannelEdges(channelId, edges);
          return;
        }
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
      }
      if (event.key.toLowerCase() === 'f') {
        document.querySelector('[data-fit-view]')?.click();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [channelId, nodes, edges, patchChannelNodes, patchChannelEdges, undo, redo]);

  const flowProps = useMemo(
    () => ({
      nodes,
      edges,
      nodeTypes,
      edgeTypes,
      defaultEdgeOptions,
      fitView: true,
      onNodesChange: (changes) => {
        onNodesChange(changes);
        markDirty();
      },
      onEdgesChange: (changes) => {
        onEdgesChange(changes);
        markDirty();
      },
      onConnect,
      onSelectionChange,
      onNodeDragStop,
      onNodesDelete: (deletedNodes) => {
        deletedNodes.forEach((node) => updateNode(node.id, { deleted: true }));
        markDirty();
      },
      onEdgesDelete: (deletedEdges) => {
        deletedEdges.forEach((edge) => updateEdge(edge.id, { deleted: true }));
        markDirty();
      },
    }),
    [nodes, edges, onNodesChange, onEdgesChange, onConnect, onSelectionChange, onNodeDragStop, updateNode, updateEdge, markDirty]
  );

  return (
    <div className="flex h-full">
      <Palette />
      <div className="flex-1">
        <ReactFlow {...flowProps}>
          <Background gap={16} />
          <MiniMap pannable zoomable />
          <Controls>
            <button type="button" onClick={undo} disabled={!canUndo} className="react-flow__controls-button">
              ↺
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className="react-flow__controls-button">
              ↻
            </button>
            <button type="button" data-fit-view className="react-flow__controls-button">
              Ajustar
            </button>
          </Controls>
        </ReactFlow>
      </div>
      <RightInspector selection={selection} />
    </div>
  );
}
