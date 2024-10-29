const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

router.get('/projects', async (req, res) => {
  let projects = await Project.find().lean();

  res.render('projects', { 
    layout: "dashboard", 
    data: {
      projects: projects
    }
  });
});

router.post('/project/create', async (req, res) => {
  try {
    const { name, slug, status, location, fields} = req.body;

    const project = new Project({
      name,
      slug,
      status,
      location,
      fields
    });

    await project.save();

    res.status(200).send("Saved successfully");

  } catch (err) {
    console.log(err.toString());
    res.status(500).send(err.toString());
  }
});

router.get('/getProject/:projId', async (req,res) => {
  let project = await Project.findOne({_id: req.params.projId}).lean();
  res.render('partials/editProjectModal', { layout: false, data: {project} });
});

router.post('/project/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, status, location, fields } = req.body;

    // Find and update the project with the given ID
    const project = await Project.findByIdAndUpdate(
      id,
      { name, slug, status, location, fields },
      { new: true } 
    );

    if (!project) {
      return res.status(404).send("Project not found");
    }

    res.status(200).send("Updated successfully");

  } catch (err) {
    console.error(err.toString());
    res.status(500).send(err.toString());
  }
});

module.exports = router;
