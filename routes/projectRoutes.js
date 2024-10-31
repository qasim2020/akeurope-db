const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/allProjects");
const { createDynamicModel } = require("../models/createDynamicModel");

router.get('/projects', authenticate, authorize("viewDashboard"), async (req, res) => {
  let projects = await Project.find().lean();

  res.render('projects', { 
    layout: "dashboard", 
    data: {
      projects: projects,
      layout: req.session.layout,
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


router.get('/getEntryModal/:slug/:id', authenticate, authorize("editEntry"), allProjects, async (req,res) => {

  try {
    // Find the project and retrieve the fields array
    const project = await Project.findOne({ slug: req.params.slug }).lean();

    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    // Retrieve entries from the dynamic collection using the project schema
    const DynamicModel = await createDynamicModel(project.slug);
    const entry = await DynamicModel.findOne({_id: req.params.id}).lean();

    res.render('partials/editEntryModal', {
      layout: false,
      data: {
        project,
        fields: project.fields, 
        layout: req.session.layout,
        entry
      }
    })

  } catch (error) {
      res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }

})

router.get('/getEntryData/:slug', authenticate, authorize("editEntry"), async (req,res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug }).lean();

    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    // Retrieve entries from the dynamic collection using the project schema
    const DynamicModel = await createDynamicModel(project.slug);
    const entries = await DynamicModel.find().lean();
    // Render search results page with appropriate partial
    res.render('partials/showProject', { 
        layout: false, 
        data: {
          entries,
          fields: project.fields,
          layout: req.session.layout
        }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching entries partial', details: error.message });
  }

});


router.get('/getProjectsData', authenticate, authorize("viewDashboard"), async (req, res) => {
  let projects = await Project.find().lean();

  res.render('partials/showProjects', { 
    layout: false,
    data: {
      projects: projects,
      layout: req.session.layout
    }
  });
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



router.get('/project/:slug', authenticate, authorize("viewDashboard"), allProjects, async (req,res) => {

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
        activeMenu: project.slug
      }
    })

  } catch (error) {
      res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }

})

router.post('/project/entry/:slug', authenticate, authorize("updateEntry"), async (req, res) => {
  try {
     // Find the project to get the schema fields
     const project = await Project.findOne({ slug: req.params.slug });
     if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

     // Create the dynamic model based on the project schema
     const DynamicModel = await createDynamicModel(project.slug);

     // Prepare data to match project fields
     const entryData = {};

     // Set the _id from the entryId passed from the front-end
     const entryId = req.body.entryId;

     // Validate the entryId to ensure it's a valid ObjectId
     if (!mongoose.Types.ObjectId.isValid(entryId)) {
         return res.status(400).json({ error: 'Invalid entryId provided' });
     }

     // Assign entryId to the _id field in entryData
     entryData._id = entryId;
     project.fields.forEach(field => {
        const fieldName = field.name;
        const fieldValue = req.body[fieldName];

        // Assign the value only if it exists in req.body
        if (fieldValue !== undefined) {
           entryData[fieldName] = fieldValue;
        }
     });

     // Save the new entry using the dynamic model
     const newEntry = new DynamicModel(entryData);
     await newEntry.save();

     res.status(201).json({ message: 'Entry created successfully', entry: newEntry });
  } catch (error) {
     res.status(500).json({ error: 'Error saving entry', details: error.message });
  }
});

router.post('/project/entry/update/:slug/:id', authenticate, authorize("updateEntry"), async (req, res) => {
  try {
    // Find the project to get the schema fields
    const project = await Project.findOne({ slug: req.params.slug });
    if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

    // Create the dynamic model based on the project schema
    const DynamicModel = await createDynamicModel(project.slug);

    // Prepare data to match project fields
    const entryData = {};
    project.fields.forEach(field => {
       const fieldName = field.name;
       const fieldValue = req.body[fieldName];

       // Assign the value only if it exists in req.body
       if (fieldValue !== undefined) {
          entryData[fieldName] = fieldValue;
       }
    });

    // Find the entry by ID and update it
    const updatedEntry = await DynamicModel.findByIdAndUpdate(req.params.id, entryData, { new: true });
    if (!updatedEntry) return res.status(404).json({ error: `Entry with ID ${req.params.id} not found` });

    res.status(200).json({ message: 'Entry updated successfully', entry: updatedEntry });
 } catch (error) {
    res.status(500).json({ error: 'Error updating entry', details: error.message });
 }
});

router.post('/project/entry/delete/:slug', authenticate, authorize("deleteEntry"), async (req, res) => {
  try {
    // Find the project to get the schema fields
    const project = await Project.findOne({ slug: req.params.slug });
    if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

    // Create the dynamic model based on the project schema
    const DynamicModel = await createDynamicModel(project.slug);

    // Prepare data to match project fields
    console.log(req.body);
    const updatedEntry = await DynamicModel.deleteOne({_id: req.body.entryId});

    if (!updatedEntry) return res.status(404).json({ error: `Entry with ID ${req.params.id} not found!` });

    res.status(200).json({ message: 'Entry deleted successfully', entry: updatedEntry });
  } catch (error) {
      res.status(500).json({ error: 'Error updating entry', details: error.message });
  }


});

module.exports = router;