const router = require("express").Router();
const { pool } = require("../db");

router.get("/health", (req, res) => {
  res.json({ ok: true, message: "API alive 🫡" });
});

router.get("/db-test", async (req, res) => {
  const r = await pool.query("SELECT NOW() as now");
  res.json({ ok: true, time: r.rows[0].now });
});

module.exports = router;
