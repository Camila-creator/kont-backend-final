// src/routes/reconciliation.routes.js
const router = require("express").Router();
const ctrl   = require("../controllers/reconciliation.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");
const auth = [verifyToken, checkModuleAccess("reconciliation")];

router.get("/",                             ...auth, ctrl.list);
router.get("/:id",                          ...auth, ctrl.getById);
router.post("/",                            ...auth, ctrl.create);
router.post("/:id/import",                  ...auth, ctrl.importLines);
router.post("/:id/auto-match",              ...auth, ctrl.autoMatch);
router.put("/:id/lines/:lineId/match",      ...auth, ctrl.matchManual);
router.put("/:id/lines/:lineId/ignore",     ...auth, ctrl.ignoreLine);
router.post("/:id/close",                   ...auth, ctrl.close);
router.get("/:id/available-payments",       ...auth, ctrl.getPayments);

module.exports = router;
