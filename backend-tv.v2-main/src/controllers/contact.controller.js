const Contact = require("../models/contact.model");

module.exports.createContact = async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();
    res.status(200).json(contact);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.values(error.keyValue).join(", ");
      
      return res.status(400).json({
        message: `Ya existe ${field}`,
      });
    }
    console.error(error);
    res.status(500).json({
      message: `Contacto creado`,
    });
  }
};

module.exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.find();
    res.json(contact);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error al obtener contacto` });
  }
};

module.exports.getIdContact = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findById(id);
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener contacto" });
  }
};
module.exports.updateContact = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar contacto" });
  }
};

module.exports.deleteContact = async (req, res) => {
  try {
    const id = req.params.id;
    const contact = await Contact.findByIdAndDelete(id);
    if (!contact)
      return res.status(404).json({ message: `Contacto no encontrado` });
    res.json({ message: "Contacto eliminado de la base de datos" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar contacto" });
  }
};
