const db = require("../db");
const audit = require("../controllers/audit.controller");

async function createInvoiceFromOrder(orderId, tenantId, user) {
    // 1. Obtener datos completos del pedido (Usando tu función del model de pedidos)
    const order = await require("./orders.model").getOrderFullById(orderId, tenantId);
    if (!order) throw new Error("Pedido no encontrado");

    // Buscamos los datos actuales de la empresa (Tenant) para el Snapshot
    const tenantRes = await db.query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    const tenantData = tenantRes.rows[0];

    // 2. Cálculos de montos
    const subtotal_items = order.items.reduce((sum, item) => sum + Number(item.total), 0);
    const discount = Number(order.discount_amount || 0);
    const total_final = subtotal_items - discount;
    
    // Generamos número de factura único
    const invNumber = `FAC-${Date.now().toString().slice(-6)}`;

    // 3. Insertar Cabecera de Factura
    const invQ = `
        INSERT INTO invoices 
        (tenant_id, order_id, customer_id, invoice_number, 
         subtotal, discount_amount, tax_amount, total, 
         customer_name_snapshot, 
         tenant_name_snapshot, tenant_rif_snapshot, tenant_address_snapshot, tenant_phone_snapshot)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;
    
    const invR = await db.query(invQ, [
        tenantId, 
        orderId, 
        order.customer_id, 
        invNumber, 
        subtotal_items, 
        discount, 
        0, // Sin IVA según tu lógica
        total_final,
        order.customer_name,
        tenantData.name, 
        tenantData.rif, 
        tenantData.address, 
        tenantData.phone
    ]);
    
    const invoice = invR.rows[0];

    // 4. Insertar Ítems capturando el IMEI que el pedido ya procesó
    for (const it of order.items) {
        
        /* LÓGICA CLAVE: 
           Como tu createOrder ya puso el status en 'VENDIDO', 
           buscamos el serial de este producto que esté 'VENDIDO' para este tenant.
        */
        const serialRes = await db.query(
            `SELECT imei FROM serial_numbers 
             WHERE product_id = $1 AND tenant_id = $2 AND status = 'VENDIDO'
             ORDER BY id DESC LIMIT 1`, 
            [it.product_id, tenantId]
        );

        const imei = serialRes.rows.length > 0 ? serialRes.rows[0].imei : null;

        await db.query(
            `INSERT INTO invoice_items 
            (invoice_id, tenant_id, product_id, product_name_snapshot, qty, unit_price, total, imei_snapshot) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, 
            [
                invoice.id, 
                tenantId, 
                it.product_id, 
                it.product_name, 
                it.qty, 
                it.unit_price, 
                it.total,
                imei // Aquí guardamos el IMEI que encontramos
            ]
        );
    }

    // 5. Auditoría
    if (user && invoice.id) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId, 
            user_id: user.id, 
            user_name: user.name,
            module: 'FACTURACION', 
            action: 'CREATE', 
            description: `${invNumber} generada desde Pedido #${orderId}. Cliente: ${order.customer_name}`
        });
    }

    return invoice;
}

module.exports = { createInvoiceFromOrder };