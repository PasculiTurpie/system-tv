const TipoTech = require('../models/tipoTech.model')


module.exports.createTech = async (req, res)=>{
    try {
        const tipoTech = new TipoTech(req.body)
        await tipoTech.save()
        res.status(200).json(tipoTech)
    } catch (error) {
        if (error.code === 11000) {
      const field = Object.values(error.keyValue).join(", ");
      return res.status(400).json({
        message: `Ya existe ua tecnología de ${field}`,
      });
    }
    console.error(error);
    res.status(501).json({ message: `Error al crear Canal`, error: error.message });
}
}

module.exports.getTech = async (req, res) => {
    try {
        const tipoTech = await TipoTech.find()
        res.status(200).json(tipoTech)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Error al obtener las tecnologías", error: error.message });
    }
}