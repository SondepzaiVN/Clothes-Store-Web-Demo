const router = require("express").Router();
const controller = require("../controllers/search.controller");

router.get("/health", controller.health);
router.post("/semantic", controller.semantic);

module.exports = router;
