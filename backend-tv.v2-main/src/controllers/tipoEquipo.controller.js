const TipoEquipo = require('../models/tipoEquipo')


module.exports.getTipoEquipo = async (req, res) => {
  try {
    const tipoEquipo = await TipoEquipo.find().sort({ tipoNombre: 1 });
    res.json(tipoEquipo);
  } catch (error) {
    console.error("Error al obtener tipos de equipo:", error);
    res.status(500).json({ message: "Error al obtener tipos" });
  }
}

module.exports.createTipoEquipo = async (req, res) => {
  try {
    const tipoEquipo = new TipoEquipo(req.body);
    await tipoEquipo.save();
    res.status(201).json(tipoEquipo);
  } catch (error) {
    if (error.code === 11000) {
      // Extrae el campo duplicado desde error.keyValue
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];

      return res.status(400).json({
        message: `Ya existe un tipo de equipo con el valor "${value}" en el campo "${field}".`,
      });
    }

    console.error("Error inesperado al crear tipo de equipo:", error);
    res.status(500).json({ message: `Error al crear tipo de equipo.` });
  }
};