# Auditoría de código (enero 2025)

## Resumen ejecutivo
- El backend cuenta con buenas protecciones de seguridad (CORS dinámico, sanitización de payloads, auditoría automática) y pruebas unitarias específicas para la normalización de diagramas.【F:backend-tv.v2-main/src/app.js†L1-L108】【F:backend-tv.v2-main/src/middleware/sanitizeRequest.js†L1-L47】【F:backend-tv.v2-main/src/middleware/autoAudit.js†L1-L160】【F:backend-tv.v2-main/src/services/channelNormalizer.test.js†L1-L81】
- El editor visual antiguo (`ChannelEditor`) presenta errores funcionales que impiden borrar y persistir nodos nuevos, lo que indica deuda técnica y riesgo en la experiencia de usuario.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L143-L171】【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L244-L256】【F:backend-tv.v2-main/src/models/channel.model.js†L9-L41】
- El nuevo visor de diagramas (`ChannelDiagram`) incorpora auto-guardado y normalización, pero arrastra logs de depuración, nombres de variables confusos y envía información redundante al backend.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelDiagram.jsx†L102-L236】

## Backend
### Lo que funciona bien
- `app.js` unifica protección de cabeceras, sanitización, autenticación opcional y auditoría; la configuración CORS admite listas blancas dinámicas y bloquea orígenes desconocidos por defecto.【F:backend-tv.v2-main/src/app.js†L1-L108】
- El controlador de canales normaliza y ordena los datos antes de responder; expone endpoints de parcheo fino para etiquetas y posiciones, lo que reduce conflictos de edición concurrente.【F:backend-tv.v2-main/src/controllers/channel.controller.js†L1-L240】
- Los modelos de Mongoose validan duplicados y consistencia referencial entre nodos y aristas, evitando topologías inválidas en almacenamiento.【F:backend-tv.v2-main/src/models/channel.model.js†L43-L78】

### Riesgos y oportunidades
- Los filtros de `getChannel` aplican `.populate({ path: "nodes" ... })` después de haber poblado `nodes.equipo`, lo cual ejecuta dos consultas redundantes; se puede consolidar en un solo `populate` jerárquico para reducir round-trips.【F:backend-tv.v2-main/src/controllers/channel.controller.js†L40-L66】
- En `patchLabelPositions` la detección de prefijo `data.` usa un operador ternario con el mismo resultado en ambas ramas; aunque inocuo, evidencia deuda de refactor que puede esconder otros errores de mapeo.【F:backend-tv.v2-main/src/controllers/channel.controller.js†L320-L372】
- `updateChannel` acepta `signal`, `nodes` y `edges` sin pasar por `sanitizeDiagramPayload`; conviene reutilizar la lógica de `updateChannelFlow` para evitar persistir posiciones o labels no normalizados.【F:backend-tv.v2-main/src/controllers/channel.controller.js†L71-L90】【F:backend-tv.v2-main/src/services/diagramSanitizer.js†L1-L157】

## Frontend
### Hallazgos críticos
- `ChannelEditor` almacena el resultado de `onSelectionChange` directamente; React Flow entrega un objeto `{ nodes, edges }`, por lo que `selectedElements.filter` lanza un `TypeError` y bloquea la eliminación masiva.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L158-L171】【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L244-L256】
- Los nodos creados desde `ChannelEditor` no incluyen `equipo` (obligatorio en el esquema). Al guardar, Mongoose rechaza la operación con un error de validación, impidiendo registrar nuevos nodos.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L143-L155】【F:backend-tv.v2-main/src/models/channel.model.js†L19-L34】

### Observaciones adicionales
- `ChannelDiagram` nombra `signalId` al parámetro de ruta que en realidad es el `_id` del canal; al serializar envía los campos `signal`, `signalId`, `channel` y `channelId` duplicados, lo que complica futuros refactors del backend.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelDiagram.jsx†L102-L236】
- Permanecen `console.log` de depuración tanto al leer el parámetro como al recibir la respuesta del API; deberían eliminarse o moverse a un logger controlado.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelDiagram.jsx†L102-L267】
- El contenedor de botones del editor mantiene un borde rojo hardcodeado, probablemente usado para depurar; conviene retirarlo o condicionarlo al modo desarrollador para evitar inconsistencias visuales.【F:frontend-tv.v2-main/src/pages/ChannelDiagram/ChannelEditor.jsx†L264-L292】

## Pruebas
- `npm test` en el backend ejecuta los suites de normalización de canales y diagramas, pasando 7 pruebas en ~240 ms.【6ce19a†L1-L21】
- No existen pruebas automatizadas para `ChannelEditor`; agregar casos e2e cubriría la edición de nodos, guardado y borrado.

## Recomendaciones para la próxima entrega
1. **Depurar o retirar `ChannelEditor`**: corregir la selección/eliminación, garantizar la asignación de `equipo` o reemplazarlo completamente por el flujo nuevo (`ChannelForm` + `ChannelDiagram`).
2. **Unificar contrato de datos**: renombrar `signalId` → `channelId` en el visor, enviar solo los identificadores necesarios y extender `patchLabelPositions` del frontend para soportar `endpointLabelPositions`, alineándolo con el backend.【F:frontend-tv.v2-main/src/services/channel.api.js†L1-L41】【F:backend-tv.v2-main/src/controllers/channel.controller.js†L256-L372】
3. **Higiene y observabilidad**: eliminar logs temporales, mover estilos de depuración a clases CSS y aprovechar el middleware de auditoría para registrar el origen de ediciones de diagramas con más contexto (p.ej. incluir diffs resumidos).
4. **Optimizar consultas**: refactorizar las poblaciones anidadas en `getChannel` para reducir la carga de base de datos y agregar índices compuestos en `nodes.id` / `edges.id` para acelerar las operaciones `patch` basadas en filtros.
5. **Automatizar pruebas de UI**: añadir pruebas de regresión (React Testing Library/Cypress) que cubran la creación de nodos, edición de labels y persistencia para detectar rupturas antes de desplegar.
