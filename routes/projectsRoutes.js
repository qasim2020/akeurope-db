const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');

router.get('/projects', authenticate, authorize("viewProject"), async (req, res) => {
  let projects = await Project.find().lean();

  res.render('projects', { 
    layout: "dashboard", 
    data: {
      projects: projects,
      layout: req.session.layout,
      activeMenu: "allProjects",
      role: req.userPermissions
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
