# Channel Diagram Editing

## Inline editing
- Double-click any node label or edge label while authenticated to enter inline edit mode.
- Press `Enter` or move focus away to save the value. Press `Esc` to cancel and revert.

## Node backgrounds
- Nodes accept a `data.backgroundImage` URL (falling back to `data.icon` when present) which renders as a blended background under the existing content so labels stay legible.

## Dragging labels
- When authenticated, drag the floating node captions, node multicast badges, and central edge labels to reposition them. The cursor changes to indicate dragging mode.
- Label positions are clamped to the visible diagram bounds and persisted automatically. Multicast badges reuse the same flow coordinates, so they stay attached to the diagram regardless of zoom.

## Endpoint labels
- Source and target endpoints can display auxiliary labels. Double-click the placeholder near a handle to add text, or leave it blank to remove the label.

## Persistence
- Floating label movements are persisted through `PATCH /channels/:id/label-positions`, which only touches the requested label coordinates. The UI updates optimistically and reverts if the request fails.
- Text changes and other per-entity updates still use the `/channels/:id/node/:nodeId` and `/channels/:id/edge/:edgeId` patch endpoints with the existing debounce logic.
- Diagram-wide structural updates (dragging nodes, rewiring edges) continue to use the flow update endpoint with the same debounce.

## View controls
- The canvas fits to the current channel automatically on load and when switching channels (`fitView` with `padding = 0.2`).
- Use the on-screen zoom controls or the `+` / `-` keys to zoom.

## Router node handles
- Router nodes expose left, right, and bottom handles (`in-left-*`, `out-right-*`, `in-bottom-*`, `out-bottom-*`) to support directional edges and existing waypoint wiring.

## Implementation notes
- Label positions are stored in React Flow coordinates (`project(clientPoint)`) via the shared `useDraggableLabel` hook. This keeps persisted values independent from the current zoom level or scroll offset.
- Each drag updates local React state through `DiagramContext` callbacks; on pointer release the overlay calls the `/channels/:id/label-positions` endpoint via `persistLabelPositions` to store only the modified coordinates in MongoDB.
- To add new draggable overlays, compose a component around `useDraggableLabel`, update the relevant context handler to write into state, and extend the payload sent to `persistLabelPositions` with the new fields.
