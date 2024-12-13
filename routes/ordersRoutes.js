const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const ordersController = require('../controllers/ordersController');
const { allProjects } = require("../modules/mw-data");

router.get('/orders/', authenticate, authorize("viewOrders"), allProjects, ordersController.viewOrders);

module.exports = router;