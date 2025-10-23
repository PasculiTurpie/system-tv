import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { HANDLE_IDS } from "../handleConstants.js";

const IrdNode = ({ data }) => {
  const targetHandle = HANDLE_IDS.IN_LEFT_PRIMARY; // canónico
  if (data) data.handleIds = [targetHandle];

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
