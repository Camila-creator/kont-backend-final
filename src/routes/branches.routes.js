// src/routes/branches.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/branches.controller");
const { verifyToken, checkModuleAccess } = require("../middlewares/auth.middleware");

router.get("/",      verifyToken, checkModuleAccess("users"), ctrl.getBranches);
router.post("/",     verifyToken, checkModuleAccess("users"), ctrl.createBranch);
router.put("/:id",   verifyToken, checkModuleAccess("users"), ctrl.updateBranch);
router.delete("/:id",verifyToken, checkModuleAccess("users"), ctrl.deleteBranch);

module.exports = router;
