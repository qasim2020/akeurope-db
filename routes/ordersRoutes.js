const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const { allProjects } = require("../modules/mw-data");

router.get('/orders/', authenticate, authorize("viewOrders"), allProjects, ordersController.viewOrders);
router.get('/getOrdersData/', authenticate, authorize("viewOrders"), allProjects, ordersController.getOrdersData);
router.get('/getEditOrderModal/:orderId', authenticate, authorize("viewOrders"), ordersController.getEditOrderModal);
router.get('/getOrderTotalCost/:orderId', authenticate, authorize("viewOrders"), allProjects, ordersController.getOrderTotalCost);
router.get('/checkout/:orderId', authenticate, authorize("editOrders"), allProjects, ordersController.checkout);
router.get('/getPaymentModal/:orderId', authenticate, authorize("editOrders"), ordersController.getPaymentModal);
router.get('/deleteOrder/:orderId', authenticate, authorize("deleteOrders"), ordersController.deleteOrder);


module.exports = router;