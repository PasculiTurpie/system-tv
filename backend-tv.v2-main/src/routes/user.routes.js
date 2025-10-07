const express = require("express");
const UserController = require("../controllers/user.controller");
const { authRequired } = require("../middleware/authRequired");

const router = express.Router();

router.get("/users", UserController.getAllUser);
router.get("/users/me", authRequired, UserController.getUserById);

router
  .route("/users/:id")
  .get(UserController.getUserId)
  .put(authRequired, UserController.updateUser)
  .delete(authRequired, UserController.deleteUser);

router.post("/users", authRequired, UserController.createUser);

module.exports = router;
