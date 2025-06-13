const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const { allProjects } = require('../modules/mw-data');

router.get('/orders/', authenticate, authorize('viewOrders'), allProjects, ordersController.viewOrders);
router.get('/getOrdersData', authenticate, authorize('viewOrders'), allProjects, ordersController.getOrdersData);
router.get('/getEditOrderModal/:orderId', authenticate, authorize('viewOrders'), ordersController.getEditOrderModal);
router.get('/getOrderTotalCost/:orderId', authenticate, authorize('viewOrders'), allProjects, ordersController.getOrderTotalCost);
router.post('/changeOrderStatus/:orderId', authenticate, authorize('editOrders'), ordersController.changeOrderStatus);
router.get('/deleteOrder/:orderId', authenticate, authorize('deleteOrders'), ordersController.deleteOrder);
router.post('/emailInvoice/:orderId', authenticate, authorize('viewOrders'), ordersController.emailInvoice);
router.post('/emailThanks/:orderId', authenticate, authorize('viewOrders'), ordersController.emailThanks);
router.post('/emailClarify/:orderId', authenticate, authorize('viewOrders'), ordersController.emailClarify);
router.get('/order/:orderId', authenticate, authorize('viewOrders'), allProjects, ordersController.viewOrder);
router.get('/getOrderLogs/:orderId', authenticate, authorize('viewOrders'), ordersController.getOrderLogs);
router.get('/getOrderData/:orderId', authenticate, authorize('viewOrders'), ordersController.getOrderData);
router.get('/getOrderProjects/:orderId', authenticate, authorize('viewEntry'), ordersController.getOrderProjects);
router.get('/getSendUpdateModal-order/:orderId', authenticate, authorize('viewOrders'), ordersController.getSendUpdateModal);
router.post('/sendOrderUpdateOnEmail/:orderId', authenticate, authorize('viewOrders'), ordersController.sendOrderUpdateOnEmail);

module.exports = router;
