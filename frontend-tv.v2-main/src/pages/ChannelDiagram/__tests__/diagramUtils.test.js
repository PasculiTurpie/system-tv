import test from "node:test";
import assert from "node:assert/strict";

import {
  mapEdgeFromApi,
  clampPositionWithinBounds,
  createPatchScheduler,
  resolveLabelPosition,
  ensureRouterTemplateEdges,
  summarizeRouterEdges,
  getNodeHandleUsage,
  collectNodeMulticastConflicts,
} from "../diagramUtils.js";

test("mapEdgeFromApi normalizes missing fields", () => {
  const edge = {
    id: "edge-1",
    source: "NodeA",
    target: "NodeB",
    data: {},
    style: {},
  };

  const result = mapEdgeFromApi(edge);

  assert.equal(result.data.label, "edge-1");
  assert.equal(result.label, "edge-1");
  assert.deepEqual(result.data.endpointLabels, {});
  assert.deepEqual(result.data.endpointLabelPositions, {});
  assert.equal(result.data.direction, "ida");
});

test("clampPositionWithinBounds limits coordinates", () => {
  const position = { x: 120, y: -40 };
  const bounds = { minX: -50, maxX: 80, minY: 0, maxY: 60 };

  const result = clampPositionWithinBounds(position, bounds);

  assert.deepEqual(result, { x: 80, y: 0 });
});

test("resolveLabelPosition uses defaults and clamp", () => {
  const defaultPosition = { x: 10.6, y: 15.4 };
  const clamp = (pos) => ({ x: Math.round(pos.x), y: Math.round(pos.y) });

  const resolvedDefault = resolveLabelPosition(undefined, defaultPosition, clamp);
  assert.deepEqual(resolvedDefault, { x: 11, y: 15 });

  const explicit = resolveLabelPosition({ x: 5.9, y: 9.2 }, defaultPosition, clamp);
  assert.deepEqual(explicit, { x: 6, y: 9 });
});

test("createPatchScheduler merges nested payloads", async () => {
  const calls = [];
  const scheduler = createPatchScheduler(async (key, payload) => {
    calls.push({ key, payload });
  });

  scheduler.schedule("edge-1", { label: "Nuevo" });
  scheduler.schedule("edge-1", { endpointLabels: { source: "SRC" } });
  scheduler.schedule("edge-1", { endpointLabels: { target: "DST" } });
  scheduler.schedule("edge-1", { labelPosition: { x: 12, y: 34 } });

  await scheduler.flush("edge-1");

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    key: "edge-1",
    payload: {
      label: "Nuevo",
      endpointLabels: { source: "SRC", target: "DST" },
      labelPosition: { x: 12, y: 34 },
    },
  });
});

test("integration: scheduler payload survives reload", async () => {
  const storedEdge = {
    id: "edge-5",
    source: "A",
    target: "B",
    label: "Inicial",
    data: { label: "Inicial" },
    style: {},
  };

  const scheduler = createPatchScheduler(async (_key, payload) => {
    if (payload.label !== undefined) {
      const labelValue = payload.label;
      storedEdge.label = labelValue;
      storedEdge.data = { ...(storedEdge.data || {}), label: labelValue };
    }
    if (payload.labelPosition !== undefined) {
      if (payload.labelPosition === null) {
        delete storedEdge.labelPosition;
        if (storedEdge.data) delete storedEdge.data.labelPosition;
      } else {
        storedEdge.labelPosition = payload.labelPosition;
        storedEdge.data = {
          ...(storedEdge.data || {}),
          labelPosition: payload.labelPosition,
        };
      }
    }
    if (payload.endpointLabels) {
      storedEdge.data = {
        ...(storedEdge.data || {}),
        endpointLabels: {
          ...(storedEdge.data?.endpointLabels || {}),
          ...payload.endpointLabels,
        },
      };
    }
  });

  scheduler.schedule("edge-5", { label: "Actualizado" });
  scheduler.schedule("edge-5", { labelPosition: { x: 42, y: 84 } });
  scheduler.schedule("edge-5", { endpointLabels: { source: "Gig0/1" } });

  await scheduler.flush("edge-5");

  const mapped = mapEdgeFromApi(storedEdge);
  assert.equal(mapped.data.label, "Actualizado");
  assert.deepEqual(mapped.data.labelPosition, { x: 42, y: 84 });
  assert.equal(mapped.data.endpointLabels.source, "Gig0/1");
});

test("ensureRouterTemplateEdges generates default router edges", () => {
  const routerNode = { id: "Router1", type: "router", data: {} };
  const { toAdd, missingCombos } = ensureRouterTemplateEdges(routerNode, []);

  assert.equal(toAdd.length, 18);
  assert.equal(missingCombos.length, 18);
  assert.ok(toAdd.every((edge) => edge.data.routerTemplate === "Router1"));
});

test("summarizeRouterEdges detects missing combos", () => {
  const routerNode = { id: "Router1", type: "router", data: {} };
  const { toAdd } = ensureRouterTemplateEdges(routerNode, []);
  const partialEdges = toAdd.slice(0, 10);
  const summary = summarizeRouterEdges(routerNode, partialEdges);

  assert.equal(summary.expected, 18);
  assert.equal(summary.existing, 10);
  assert.equal(summary.missing, 8);
});

test("getNodeHandleUsage aggregates handles and metadata", () => {
  const node = { id: "Node1", type: "router", data: {} };
  const edges = [
    {
      id: "edge-out",
      source: "Node1",
      target: "Node2",
      sourceHandle: "out-left-1",
      data: { direction: "out", multicast: "239.0.0.1:5000" },
    },
    {
      id: "edge-in",
      source: "Node3",
      target: "Node1",
      targetHandle: "in-left-1",
      data: { direction: "in", pending: true },
    },
  ];

  const usage = getNodeHandleUsage(node, edges);
  const outHandle = usage.find((entry) => entry.id === "out-left-1");
  const inHandle = usage.find((entry) => entry.id === "in-left-1");

  assert.ok(outHandle);
  assert.equal(outHandle.connections.length, 1);
  assert.equal(outHandle.connections[0].multicast, "239.0.0.1:5000");

  assert.ok(inHandle);
  assert.equal(inHandle.connections.length, 1);
  assert.equal(inHandle.connections[0].pending, true);
});

test("collectNodeMulticastConflicts groups duplicates", () => {
  const edges = [
    { id: "e1", source: "A", target: "B", data: { multicast: "239.1.1.1:1000" } },
    { id: "e2", source: "A", target: "C", data: { multicast: "239.1.1.1:1000" } },
    { id: "e3", source: "A", target: "D", data: { multicast: "239.1.1.2:1000" } },
  ];

  const conflicts = collectNodeMulticastConflicts("A", edges);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, "239.1.1.1:1000");
  assert.equal(conflicts[0].edges.length, 2);
});
