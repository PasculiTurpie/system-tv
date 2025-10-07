// Mapea "in-left" -> "in-left-1", "out-right" -> "out-right-1", etc.
// Si ya viene con índice (-1, -2, …), lo deja igual.
const normalizeHandle = (h) => {
  if (!h) return undefined;
  const rxIndexed = /^(in|out)-(top|bottom|left|right)-\d+$/;
  const rxSideOnly = /^(in|out)-(top|bottom|left|right)$/;

  if (rxIndexed.test(h)) return h;
  if (rxSideOnly.test(h)) return `${h}-1`; // usa la 1ª posición por defecto

  // si viene algo inesperado, mejor no forzar
  return undefined;
};

export default normalizeHandle;
