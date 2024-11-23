const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const logController = require('../controllers/logController');

router.post("/clearNotification/:logId", authenticate, authorize("editNotifications"), logController.clearOne);

module.exports = router;