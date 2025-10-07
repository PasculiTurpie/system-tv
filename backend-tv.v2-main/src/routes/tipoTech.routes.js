const express = require("express");
const TipoTechController = require("../controllers/tipoTech.controller");

const router = express.Router();

router
  .route("/tipo-tech")
  .get(TipoTechController.getTech)
  .post(TipoTechController.createTech);

module.exports = router;
