import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPersistLabelPositions } from "../persistLabelPositions.js";

const createRef = () => ({ current: new Map() });

describe("createPersistLabelPositions", () => {
  let patchCalls;
  let patchImpl;

  beforeEach(() => {
    patchCalls = [];
    patchImpl = async () => ({
      ok: true,
      updated: { nodes: 1, edges: 1 },
      summaryDiff: {},
    });
  });

  it("sanitizes payload and updates confirmed stores", async () => {
    const nodeRef = createRef();
    const edgeRef = createRef();
    const persist = createPersistLabelPositions({
      getChannelId: () => "channel-1",
      getIsAuth: () => true,
      requestSave: () => {},
      confirmedNodeLabelPositionsRef: nodeRef,
      confirmedEdgePositionsRef: edgeRef,
      patchLabelPositionsFn: async (...args) => {
        patchCalls.push(args);
        return patchImpl(...args);
      },
    });

    const result = await persist({
      nodes: {
        A: { labelPosition: { x: 10, y: 20 } },
      },
      edges: {
        E1: { labelPosition: { x: 30, y: 40 } },
      },
      endpointLabelPositions: {
        E1: { source: { x: 50, y: 60 }, target: null },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(patchCalls.length, 1);
    const [channelId, payload] = patchCalls[0];
    assert.equal(channelId, "channel-1");
    assert.deepEqual(payload, {
      labelPositions: {
        nodes: { A: { labelPosition: { x: 10, y: 20 } } },
        edges: { E1: { labelPosition: { x: 30, y: 40 } } },
      },
      endpointLabelPositions: { E1: { source: { x: 50, y: 60 }, target: null } },
    });

    assert.deepEqual(nodeRef.current.get("A"), {
      labelPosition: { x: 10, y: 20 },
      multicastPosition: null,
    });
    assert.deepEqual(edgeRef.current.get("E1"), {
      labelPosition: { x: 30, y: 40 },
      endpointLabelPositions: { source: { x: 50, y: 60 } },
      multicastPosition: null,
    });
  });

  it("returns early when there is nothing to persist", async () => {
    const persist = createPersistLabelPositions({
      getChannelId: () => "channel-1",
      getIsAuth: () => true,
      requestSave: () => {},
      confirmedNodeLabelPositionsRef: createRef(),
      confirmedEdgePositionsRef: createRef(),
      patchLabelPositionsFn: async (...args) => {
        patchCalls.push(args);
        return patchImpl(...args);
      },
    });

    const result = await persist({ nodes: {}, edges: {} });
    assert.deepEqual(result, { ok: false, updated: { nodes: 0, edges: 0 } });
    assert.equal(patchCalls.length, 0);
  });
});
