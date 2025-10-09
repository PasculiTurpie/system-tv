import test from "node:test";
import assert from "node:assert/strict";

import {
  mapEdgeFromApi,
  clampPositionWithinBounds,
  createPatchScheduler,
  resolveLabelPosition,
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
