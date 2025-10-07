const express = require("express");
const ChannelController = require("../controllers/channel.controller");

const router = express.Router();

router
  .route("/channels")
  .post(ChannelController.createChannel)
  .get(ChannelController.getChannel);

router
  .route("/channels/:id")
  .get(ChannelController.getChannelId)
  .put(ChannelController.updateChannel)
  .delete(ChannelController.deleteChannel);

router.put("/channels/:id/flow", ChannelController.updateChannelFlow);

module.exports = router;
