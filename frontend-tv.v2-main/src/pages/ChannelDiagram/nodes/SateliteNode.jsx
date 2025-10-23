import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { HANDLE_IDS } from "../handleConstants.js";
import { ensureHandleId } from "../handleStandard.js";

const SateliteNode = ({ data }) => {
  const sourceHandle = ensureHandleId(HANDLE_IDS.OUT_RIGHT_PRIMARY); // canónico
  if (data) data.handleIds = [sourceHandle];

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
