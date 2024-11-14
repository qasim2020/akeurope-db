const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const cloudinary = require('cloudinary').v2;
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const { createDynamicModel } = require("../models/createDynamicModel");
const { generatePagination } = require("../modules/generatePagination");

// Helper to extract public ID from Cloudinary URL
function extractCloudinaryPublicId(url) {
  const parts = url.split('/');
  const publicIdWithExtension = parts.slice(7).join('/').split('.')[0];
  return publicIdWithExtension;
}

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

      const DynamicModel = await createDynamicModel(project.slug);

      // Pagination setup
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Sorting setup
      const sortBy = req.query.sortBy || '_id'; // Default sorting by _id
      const order = req.query.order === 'desc' ? -1 : 1; // Default order is ascending
      const sortOptions = { [sortBy]: order };

      // Search setup
      const search = req.query.search || '';
      const searchFields = project.fields.map(field => ({ [field.name]: new RegExp(search, 'i') }));
      const searchQuery = search ? { $or: searchFields } : {};

      // Fetch entries with sorting, pagination, and search
      const entries = await DynamicModel.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Count total documents for pagination info
      const totalEntries = await DynamicModel.countDocuments(searchQuery);
      const totalPages = Math.ceil(totalEntries / limit);
      
      // Render response with entries, pagination info, and sorting/search metadata
      const newEntryId = new mongoose.Types.ObjectId();
      res.render('partials/showProject', {
        layout: false,
        data: {
          fields: project.fields,
          entries,
          layout: req.session.layout,
          pagination: {
            totalEntries,
            totalPages,
            currentPage: page,
            limit,
            skip,
            startIndex: skip + 1,
            endIndex: Math.min(skip + limit, totalEntries),
            pagesArray: generatePagination(totalPages, page)
          },
          sort: { sortBy, order },
          search
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
    const project = await Project.findOne({ slug: req.params.slug });
    if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });

    const DynamicModel = await createDynamicModel(project.slug);
    const entry = await DynamicModel.findOne({ _id: req.body.entryId });

    if (!entry) return res.status(404).json({ error: `Entry with ID ${req.body.entryId} not found!` });

    // Filter fields for file types "image" or "file"
    const deletionPromises = project.fields
      .filter(field => ['image', 'file'].includes(field.type) && entry[field.name])
      .map(field => {
        const fileUrl = entry[field.name];

        // Check if URL is hosted on Cloudinary before deleting
        if (fileUrl.includes("res.cloudinary.com")) {
          const publicId = extractCloudinaryPublicId(fileUrl); // Helper function to get the Cloudinary public ID
          return cloudinary.uploader.destroy(publicId, { resource_type: field.type === 'image' ? 'image' : 'raw' });
        }
      })
      .filter(Boolean);  // Remove undefined promises for non-Cloudinary URLs

    // Wait for Cloudinary deletions to complete
    await Promise.all(deletionPromises);

    // Delete the entry from the database
    await DynamicModel.deleteOne({ _id: req.body.entryId });

    res.status(200).json({ message: 'Entry and associated Cloudinary files deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting entry or associated files', details: error.message });
  }
});

module.exports = router;