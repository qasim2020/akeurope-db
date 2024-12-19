const path = require('path');
const { saveLog, customerLogs, visibleLogs } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const { getSingleOrder } = require('../modules/orders');
const { generateInvoice } = require('../modules/invoice');

exports.getInvoice = async (req, res) => {
    try {
        if (req.params.orderId == 'blank') {
            res.status(200).render('error', {
                message: 'Invoice will load after you select beneficiaries',
                success: true,
            });
            return;
        }

        const order = await getSingleOrder(req, res);

        if (!order) {
            res.status(200).render('error', {
                message: 'Order not yet created',
                success: true,
            });
            return;
        }

        if (order.projects.length == 0) {
            res.status(200).render('error', {
                message: 'Invoice is created after you select beneficiaries',
                success: true,
            });
            return;
        }

        let invoicePath = '';

        if (order.status == 'draft') {
            invoicePath = await generateInvoice(order);
        } else {
            const invoiceDir = path.join(__dirname, '../invoices');
            invoicePath = path.join(
                invoiceDir,
                `${order.customer.email}_order_no_${order.orderNo}.pdf`,
            );
        }

        res.sendFile(invoicePath);
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(404).render('error', { heading: 'Server Error', error });
    }
};
