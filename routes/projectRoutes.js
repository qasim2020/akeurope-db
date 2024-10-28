const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

router.get('/projects', async (req, res) => {
  let projects = await Project.find().lean();
  // return res.send(projects);
  res.render('projects', { 
    layout: "dashboard", 
    data: {
      projects: projects
    }
  });
});

router.post('/project/create', async (req, res) => {
  try {
    const { name, slug, status, location } = req.body;

    console.log( {name, slug, status, location })

    const project = new Project({
      name,
      slug,
      status,
      location
    });

    await project.save();

    res.status(200).send("Saved successfully");

  } catch (err) {
    res.status(500).send(err);
  }
});

router.get('/edit-project/:projId', async (req,res) => {
  let project = await Project.findOne({_id: req.params.projId}).lean();
  res.render('projectEdit', {
    layout: "dashboard", 
    data: {
      project: project
    }
  });
});

module.exports = router;
