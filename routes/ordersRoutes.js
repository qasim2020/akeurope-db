const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const { allProjects } = require("../modules/mw-data");

router.get('/orders/', authenticate, authorize("viewOrders"), allProjects, ordersController.viewOrders);
router.get('/order/:orderId', authenticate, authorize("viewOrders"), allProjects, ordersController.viewOrder);
router.get('/getOrdersData/', authenticate, authorize("viewOrders"), allProjects, ordersController.getOrdersData);
router.get('/getEditOrderModal/:orderId', authenticate, authorize("viewOrders"), ordersController.getEditOrderModal);

module.exports = router;