const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const projectController = require('../controllers/projectController');

router.get('/project/:slug', authenticate, authorize("viewProject"), allProjects, projectController.project);
router.get('/getProjectModal/:projId', authenticate, authorize("editProject"), projectController.editModal);
router.post('/project/create', authenticate, authorize("createProject"), projectController.createProject);
router.post('/project/update/:id', authenticate, authorize("updateProject"), projectController.updateProject);

module.exports = router;