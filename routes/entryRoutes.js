const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const { createDynamicModel } = require("../models/createDynamicModel");

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


router.get('/getEntryData/:slug', authenticate, authorize("viewEntry"), async (req,res) => {
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