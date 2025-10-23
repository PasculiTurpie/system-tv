import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { resolveHandleId } from "./handleUtils";
import { HANDLE_IDS } from "../handleConstants.js";

const SateliteNode = ({ data }) => {
  const sourceHandle = resolveHandleId(
    data,
    "source",
    "right",
    HANDLE_IDS.OUT_RIGHT_PRIMARY
  );

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
