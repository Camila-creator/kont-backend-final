// backend/controllers/finance_dashboard.controller.js
const DashboardModel = require("../models/finance_dashboard.model");

exports.getDashboard = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || req.user.tenantId;
        const { filter } = req.query; 
        
        let startDate = new Date(); let endDate = new Date();
        if (filter === 'ano') { startDate = new Date(startDate.getFullYear(), 0, 1); } 
        else { startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1); endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); }

        const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
        const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';

        const data = await DashboardModel.getDashboardData(startStr, endStr, tenantId);

        res.json({
            kpis: { liquidez: data.ingresos - data.egresos, ingresos: data.ingresos, egresos: data.egresos, cxc: data.cxc, cxp: data.cxp, gasto_mkt: data.gasto_mkt },
            accounts: data.accounts.map(a => ({ name: a.name, bank: a.bank_name, currency: a.currency, balance: parseFloat(a.balance), is_default: a.is_default })),
            methodsIn: data.methodsIn.map(m => ({ method: m.method, total: parseFloat(m.total) })),
            muro: {
                mejor_cliente: { nombre: data.muro.mejor_cliente.nombre, monto: parseFloat(data.muro.mejor_cliente.monto) },
                deudor_cliente: { nombre: data.muro.deudor_cliente.nombre, monto: parseFloat(data.muro.deudor_cliente.monto) },
                mejor_proveedor: { nombre: data.muro.mejor_proveedor.nombre, monto: parseFloat(data.muro.mejor_proveedor.monto) },
                deudor_proveedor: { nombre: data.muro.deudor_proveedor.nombre, monto: parseFloat(data.muro.deudor_proveedor.monto) }
            }
        });
    } catch (error) { res.status(500).json({ error: "Error calculando métricas financieras" }); }
};