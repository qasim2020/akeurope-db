const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { attachments } = require("../modules/attachments");
const { createDynamicModel } = require("../models/createDynamicModel");

router.get('/projects', async (req, res) => {
  let projects = await Project.find().lean();

  res.render('projects', { 
    layout: "dashboard", 
    data: {
      projects: projects,
      activeMenu: "allProjects"
    }
  });
});

function toKebabCase(str) {
    return str
        .toLowerCase()                // Convert entire string to lowercase
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric characters with hyphens
        .replace(/(^-|-$)/g, '');     // Remove leading or trailing hyphens if any
}


router.post('/project/create', async (req, res) => {
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


router.get('/project/:slug', attachments, async (req,res) => {

  try {
    // Find the project and retrieve the fields array
    const project = await Project.findOne({ slug: req.params.slug }).lean();

    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    // Retrieve entries from the dynamic collection using the project schema
    const DynamicModel = await createDynamicModel(project.slug);
    const entries = await DynamicModel.find();

    res.render('project', {
      layout: "dashboard",
      data: {
        project,
        fields: project.fields, 
        entries, 
        projects: req.allProjects,
        activeMenu: project.slug
      }
    })

  } catch (error) {
      res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }

})

module.exports = router;