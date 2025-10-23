import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { resolveHandleId } from "./handleUtils";

const SateliteNode = ({ data }) => {
  const sourceHandle = resolveHandleId(data, "source", "right", "out-right-1");

  return (
    <FlowNodeShell data={data}>
      <Handle
        type="source"
        id={sourceHandle}
        position={Position.Right}
        style={{ top: "50%" }}
      />
    </FlowNodeShell>
  );
};

export default memo(SateliteNode);
