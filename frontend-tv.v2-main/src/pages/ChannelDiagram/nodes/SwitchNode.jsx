import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { HANDLE_IDS } from "../handleConstants.js";

const handleStyleTop = { left: "50%" };
const handleStyleBottom = { left: "50%" };

const SwitchNode = ({ data }) => {
  const srcTop = HANDLE_IDS.OUT_TOP_PRIMARY;
  const srcBottom = HANDLE_IDS.OUT_BOTTOM_PRIMARY;
  const tgtTop = HANDLE_IDS.IN_TOP_PRIMARY;
  const tgtBottom = HANDLE_IDS.IN_BOTTOM_PRIMARY;

  if (data) data.handleIds = [srcTop, srcBottom, tgtTop, tgtBottom];

  return (
    <FlowNodeShell data={data}>
      <Handle type="source" id={srcTop} position={Position.Top} style={handleStyleTop} />
      <Handle type="source" id={srcBottom} position={Position.Bottom} style={handleStyleBottom} />
      <Handle type="target" id={tgtTop} position={Position.Top} style={{ left: "20%" }} />
      <Handle type="target" id={tgtBottom} position={Position.Bottom} style={{ left: "80%" }} />
    </FlowNodeShell>
  );
};

export default memo(SwitchNode);
