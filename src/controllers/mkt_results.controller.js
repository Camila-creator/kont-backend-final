const ResultsModel = require("../models/mkt_results.model");

async function getDashboard(req, res, next) {
    try {
        const tenantId = req.user.tenant_id || req.user.tenantId;
        const { filter } = req.query;
        
        let startDate = new Date();
        let endDate = new Date();
        
        if (filter === 'mes') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        } else if (filter === 'trimestre') {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth() - 2, 1);
        } else if (filter === 'ano') {
            startDate = new Date(startDate.getFullYear(), 0, 1);
        } else if (filter === 'historico') {
            startDate = new Date('2020-01-01');
        }

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        // Le pasamos el tenantId al modelo
        const financeData = await ResultsModel.getFinancialData(startStr, endStr, tenantId);

        res.json({
            success: true,
            data: {
                kpis: { ingresos: financeData.ingresos, gastos: financeData.gastos, seguidores: financeData.topPerformers.seguidores },
                graficoDistribucion: financeData.distribucion,
                graficoFinanzas: { etiquetas: ['Periodo Actual'], ingresos: [financeData.ingresos], gastos: [financeData.gastos] },
                topPerformers: financeData.topPerformers
            }
        });
    } catch (error) { next(error); }
}
module.exports = { getDashboard };