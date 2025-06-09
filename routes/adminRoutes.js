require('dotenv').config();
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require('../modules/mw-data');
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard', authenticate, authorize('viewDashboard'), allProjects, dashboardController.showDashboard);
router.get('/getActivityData', authenticate, authorize('viewDashboard'), dashboardController.getActivityData);
router.get('/getJourneyData', authenticate, authorize('viewJourney'), dashboardController.getJourneyData);
router.post('/renderPartial', dashboardController.renderPartial);
router.post('/update-layout', dashboardController.updateLayout);
router.post('/toggleSidebar', authenticate, authorize('viewDashboard'), dashboardController.toggleSideBar);
router.get('/getFreshNotifications', authenticate, authorize('viewDashboard'), dashboardController.notifications);
router.get('/socket-url', authenticate, authorize('viewDashboard'), (req, res) => res.json({ socketUrl: process.env.URL }) );

module.exports = router;