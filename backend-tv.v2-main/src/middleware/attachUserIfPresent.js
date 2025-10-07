// src/middleware/attachUserIfPresent.js
const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  "";

function extractToken(req) {
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.cookies?.token) return req.cookies.token;

  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1];

  if (req.headers?.["x-access-token"]) return req.headers["x-access-token"];

  return null;
}

function attachUserIfPresent(req, _res, next) {
  if (!JWT_SECRET) {
    return next();
  }

  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      _id: decoded.id || decoded._id || decoded.userId || null,
      id: decoded.id || decoded._id || decoded.userId || null,
      email: decoded.email || decoded.userEmail || decoded.username || null,
      role: decoded.role || null,
    };

    return next();
  } catch (_error) {
    return next();
  }
}

module.exports = { attachUserIfPresent };
