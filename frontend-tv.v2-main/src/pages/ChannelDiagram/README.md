# Channel Diagram Editing

## Inline editing
- Double-click any node label or edge label while authenticated to enter inline edit mode.
- Press `Enter` or move focus away to save the value. Press `Esc` to cancel and revert.

## Dragging labels
- When authenticated, drag central edge labels or endpoint labels to reposition them. The cursor changes to indicate dragging mode.
- Label positions are clamped to the visible diagram bounds and persisted automatically.

## Endpoint labels
- Source and target endpoints can display auxiliary labels. Double-click the placeholder near a handle to add text, or leave it blank to remove the label.

## Persistence
- Changes are optimistically applied and persisted with a ~320 ms debounce via the `/channels/:id/node/:nodeId` and `/channels/:id/edge/:edgeId` patch endpoints.
- Diagram-wide structural updates (dragging nodes, rewiring edges) continue to use the flow update endpoint with the same debounce.

## View controls
- The canvas fits to the current channel automatically on load and when switching channels (`fitView` with `padding = 0.2`).
- Use the on-screen zoom controls or the `+` / `-` keys to zoom.

## Router node handles
- Router nodes expose left, right, and bottom handles (`in-left-*`, `out-right-*`, `in-bottom-*`, `out-bottom-*`) to support directional edges and existing waypoint wiring.
