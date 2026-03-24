// backend/controllers/dashboard_main.controller.js
const MainModel = require("../models/dashboard_main.model");

exports.getMainDashboard = async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || req.user.tenantId;
        const today = new Date();
        
        // Fechas para filtros
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const sevenDaysAgoDate = new Date(); 
        sevenDaysAgoDate.setDate(today.getDate() - 6);
        const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

        const data = await MainModel.getMainDashboardData(startOfMonth, sevenDaysAgo, today.toISOString().split('T')[0], tenantId);

        // --- PROCESAR GRÁFICA (7 DÍAS) ---
        const diasSemana = []; 
        const ventasGrafica = []; 
        const comprasGrafica = []; 
        const shortDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); 
            d.setDate(today.getDate() - i); 
            // Formato YYYY-MM-DD local para comparar
            const localDateStr = d.toISOString().split('T')[0];
            
            diasSemana.push(shortDays[d.getDay()]);
            
            const v = data.chartVentas.find(x => {
                const dbDate = new Date(x.fecha).toISOString().split('T')[0];
                return dbDate === localDateStr;
            });
            
            const c = data.chartCompras.find(x => {
                const dbDate = new Date(x.fecha).toISOString().split('T')[0];
                return dbDate === localDateStr;
            });
            
            ventasGrafica.push(v ? parseFloat(v.total) : 0); 
            comprasGrafica.push(c ? parseFloat(c.total) : 0);
        }

        // --- PROCESAR PAGOS URGENTES (CXP) ---
        const urgentPayments = data.urgentPayments.map(p => {
            let estadoStr = "normal"; 
            let venceLabel = "Sin fecha";
            
            if (p.vence) {
                const fVence = new Date(p.vence);
                const hoy = new Date();
                hoy.setHours(0,0,0,0);
                fVence.setHours(0,0,0,0);
                
                const diffDays = Math.ceil((fVence - hoy) / (1000 * 60 * 60 * 24)); 
                
                if (diffDays < 0) { venceLabel = "Vencido"; estadoStr = "critico"; }
                else if (diffDays === 0) { venceLabel = "Hoy"; estadoStr = "critico"; }
                else if (diffDays === 1) { venceLabel = "Mañana"; estadoStr = "alerta"; }
                else { venceLabel = fVence.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
            }
            return { proveedor: p.proveedor, vence: venceLabel, total: parseFloat(p.total), estado: estadoStr };
        });

        // --- RESPUESTA FINAL ---
        res.json({
            ok: true,
            kpis: { 
                ventasMes: data.ventasMes, 
                pedidosActivos: data.pedidosActivos, 
                cxc: data.cxc, 
                stockCritico: data.stockAlerts.length 
            },
            chartData: { 
                dias: diasSemana, 
                ventas: ventasGrafica, 
                compras: comprasGrafica 
            },
            stockAlerts: data.stockAlerts.map(s => ({
                id: s.id,
                nombre: s.nombre,
                actual: parseFloat(s.actual),
                minimo: parseFloat(s.minimo)
            })),
            recentOrders: data.recentOrders.map(o => ({ 
                id: o.id, 
                cliente: o.cliente, 
                status: o.status, 
                total: parseFloat(o.total) 
            })),
            urgentPayments: urgentPayments, 
            marketing: data.marketing
        });
    } catch (error) { 
        console.error("Error en Dashboard Controller:", error);
        res.status(500).json({ ok: false, error: "Error al cargar el Dashboard" }); 
    }
};