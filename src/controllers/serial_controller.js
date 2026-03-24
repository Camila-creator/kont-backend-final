const db = require("../db");

exports.getAssignableItems = async (req, res) => {
    // 🛡️ Normalización de datos del usuario
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const categoryId = Number(req.user.tenant_category_id || req.user.categoryId || req.user.tenantCategoryId);

    // ✅ Validación de categoría (1: Telefonía, 2: Tecnología)
    if (![1, 2].includes(categoryId)) {
        return res.status(403).json({ error: "Módulo exclusivo para telefonía y tecnología." });
    }

    if (!tenantId) {
        return res.status(403).json({ error: "ACCESO_DENEGADO_NO_TENANT" });
    }

    try {
        const qProducts = "SELECT id, name, 'PRODUCT' as type FROM products WHERE tenant_id = $1";
        const qSupplies = "SELECT id, name, 'SUPPLY' as type FROM supplies WHERE tenant_id = $1";

        // 🚀 IMPORTANTE: Se pasa tenantId como 3er parámetro para db.js (RLS)
        const [products, supplies] = await Promise.all([
            db.query(qProducts, [tenantId], tenantId),
            db.query(qSupplies, [tenantId], tenantId)
        ]);

        res.json({ data: [...products.rows, ...supplies.rows] });
    } catch (err) {
        console.error("Error en getAssignableItems:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.bulkRegister = async (req, res) => {
    const { item_id, item_type, serials } = req.body;
    const tenantId = req.user.tenant_id || req.user.tenantId;
    const categoryId = Number(req.user.tenant_category_id || req.user.categoryId || req.user.tenantCategoryId);

    if (![1, 2].includes(categoryId)) {
        return res.status(403).json({ error: "Operación no permitida para esta categoría." });
    }

    if (!serials || !Array.isArray(serials) || serials.length === 0) {
        return res.status(400).json({ error: "No se enviaron seriales para registrar." });
    }

    try {
        // Para transacciones BEGIN/COMMIT/ROLLBACK, db.js también necesita el tenantId
        await db.query('BEGIN', [], tenantId);

        for (let imei of serials) {
            await db.query(
                `INSERT INTO serial_numbers 
                (tenant_id, imei, product_id, supply_id, status) 
                VALUES ($1, $2, $3, $4, $5)`,
                [
                    tenantId, 
                    imei.toUpperCase().trim(), 
                    item_type === 'PRODUCT' ? item_id : null, 
                    item_type === 'SUPPLY' ? item_id : null, 
                    'DISPONIBLE'
                ],
                tenantId // 👈 3er parámetro
            );
        }

        const table = item_type === 'PRODUCT' ? 'products' : 'supplies';
        await db.query(
            `UPDATE ${table} SET stock = stock + $1 WHERE id = $2 AND tenant_id = $3`,
            [serials.length, item_id, tenantId],
            tenantId // 👈 3er parámetro
        );

        await db.query('COMMIT', [], tenantId);
        res.json({ message: `Ingreso exitoso: ${serials.length} unidades añadidas.` });
    } catch (err) {
        await db.query('ROLLBACK', [], tenantId);
        console.error("Error en bulkRegister:", err);
        res.status(500).json({ error: "Error al registrar seriales: " + err.message });
    }
};

exports.getAll = async (req, res) => {
    const tenantId = req.user.tenant_id || req.user.tenantId;
    
    if (!tenantId) {
        return res.status(403).json({ error: "ACCESO_DENEGADO_NO_TENANT" });
    }

    try {
        const q = `
            SELECT s.*, p.name as product_name, sup.name as supply_name 
            FROM serial_numbers s
            LEFT JOIN products p ON s.product_id = p.id
            LEFT JOIN supplies sup ON s.supply_id = sup.id
            WHERE s.tenant_id = $1 
            ORDER BY s.id DESC
        `;
        
        // 🚀 Pasamos tenantId como 3er parámetro para satisfacer la validación de db.js
        const result = await db.query(q, [tenantId], tenantId);
        
        res.json({ data: result.rows });
    } catch (err) {
        console.error("Error en getAll serials:", err);
        res.status(500).json({ error: err.message });
    }
};