const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const projectsController = require('../controllers/projectsController');

router.get('/projects', authenticate, authorize("viewProject"), projectsController.projects);
router.get('/getProjectsData', authenticate, authorize("viewProject"), projectsController.getData);

module.exports = router;