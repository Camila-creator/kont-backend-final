// src/routes/credit_notes.routes.js
const router = require("express").Router();
const ctrl   = require("../controllers/credit_notes.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");
const auth = [verifyToken, checkModuleAccess("credit_notes")];

router.get("/",         ...auth, ctrl.list);
router.get("/:id",      ...auth, ctrl.getById);
router.post("/",        ...auth, ctrl.create);
router.post("/:id/cancel", ...auth, ctrl.cancel);

module.exports = router;
