const router = require("express").Router();
const controller = require("../controllers/catalog.controller");
router.get("/", controller.list);
router.get("/:productId", controller.detail);
module.exports = router;
