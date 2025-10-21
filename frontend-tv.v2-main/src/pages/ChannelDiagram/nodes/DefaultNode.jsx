import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { resolveHandleId } from "./handleUtils";

const DefaultNode = ({ data }) => {
  const targetHandle = resolveHandleId(data, "target", "top", "top-target");
  const sourceHandle = resolveHandleId(data, "source", "top", "top-source");

  return (
    <FlowNodeShell data={data}>
      <Handle type="target" id={targetHandle} position={Position.Top} style={{ left: "30%" }} />
      <Handle type="source" id={sourceHandle} position={Position.Top} style={{ left: "70%" }} />
    </FlowNodeShell>
  );
};

export default memo(DefaultNode);
