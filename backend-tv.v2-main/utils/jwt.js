// utils/jwt.js
const jwt = require("jsonwebtoken");
const isProd = process.env.NODE_ENV === "production";

function signAccessToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: expiresIn || process.env.JWT_ACCESS_EXPIRES || "10m",
  });
}

function signRefreshToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: expiresIn || process.env.JWT_REFRESH_EXPIRES || "7d",
  });
}

function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}
function verifyRefresh(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function setAuthCookies(res, { accessToken, refreshToken, accessExpEpoch }) {
  // Access (httpOnly)
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax", // en dev Lax suele ir bien con localhost
    path: "/", // disponible para toda la API
  });

  // REFRESH (httpOnly) — OJO con el path: DEBE matchear tu ruta real
  // Tu servidor monta rutas en "/api/v2", y el refresh está en "/api/v2/auth/refresh"
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/api/v2/auth/refresh", // 👈 CLAVE
  });

  // META de expiración (legible por el front, NO httpOnly)
  res.cookie("at_exp", String(accessExpEpoch), {
    httpOnly: false, // 👈 legible en el navegador
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/", // lo leemos desde el front en cualquier ruta
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/v2/auth/refresh" });
  res.clearCookie("at_exp", { path: "/" });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
  setAuthCookies,
  clearAuthCookies,
};
