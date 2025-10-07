const mongoose = require("mongoose");

const SchemaTipoEquipos = new mongoose.Schema(
  {
    tipoNombre: {
      type: String,
      require: true,
      unique: true,
      trim:true
    },
  },
  { timestamps: true, versionKey: false }
);

const TipoEquipo = mongoose.model("TipoEquipo", SchemaTipoEquipos);
module.exports = TipoEquipo;