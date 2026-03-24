const model = require("../models/invoices.model");

exports.create = async (req, res) => {
    try {
        const { order_id } = req.body;
        const tenantId = req.user.tenant_id; // Viene del verifyToken
        const user = req.user;

        const invoice = await model.createInvoiceFromOrder(order_id, tenantId, user);
        
        res.status(201).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};