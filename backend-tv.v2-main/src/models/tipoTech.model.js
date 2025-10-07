const mongoose = require('mongoose')


const TipoTechSchema = new mongoose.Schema(
  {
    nombreTipo: {
      type: String,
      require: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const TipoTech = mongoose.model('TipoTech', TipoTechSchema);
module.exports = TipoTech;