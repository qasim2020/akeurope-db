const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require('../modules/mw-data');
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard', authenticate, authorize('viewDashboard'), allProjects, dashboardController.showDashboard);
router.get('/getActivityData', authenticate, authorize('viewDashboard'), dashboardController.getActivityData);
router.post('/renderPartial', dashboardController.renderPartial);
router.post('/update-layout', dashboardController.updateLayout);
router.post('/toggleSidebar', authenticate, authorize('viewDashboard'), dashboardController.toggleSideBar);

module.exports = router;