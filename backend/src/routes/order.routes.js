const router = require("express").Router();
const controller = require("../controllers/order.controller");
router.post("/", controller.create);
router.post("/:orderId/cancel", controller.cancel);
router.patch("/:orderId/status", controller.updateStatus);
router.post("/:orderId/complete", controller.complete);
router.get("/:orderId", controller.detail);
module.exports = router;
