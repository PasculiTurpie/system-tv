const express = require("express");
const { login, refresh, logout, profile } = require("../controllers/auth.controller.js");
const { authRequired } = require("../middleware/authRequired.js");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authRequired,profile);
router.post("/logout", logout);

module.exports = router;
