function ok(res, data, meta) {
  return res.json({ ok: true, data, meta });
}

function created(res, data) {
  return res.status(201).json({ ok: true, data });
}

module.exports = { ok, created };
