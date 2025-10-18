import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const MAX_HISTORY = 50;

const cloneState = (value) => JSON.parse(JSON.stringify(value));

const initialState = {
  nodes: [],
  edges: [],
  selection: { type: null, item: null },
  meta: {
    status: 'saved',
    lastSavedAt: null,
  },
  history: [],
  future: [],
};

export const useDiagramStore = create(
  devtools((set, get) => ({
    ...initialState,
    setInitialData: (nodes, edges, meta = {}) => {
      set({
        nodes,
        edges,
        meta: { status: 'saved', lastSavedAt: new Date(), ...meta },
        history: [],
        future: [],
      });
    },
    addNode: (node) => {
      set((state) => ({
        nodes: [...state.nodes, node],
        history: pushHistory(state),
        future: [],
        meta: { ...state.meta, status: 'dirty' },
      }));
    },
    addEdges: (edges) => {
      if (!edges?.length) return;
      set((state) => ({
        edges: mergeEdges(state.edges, edges),
        history: pushHistory(state),
        future: [],
        meta: { ...state.meta, status: 'dirty' },
      }));
    },
    updateNode: (id, patch) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, ...patch, data: { ...node.data, ...patch.data } } : node
        ),
        meta: { ...state.meta, status: 'dirty' },
      }));
    },
    flagNodeInitialized: (id) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, initialized: true } } : node
        ),
      }));
    },
    updateEdge: (id, patch) => {
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === id ? { ...edge, ...patch, data: { ...edge.data, ...patch.data } } : edge
        ),
        meta: { ...state.meta, status: 'dirty' },
      }));
    },
    selectNode: (node) => set({ selection: { type: 'node', item: node } }),
    selectEdge: (edge) => set({ selection: { type: 'edge', item: edge } }),
    selectAnnotation: (annotation) => set({ selection: { type: 'annotation', item: annotation } }),
    clearSelection: () => set({ selection: { type: null, item: null } }),
    autoOpenInspector: () => {},
    markDirty: () => set((state) => ({ meta: { ...state.meta, status: 'dirty' } })),
    markSaving: () => set((state) => ({ meta: { ...state.meta, status: 'saving' } })),
    markSaved: () => set((state) => ({ meta: { status: 'saved', lastSavedAt: new Date() } })),
    undo: () => {
      const { history, nodes, edges, future } = get();
      if (!history.length) return;
      const last = history[history.length - 1];
      set({
        nodes: cloneState(last.nodes),
        edges: cloneState(last.edges),
        history: history.slice(0, -1),
        future: [{ nodes: cloneState(nodes), edges: cloneState(edges) }, ...future].slice(0, MAX_HISTORY),
      });
    },
    redo: () => {
      const { future, history, nodes, edges } = get();
      if (!future.length) return;
      const next = future[0];
      set({
        nodes: cloneState(next.nodes),
        edges: cloneState(next.edges),
        history: [...history, { nodes: cloneState(nodes), edges: cloneState(edges) }].slice(-MAX_HISTORY),
        future: future.slice(1),
      });
    },
  }))
);

function pushHistory(state) {
  const snapshot = { nodes: cloneState(state.nodes), edges: cloneState(state.edges) };
  return [...state.history, snapshot].slice(-MAX_HISTORY);
}

function mergeEdges(existing, next) {
  const map = new Map(existing.map((edge) => [edge.id, edge]));
  next.forEach((edge) => {
    map.set(edge.id, edge);
  });
  return Array.from(map.values());
}

export const useDiagramMeta = () =>
  useDiagramStore((state) => ({ status: state.meta.status, lastSavedAt: state.meta.lastSavedAt }));

export const useDiagramSelection = () =>
  useDiagramStore((state) => state.selection);

export const useHistoryState = () =>
  useDiagramStore((state) => ({ canUndo: state.history.length > 0, canRedo: state.future.length > 0 }));
