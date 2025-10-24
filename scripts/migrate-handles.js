#!/usr/bin/env node

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});
require("dotenv").config({
  path: path.resolve(__dirname, "../backend-tv.v2-main/.env"),
});

const Channel = require("../backend-tv.v2-main/src/models/channel.model");

const HANDLE_REGEX = /^(in|out)-(left|right|top|bottom)-([1-9][0-9]*)$/;
const DEFAULT_SOURCE = "out-right-1";
const DEFAULT_TARGET = "in-left-1";

const LEGACY_MAP = new Map(
  Object.entries({
    "out-right": "out-right-1",
    "in-left": "in-left-1",
    "source-right-1": "out-right-1",
    "target-left-1": "in-left-1",
    "right-out-1": "out-right-1",
    "left-in-1": "in-left-1",
  })
);

function normalizeHandle(handleId, fallback) {
  if (HANDLE_REGEX.test(handleId)) {
    return handleId;
  }
  const key = typeof handleId === "string" ? handleId.trim() : "";
  if (HANDLE_REGEX.test(key)) {
    return key;
  }
  const mapped = LEGACY_MAP.get(key);
  if (mapped && HANDLE_REGEX.test(mapped)) {
    return mapped;
  }
  return fallback;
}

function sanitizeEdge(edge) {
  const next = { ...edge };
  next.sourceHandle = normalizeHandle(edge?.sourceHandle, DEFAULT_SOURCE);
  next.targetHandle = normalizeHandle(edge?.targetHandle, DEFAULT_TARGET);
  next.type = "customDirectional";
  if (!next.data || typeof next.data !== "object") {
    next.data = {};
  }
  if (!next.data.direction || !["ida", "vuelta", "bi"].includes(next.data.direction)) {
    next.data.direction = "ida";
  }
  next.data.labelStart = next.data.labelStart || "";
  next.data.labelEnd = next.data.labelEnd || "";
  return next;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined");
    process.exit(1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  const cursor = Channel.find({}).cursor();
  const updatedIds = [];

  for await (const channel of cursor) {
    const diagram = channel.diagram || {};
    const rawEdges = Array.isArray(diagram.edges)
      ? diagram.edges
      : Array.isArray(channel.edges)
      ? channel.edges
      : [];

    let changed = false;
    const normalizedEdges = rawEdges.map((edge) => {
      const normalized = sanitizeEdge(edge);
      if (
        normalized.sourceHandle !== edge.sourceHandle ||
        normalized.targetHandle !== edge.targetHandle ||
        normalized.type !== edge.type
      ) {
        changed = true;
      }
      return normalized;
    });

    if (!changed) {
      continue;
    }

    channel.diagram = {
      ...(diagram || {}),
      nodes: Array.isArray(diagram.nodes) ? diagram.nodes : channel.nodes || [],
      edges: normalizedEdges,
      viewport:
        diagram && typeof diagram.viewport === "object"
          ? diagram.viewport
          : null,
    };
    channel.edges = normalizedEdges;
    channel.markModified("diagram.edges");

    await channel.save();
    updatedIds.push(channel._id.toString());
    console.log(`✔ Updated channel ${channel._id.toString()}`);
  }

  await mongoose.disconnect();

  if (!updatedIds.length) {
    console.log("No channels required updates.");
  } else {
    console.log(`Completed migration for ${updatedIds.length} channel(s).`);
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed", error);
    mongoose.disconnect().finally(() => {
      process.exit(1);
    });
  });
