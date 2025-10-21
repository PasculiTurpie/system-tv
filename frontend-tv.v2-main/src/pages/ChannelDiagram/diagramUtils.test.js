import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  prepareDiagramState,
  mapNodeFromApi,
  mapEdgeFromApi,
  sortNodesById,
  sortEdgesById,
  createPatchScheduler,
  toApiNode,
} from "./diagramUtils.js";

describe("diagramUtils", () => {
  it("sortNodesById orders deterministically", () => {
    const nodes = [
      { id: "node-10", position: { x: 1, y: 1 }, data: {} },
      { id: "node-2", position: { x: 1, y: 1 }, data: {} },
      { id: "node-1", position: { x: 1, y: 1 }, data: {} },
    ];
    const sorted = sortNodesById(nodes);
    assert.deepStrictEqual(
      sorted.map((node) => node.id),
      ["node-1", "node-2", "node-10"]
    );
  });

  it("sortEdgesById orders deterministically", () => {
    const edges = [
      { id: "edge-3", source: "a", target: "b" },
      { id: "edge-1", source: "a", target: "b" },
    ];
    const sorted = sortEdgesById(edges);
    assert.deepStrictEqual(
      sorted.map((edge) => edge.id),
      ["edge-1", "edge-3"]
    );
  });

  it("prepareDiagramState filters invalid entries and keeps output stable", () => {
    const diagram = {
      _id: "channel-1",
      nodes: [
        { id: "b", position: { x: 200, y: 10 }, data: { label: "B" } },
        { id: "a", position: { x: 100, y: 5 }, data: { label: "A" } },
        { id: null },
      ],
      edges: [
        { id: "edge-2", source: "b", target: "a" },
        { id: "edge-1", source: "a", target: "b" },
        { id: "edge-x", source: "ghost", target: "a" },
      ],
    };

    const first = prepareDiagramState(diagram);
    const second = prepareDiagramState({ ...diagram });

    assert.deepStrictEqual(first, second);
    assert.deepStrictEqual(
      first.nodes.map((node) => node.id),
      ["a", "b"]
    );
    assert.deepStrictEqual(
      first.edges.map((edge) => edge.id),
      ["edge-1", "edge-2"]
    );
  });

  it("mapNodeFromApi and mapEdgeFromApi are idempotent", () => {
    const nodePayload = {
      id: "node-1",
      data: { label: " label ", labelPosition: { x: "10", y: "20" } },
      position: ["100", "50"],
    };
    const edgePayload = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      data: {
        label: " label ",
        endpointLabels: { source: " foo " },
      },
    };

    const nodeFirst = mapNodeFromApi(nodePayload);
    const nodeSecond = mapNodeFromApi(nodePayload);
    assert.deepStrictEqual(nodeFirst, nodeSecond);
    assert.equal(nodeFirst.data.label, "label");

    const edgeFirst = mapEdgeFromApi(edgePayload);
    const edgeSecond = mapEdgeFromApi(edgePayload);
    assert.deepStrictEqual(edgeFirst, edgeSecond);
    assert.equal(edgeFirst.data.endpointLabels.source, "foo");
  });

  it("toApiNode preserves equipo identifiers", () => {
    const baseNode = {
      id: "node-1",
      data: {
        label: "Nodo 1",
        equipoId: "equip-123",
      },
      position: { x: 10, y: 20 },
    };

    const result = toApiNode(baseNode);
    assert.equal(result.equipo, "equip-123");
    assert.equal(result.data.label, "Nodo 1");
    assert.equal(result.data.equipoId, "equip-123");

    const withObjectEquipo = {
      ...baseNode,
      data: { ...baseNode.data, equipo: { _id: "equip-999" } },
    };

    const resultFromObject = toApiNode(withObjectEquipo);
    assert.equal(resultFromObject.equipo, "equip-999");
    assert.equal(resultFromObject.data.equipoId, "equip-999");

    const withRootEquipo = {
      ...baseNode,
      data: { label: "Nodo 1", equipoId: "" },
      equipo: "equip-777",
    };

    const resultFromRoot = toApiNode(withRootEquipo);
    assert.equal(resultFromRoot.equipo, "equip-777");
    assert.equal(resultFromRoot.data.equipoId, "equip-777");
  });

  it("mapNodeFromApi normalizes equipo identifiers", () => {
    const nodePayload = {
      id: "node-7",
      equipo: "equip-321",
      data: {
        label: "Nodo 7",
        labelPosition: { x: 5, y: 6 },
        multicastPosition: { x: 7, y: 8 },
      },
      position: { x: 100, y: 200 },
    };

    const mapped = mapNodeFromApi(nodePayload);
    assert.equal(mapped.equipo, "equip-321");
    assert.equal(mapped.data.equipoId, "equip-321");
    assert.deepStrictEqual(mapped.data.labelPosition, { x: 5, y: 6 });
  });

  it("createPatchScheduler merges payloads and resolves success callbacks", async () => {
    const calls = [];
    const scheduler = createPatchScheduler(async (key, payload) => {
      calls.push({ key, payload });
    }, { delay: 10 });

    let successCount = 0;
    scheduler.schedule(
      "node-1",
      { position: { x: 1 } },
      {
        onSuccess: () => {
          successCount += 1;
        },
      }
    );
    scheduler.schedule("node-1", { position: { y: 2 } });

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(successCount, 1);
    assert.deepStrictEqual(calls, [
      { key: "node-1", payload: { position: { x: 1, y: 2 } } },
    ]);
  });

  it("createPatchScheduler invokes error callbacks when executor fails", async () => {
    const scheduler = createPatchScheduler(async () => {
      throw new Error("boom");
    }, { delay: 10 });

    let errorCount = 0;
    const originalError = console.error;
    console.error = () => {};
    try {
      scheduler.schedule(
        "node-1",
        { position: { x: 1 } },
        {
          onError: () => {
            errorCount += 1;
          },
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 30));
    } finally {
      console.error = originalError;
    }

    assert.equal(errorCount, 1);
  });
});
