const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const { createDynamicModel } = require("../models/createDynamicModel");
const { toKebabCase } = require("../modules/stringFuncs");

router.post('/project/create', authenticate, authorize("createProject"), async (req, res) => {
  try {
    const { name, slug, status, location, fields} = req.body;

    const project = new Project({
      name,
      slug: toKebabCase(slug),
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

router.get('/getProjectModal/:projId', authenticate, authorize("editProject"), async (req,res) => {
  let project = await Project.findOne({_id: req.params.projId}).lean();
  res.render('partials/editProjectModal', { layout: false, data: {project} });
});

router.post('/project/update/:id', authenticate, authorize("updateProject"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, status, location, fields } = req.body;

    // Find and update the project with the given ID
    const project = await Project.findByIdAndUpdate(
      id,
      { name, slug: toKebabCase(slug), status, location, fields },
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

router.get('/project/:slug', authenticate, authorize("viewProject"), allProjects, async (req,res) => {

  try {
    // Find the project and retrieve the fields array
    const project = await Project.findOne({ slug: req.params.slug }).lean();

    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    // Retrieve entries from the dynamic collection using the project schema
    const DynamicModel = await createDynamicModel(project.slug);
    const entries = await DynamicModel.find().lean();

    const newEntryId = new mongoose.Types.ObjectId();

    res.render('project', {
      layout: "dashboard",
      data: {
        project,
        fields: project.fields, 
        entries, 
        layout: req.session.layout, 
        newEntryId, 
        projects: req.allProjects,
        activeMenu: project.slug,
        role: req.userPermissions
      }
    })

  } catch (error) {
      res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }

})

module.exports = router;