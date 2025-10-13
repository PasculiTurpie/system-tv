const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizeNodePayload,
  sanitizeEdgePayload,
  sanitizeDiagramPayload,
} = require("./diagramSanitizer");

describe("diagramSanitizer", () => {
  test("sanitizeNodePayload normalizes label and position", () => {
    const input = {
      id: " node-1 ",
      type: "custom",
      label: "  Label  ",
      position: { x: "10", y: "20" },
      data: { label: "  Label  ", labelPosition: { x: "5", y: null } },
    };

    const sanitized = sanitizeNodePayload(input);
    assert.equal(sanitized.id, "node-1");
    assert.equal(sanitized.data.label, "Label");
    assert.deepEqual(sanitized.position, { x: 10, y: 20 });
    assert.ok(!("labelPosition" in sanitized.data));
  });

  test("sanitizeEdgePayload keeps endpoint labels and positions", () => {
    const input = {
      id: " edge-1 ",
      source: " A ",
      target: " B ",
      label: "  Edge  ",
      data: {
        label: "  Edge  ",
        endpointLabels: { source: "  SRC  ", target: "   " },
        endpointLabelPositions: {
          source: { x: "12", y: "24" },
          target: { x: "", y: "9" },
        },
        multicast: "   ",
      },
    };

    const sanitized = sanitizeEdgePayload(input);
    assert.equal(sanitized.id, "edge-1");
    assert.equal(sanitized.label, "Edge");
    assert.deepEqual(sanitized.data.endpointLabels, { source: "SRC" });
    assert.deepEqual(sanitized.data.endpointLabelPositions, { source: { x: 12, y: 24 } });
    assert.ok(!("multicast" in sanitized.data));
  });

  test("sanitizeDiagramPayload filters invalid nodes and edges", () => {
    const result = sanitizeDiagramPayload({
      nodes: [{ id: "a" }, { id: "" }, null],
      edges: [
        { id: "edge-1", source: "a", target: "b" },
        { id: "", source: "a", target: "b" },
      ],
    });

    assert.equal(result.nodes.length, 1);
    assert.equal(result.nodes[0].id, "a");
    assert.equal(result.edges.length, 1);
    assert.equal(result.edges[0].id, "edge-1");
  });
});
