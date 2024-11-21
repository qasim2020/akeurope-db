const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { visibleLogs } = require("../controllers/logAction");

router.get('/projects', authenticate, authorize("viewProject"), async (req, res) => {
  let projects = await Project.find().lean();

  res.render('projects', { 
    layout: "dashboard", 
    data: {
      userName: req.session.user.name,
      userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
      projects: projects,
      layout: req.session.layout,
      activeMenu: "allProjects",
      role: req.userPermissions,
      logs: await visibleLogs(req,res)
    }
  });
});

router.get('/getProjectsData', authenticate, authorize("viewProject"), async (req, res) => {
    let projects = await Project.find().lean();
  
    res.render('partials/showProjects', { 
      layout: false,
      data: {
        projects: projects,
        layout: req.session.layout
      }
    });
  });

module.exports = router;
