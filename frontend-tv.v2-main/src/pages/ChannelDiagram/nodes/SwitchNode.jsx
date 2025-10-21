import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import FlowNodeShell from "./FlowNodeShell";
import { resolveHandleId } from "./handleUtils";

const handleStyleTop = { left: "50%" };
const handleStyleBottom = { left: "50%" };

const SwitchNode = ({ data }) => {
  const srcTop = resolveHandleId(data, "source", "top", "src-top");
  const srcBottom = resolveHandleId(data, "source", "bottom", "src-bottom");
  const tgtTop = resolveHandleId(data, "target", "top", "tgt-top");
  const tgtBottom = resolveHandleId(data, "target", "bottom", "tgt-bottom");

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
