import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { HANDLE_IDS } from "../handleConstants.js";
import { ensureHandleId } from "../handleStandard.js";

const handleStyleTop = { left: "50%" };
const handleStyleBottom = { left: "50%" };

const SwitchNode = ({ data }) => {
  const srcTop = ensureHandleId(HANDLE_IDS.OUT_TOP_PRIMARY);
  const srcBottom = ensureHandleId(HANDLE_IDS.OUT_BOTTOM_PRIMARY);
  const tgtTop = ensureHandleId(HANDLE_IDS.IN_TOP_PRIMARY);
  const tgtBottom = ensureHandleId(HANDLE_IDS.IN_BOTTOM_PRIMARY);

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
