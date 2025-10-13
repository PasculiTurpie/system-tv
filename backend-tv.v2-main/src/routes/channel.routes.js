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
router.patch("/channels/:id/node/:nodeId", ChannelController.patchNode);
router.patch("/channels/:id/edge/:edgeId", ChannelController.patchEdge);
router.patch(
  "/channels/:id/label-positions",
  ChannelController.patchLabelPositions
);

module.exports = router;
