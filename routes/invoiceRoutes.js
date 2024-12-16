const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const invoiceController = require('../controllers/invoiceController');

router.get('/invoice/:orderId', authenticate, authorize('viewInvoices'), invoiceController.getInvoice);

module.exports = router;