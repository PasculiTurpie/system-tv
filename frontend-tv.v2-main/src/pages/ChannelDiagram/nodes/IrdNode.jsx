import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { resolveHandleId } from "./handleUtils";

const IrdNode = ({ data }) => {
  const targetHandle = resolveHandleId(data, "target", "left", "in-left-1");

  return (
    <FlowNodeShell data={data}>
      <Handle
        type="target"
        id={targetHandle}
        position={Position.Left}
        style={{ top: "50%" }}
      />
    </FlowNodeShell>
  );
};

export default memo(IrdNode);
