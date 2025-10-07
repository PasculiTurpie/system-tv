const Signal = require("../models/signal.model");

module.exports.createSignal = async (req, res) => {
  try {
    const signal = new Signal(req.body);
    await signal.save();
    res.status(200).json(signal);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: `Error al crear la señal`,
    });
  }
};

/* module.exports.getSignal = async (req, res) => {
  try {
    const signals = await Signal.find().populate("contact");
    res.status(200).json(signals);
  } catch (error) {
    console.error("Error al obtener señales:", error);
    res.status(500).json({ message: "Error al obtener señales" });
  }
}; */

module.exports.getSignal = async (req, res) => {
  try {
    const signals = await Signal.find().sort({ numberChannelSur: 1 }).populate("contact"); // 1 = ascendente
    res.status(200).json(signals);
  } catch (error) {
     console.error("Error al obtener señales:", error);
    res.status(500).json({ message: "Error al obtener señales" });
  }
};


module.exports.getIdSignal = async (req, res) => {
  try {
    const signal = await Signal.findById(req.params.id).populate("contact");
    res.status(200).json(signal);
  } catch (error) {
    console.error("Error al obtener señales:", error);
    res.status(500).json({ message: `Error al obtener señal` });
  }
};

module.exports.updateSignal = async (req, res) => {
  try {
    const { id } = req.params;
    const { contact, ...otherFields } = req.body;

    const signal = await Signal.findById(id);
    if (!signal)
      return res.status(404).json({ message: "No se encontró la señal" });

    // Preparar el objeto de actualización
    const updateData = { ...otherFields };

    // Si viene 'contact' válido, verificar y agregarlo
    if (contact && Array.isArray(contact) && contact.length > 0) {
      const alreadyAssigned = signal.contact.some((c) =>
        contact.includes(c.toString())
      );
      if (alreadyAssigned) {
        return res
          .status(409)
          .json({ message: "Contacto ya asignado previamente" });
      }

      updateData.$addToSet = { contact: { $each: contact } };
    }

    // Actualizar la señal
    const updatedSignal = await Signal.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      message: "Señal actualizada correctamente",
      data: updatedSignal,
    });
  } catch (error) {
    console.error("Error al actualizar señal:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};




module.exports.deleteSignal = async (req, res) => {
  try {
    const { id } = req.params;
    const signalTv = await Signal.findByIdAndDelete(id);
    if (!signalTv) {
      return res.status(404).json({ message: "Elemento no encontrado" });
    }
    res.status(200).json({ message: "Elemento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar elemento:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};


module.exports.searchSignals = async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) return res.status(400).json({ message: "Parámetro 'keyword' requerido" });

  try {
    const isNumber = !isNaN(keyword);
    const regex = new RegExp(keyword, "i");

    // Si es número, comparamos con el valor exacto también
    const query = isNumber
      ? {
          $or: [
            { nameChannel: regex },
            { numberChannelSur: keyword }, // número exacto
            { numberChannelCn: keyword },
          ],
        }
      : {
          $or: [
            { nameChannel: regex },
            { numberChannelSur: regex },
            { numberChannelCn: regex },
          ],
        };

    const results = await Signal.find(query).populate("contact");

    res.json(results);
  } catch (error) {
    console.error("Error en búsqueda:", error);
    res.status(500).json({ message: "Error al buscar señales" });
  }
};

