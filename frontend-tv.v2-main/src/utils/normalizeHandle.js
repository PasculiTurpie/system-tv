// Mapea "in-left" -> "in-left-1", "out-right" -> "out-right-1", etc.
// Si ya viene con índice (-1, -2, …), lo deja igual.
const normalizeHandle = (handle) => {
  if (handle === undefined || handle === null) return undefined;

  const value = String(handle).trim();
  if (!value) return undefined;

  const lower = value.toLowerCase();
  const rxIndexed = /^(in|out)-(top|bottom|left|right)-\d+$/;
  const rxSideOnly = /^(in|out)-(top|bottom|left|right)$/;

  if (rxIndexed.test(lower)) return lower;
  if (rxSideOnly.test(lower)) return `${lower}-1`; // usa la 1ª posición por defecto

  // Mantiene el identificador original para manejadores personalizados.
  return value;
};

export default normalizeHandle;
