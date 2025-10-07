const express = require("express");
const TipoEquipoController = require("../controllers/tipoEquipo.controller");

const router = express.Router();

router
  .route("/tipo-equipo")
  .get(TipoEquipoController.getTipoEquipo)
  .post(TipoEquipoController.createTipoEquipo);

module.exports = router;
