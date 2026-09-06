const express = require("express");
const router = express.Router();

const controller = require("../controllers/suratKeluarController");
const { verifyToken } = require('../middleware/auth');
const upload = require("../middleware/upload");

router.get("/" , verifyToken, controller.getAll);

router.post(
  "/",
  verifyToken,
  upload.single("file"),
  controller.create
);

router.put("/:id", verifyToken, controller.update);
router.delete("/:id", verifyToken, controller.delete);

module.exports = router;