// controllers/equipo.controller.js
const mongoose = require("mongoose");
const Equipo = require("../models/equipo.model");
const TipoEquipo = require("../models/tipoEquipo"); // <-- asegúrate de la ruta correcta

// Nota: tu Schema de TipoEquipo usa "require: true" (typo). Debe ser "required: true".
// models/TipoEquipo.js => tipoNombre: { type: String, required: true, unique: true, trim: true }

module.exports.createEquipo = async (req, res) => {
  try {
    const p = req.body;

    // 1) Resolver tipoNombre -> ObjectId de TipoEquipo
    //    Acepta:
    //    - ObjectId (string válido)  ej: "66d...f91"
    //    - Nombre (string)           ej: "ird"
    //    - Si no viene, usa "ird" por defecto
    let tipoNombreId;
    const rawTipo = (p.tipoNombre || "ird").toString().trim();

    if (mongoose.Types.ObjectId.isValid(rawTipo)) {
      // ya viene como ObjectId
      tipoNombreId = rawTipo;
    } else {
      // viene como nombre: buscar o crear
      let tipo = await TipoEquipo.findOne({ tipoNombre: rawTipo });
      if (!tipo) {
        tipo = await TipoEquipo.create({ tipoNombre: rawTipo });
      }
      tipoNombreId = tipo._id;
    }

    // 2) Mapeo flexible de campos (acepta variantes desde el frontend)
    const doc = {
      nombre: p.nombre ?? p.nombreEquipo,
      marca: p.marca ?? p.marcaEquipo,
      modelo: p.modelo ?? p.modelEquipo,
      ip_gestion: p.ip_gestion ?? p.ipAdminEquipo ?? null,
      tipoNombre: tipoNombreId,
      irdRef: p.irdRef || undefined,
      satelliteRef: p.satelliteRef || undefined, // <<--- AÑADIR ESTO
    };

    // 3) Validación mínima (según tu Schema: nombre, marca, modelo, tipoNombre)
    const faltantes = [];
    if (!doc.nombre) faltantes.push("nombre");
    if (!doc.marca) faltantes.push("marca");
    if (!doc.modelo) faltantes.push("modelo");
    if (!doc.tipoNombre) faltantes.push("tipoNombre");

    if (faltantes.length) {
      return res.status(400).json({
        message: "Campos requeridos faltantes",
        missing: faltantes,
      });
    }

    // 4) Crear equipo
    const equipo = new Equipo(doc);
    await equipo.save();

    // 201 Created para recursos nuevos
    return res.status(201).json(equipo);
  } catch (error) {
    // Duplicidad (unique en nombre / ip_gestion)
    if (error?.code === 11000) {
      const campoEnConflicto = Object.keys(error.keyValue)[0];
      const valorEnConflicto = error.keyValue[campoEnConflicto];
      const mensaje = `Ya existe un equipo con ${campoEnConflicto}: '${valorEnConflicto}'.`;
      return res.status(409).json({ message: mensaje, detail: error.keyValue });
    }

    console.error("Error al crear equipo:", error);
    return res
      .status(500)
      .json({ message: "Error al crear equipo", detail: error?.message });
  }
};

module.exports.getEquipo = async (req, res) => {
  try {
    const equipos = await Equipo.find()
      .populate("tipoNombre")
      .populate("irdRef")
      .populate({
        path: "satelliteRef",
        populate: [{ path: "satelliteType", select: "typePolarization" }],
      })
      .lean();
    res.json(equipos);
  } catch (error) {
    console.error("getEquipos error:", error);
    res.status(500).json({ message: "Error al obtener equipos" });
  }
};

module.exports.getIdEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const equipo = await Equipo.findById(id)
      .populate("tipoNombre")
      .populate("irdRef")
      .populate({
        path: "satelliteRef",
        populate: [{ path: "satelliteType", select: "typePolarization" }],
      })
      .lean();

    if (!equipo) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }
    res.json(equipo);
  } catch (error) {
    console.error("getIdEquipo error:", error);
    res.status(500).json({ message: "Error al obtener equipo" });
  }
};



module.exports.updateEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...req.body };

    if (patch.tipoNombre) {
      patch.tipoNombre = await resolveTipoEquipoId(patch.tipoNombre);
    }
    if (patch.irdRef !== undefined) {
      patch.irdRef = await resolveIrdRef(patch.irdRef);
    }
    // si te pasan un id de satélite, lo dejas tal cual (ObjectId string)
    // o resuelves al ObjectId según tu helper si lo necesitas.

    if (patch.nombre) patch.nombre = String(patch.nombre).trim();
    if (patch.marca) patch.marca = String(patch.marca).trim();
    if (patch.modelo) patch.modelo = String(patch.modelo).trim();
    if (patch.ip_gestion) patch.ip_gestion = String(patch.ip_gestion).trim();

    const updated = await Equipo.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })
      .populate("tipoNombre")
      .populate("irdRef")
      .populate({
        path: "satelliteRef",
        populate: [{ path: "satelliteType", select: "typePolarization" }],
      })
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }

    res.json(updated);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error?.code === 11000) {
      const campo = Object.keys(error.keyValue)[0];
      const valor = error.keyValue[campo];
      return res
        .status(409)
        .json({ message: `Ya existe un equipo con ${campo}: '${valor}'.` });
    }
    console.error("updateEquipo error:", error);
    res.status(500).json({ message: "Error al actualizar equipo" });
  }
};

module.exports.deleteEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Equipo.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("deleteEquipo error:", error);
    res.status(500).json({ message: "Error al eliminar equipo" });
  }
};
