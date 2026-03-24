// backend/src/models/customer_payments.model.js
const db = require("../db");
const audit = require("../controllers/audit.controller");

/**
 * Listar pagos con filtros por cliente o pedido.
 * Incluye order_number y finance_account_id para la UI.
 */
async function listCustomerPayments({ customer_id, order_id, tenant_id } = {}) {
    const params = [tenant_id]; 
    const where = [`cp.tenant_id = $1`]; 

    if (customer_id != null && customer_id !== "") { 
        params.push(Number(customer_id)); 
        where.push(`cp.customer_id = $${params.length}`); 
    }
    if (order_id != null && order_id !== "") { 
        params.push(Number(order_id)); 
        where.push(`cp.order_id = $${params.length}`); 
    }

    const q = `
        SELECT 
            cp.id, 
            cp.customer_id, 
            c.name AS customer_name, 
            cp.order_id, 
            o.order_number, 
            cp.amount, 
            cp.method, 
            cp.ref, 
            cp.paid_at, 
            cp.notes, 
            cp.finance_account_id
        FROM customer_payments cp
        LEFT JOIN customers c ON c.id = cp.customer_id
        LEFT JOIN orders o ON o.id = cp.order_id
        WHERE ${where.join(" AND ")}
        ORDER BY cp.paid_at DESC, cp.id DESC;
    `;
    const r = await db.query(q, params, tenant_id);
    return r.rows;
}

/**
 * CREAR PAGO (Con transacción y soporte para equipos usados y ruteo automático)
 */
async function createCustomerPayment(payload, user) {
    const client = await db.pool.connect();
    
    try {
        await client.query("BEGIN");
        
        // Configuramos el tenant para la sesión
        await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [payload.tenant_id.toString()]);

        // =========================================================
        // MAGIA DE RUTEO: Si no viene cuenta, la buscamos por el método
        // =========================================================
        if (!payload.finance_account_id && payload.method) {
            const qRoute = `
                SELECT account_id 
                FROM finance_method_routing 
                WHERE method = $1 AND tenant_id = $2 AND is_active = true 
                LIMIT 1
            `;
            const resRoute = await client.query(qRoute, [payload.method, payload.tenant_id]);
            
            if (resRoute.rows.length > 0) {
                payload.finance_account_id = resRoute.rows[0].account_id;
            }
        }

        // 1. Insertar el pago incluyendo finance_account_id ($9)
        const qPago = `
            INSERT INTO customer_payments (
                tenant_id, 
                customer_id, 
                order_id, 
                amount, 
                method, 
                ref, 
                paid_at, 
                notes, 
                finance_account_id
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8, $9) 
            RETURNING *;
        `;
        
        const vPago = [
            payload.tenant_id, 
            Number(payload.customer_id), 
            payload.order_id ? Number(payload.order_id) : null, 
            Number(payload.amount), 
            payload.method, 
            payload.ref, 
            payload.paid_at, 
            payload.notes,
            payload.finance_account_id ? Number(payload.finance_account_id) : null
        ];
        
        const resPago = await client.query(qPago, vPago);
        const nuevoPago = resPago.rows[0];

        // 2. Si es EQUIPO_USADO, lo registramos en el limbo (received_phones)
        if (payload.method === "EQUIPO_USADO") {
            const qPhone = `
                INSERT INTO received_phones (
                    tenant_id, 
                    order_id, 
                    model_description, 
                    credit_amount, 
                    status, 
                    user_id,
                    created_at
                )
                VALUES ($1, $2, $3, $4, 'PENDIENTE', $5, NOW())
            `;
            
            await client.query(qPhone, [
                payload.tenant_id, 
                payload.order_id, 
                payload.phone_model || payload.notes, 
                Number(payload.amount),
                user ? user.id : null
            ]);
        }

        await client.query("COMMIT");

        // 3. Registro en auditoría
        if (nuevoPago && user) {
            await audit.saveAuditLogInternal({
                tenant_id: payload.tenant_id,
                user_id: user.id,
                user_name: user.name,
                module: 'FINANZAS',
                action: 'CREATE_PAYMENT',
                description: `Pago registrado: $${payload.amount} de cliente ID ${payload.customer_id} en cuenta ID ${payload.finance_account_id || 'No asignada'}`
            });
        }
        
        return nuevoPago;

    } catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ ERROR EN TRANSACCIÓN DE PAGO:", e);
        throw e;
    } finally {
        client.release();
    }
}

/**
 * Borrado físico de pagos
 */
async function deleteCustomerPayment(id, tenantId, user) {
    const q = `DELETE FROM customer_payments WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const r = await db.query(q, [Number(id), tenantId], tenantId);
    const eliminado = r.rows[0];

    if (eliminado && user) {
        await audit.saveAuditLogInternal({
            tenant_id: tenantId,
            user_id: user.id,
            user_name: user.name,
            module: 'FINANZAS',
            action: 'DELETE_PAYMENT',
            description: `Se eliminó el pago ID ${id} por $${eliminado.amount}`
        });
    }
    return eliminado;
}

module.exports = { 
    listCustomerPayments, 
    createCustomerPayment, 
    deleteCustomerPayment 
};