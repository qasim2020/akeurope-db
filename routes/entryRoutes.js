const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const cloudinary = require('cloudinary').v2;
const moment = require("moment");
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const { createDynamicModel } = require("../models/createDynamicModel");
const { projectEntries } = require("../modules/projectEntries");
const { saveLog, visibleLogs, entryLogs } = require("../controllers/logAction");

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
      const { entries, project, pagination } = await projectEntries(req,res);

      res.render('partials/showProject', {
        layout: false,
        data: {
          fields: project.fields,
          project, 
          entries,
          layout: req.session.layout,
          pagination,
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'An error occurred while fetching entries partial', details: error.message });
    }
  
});

router.post('/project/entry/:slug', authenticate, authorize("createEntry"), async (req, res) => {
    try {
       const project = await Project.findOne({ slug: req.params.slug });
       if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });
  
       const DynamicModel = await createDynamicModel(project.slug);
  
       const entryData = {};
  
       const entryId = req.body.entryId;
  
       if (!mongoose.Types.ObjectId.isValid(entryId)) {
           return res.status(400).json({ error: 'Invalid entryId provided' });
       }
  
       entryData._id = entryId;
       project.fields.forEach(field => {
          const fieldName = field.name;
          const fieldValue = req.body[fieldName];
  
          if (fieldValue !== undefined) {
             entryData[fieldName] = fieldValue;
          }
       });

       const primaryField = project.fields.find( field => field.primary == true );
  
       const newEntry = new DynamicModel(entryData);

       await newEntry.save();
                        
       await saveLog({
          entityType: 'entry',
          entityId: entryId,
          actorType: 'user',
          actorId: req.session.user._id,
          url: `/entry/${entryId}/project/${project.slug}`,
          action: 'Entry created',
          details: `Entry <strong>${newEntry[primaryField.name]}</strong> created in project <strong>${project.name}</strong> created by <strong>${req.session.user.email}</strong>`,
          color: 'green',
          isNotification: true,
      });
  
      res.status(201).json({ message: 'Entry created successfully', entry: newEntry });
    } catch (error) {
      res.status(500).json({ error: 'Error saving entry', details: error.message });
    }
});

router.post('/project/entry/update/:slug/:id', authenticate, authorize("updateEntry"), async (req, res) => {
    try {

      const project = await Project.findOne({ slug: req.params.slug });
      if (!project) return res.status(404).json({ error: `Project ${req.params.slug} not found` });
      
      const DynamicModel = await createDynamicModel(project.slug);
      
      const entryId = req.params.id;
      
      if (!mongoose.Types.ObjectId.isValid(entryId)) {
          return res.status(400).json({ error: 'Invalid entryId provided' });
      }
      
      const existingEntry = await DynamicModel.findById(entryId);
      if (!existingEntry) {
          return res.status(404).json({ error: 'Entry not found' });
      }
      
      const entryData = {};
      const updatedFields = {};
      project.fields.forEach((field) => {
          const fieldName = field.name;
          const fieldValue = req.body[fieldName];

          if (fieldValue !== undefined) {
              entryData[fieldName] = fieldValue;
          }

          if (field.type === 'date') {
            const formattedExisting = moment(existingEntry[fieldName]).format('YYYY-MM-DD');
            const formattedNew = moment(fieldValue).format('YYYY-MM-DD');

            if (formattedExisting != formattedNew) {
                entryData[fieldName] = formattedNew; // Use formatted value for saving
                updatedFields[fieldName] = {
                    from: formattedExisting,
                    to: formattedNew,
                };
            } 

          } else {
              if (existingEntry[fieldName] != fieldValue) {
                  entryData[fieldName] = fieldValue;
                  updatedFields[fieldName] = {
                      from: existingEntry[fieldName],
                      to: fieldValue,
                  };
              }
          };

      });

      Object.assign(existingEntry, entryData);

      await existingEntry.save();

      if (Object.keys(updatedFields).length > 0) {

        const changedEntries = Object.entries(updatedFields)
            .map(
                ([field, { from, to }]) =>
                    `<strong>${field}</strong>: "${from || 'null'}" → "${to || 'null'}"`
            )
            .join('<br>');

        const primaryField = project.fields.find( field => field.primary == true );

        await saveLog({
          entityType: 'entry',
          entityId: entryId,
          actorType: 'user',
          actorId: req.session.user._id,
          url: `/entry/${entryId}/project/${project.slug}`,
          action: 'Entry updated',
          details: `Entry <strong>${existingEntry[primaryField.name]}</strong> updated in project <strong>${project.name}</strong> by <strong>${req.session.user.email}</strong>: <br> ${changedEntries}`,
          color: 'blue',
          isNotification: true, 
        })

      };
      
      res.status(200).send("Entry updated successfully");

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

    const deletionPromises = project.fields
      .filter(field => ['image', 'file'].includes(field.type) && entry[field.name])
      .map(field => {
        const fileUrl = entry[field.name];

        if (fileUrl.includes("res.cloudinary.com")) {
          const publicId = extractCloudinaryPublicId(fileUrl); 
          return cloudinary.uploader.destroy(publicId, { resource_type: field.type === 'image' ? 'image' : 'raw' });
        }
      })
      .filter(Boolean);  

    const primaryField = project.fields.find(field => field.primary == true);

    await Promise.all(deletionPromises);

    await DynamicModel.deleteOne({ _id: req.body.entryId });

    await saveLog({
      entityType: 'entry',
      entityId: entry._id,
      actorType: 'user',
      actorId: req.session.user._id,
      url: `/entry/${entry._id}/project/${project.slug}`,
      action: 'Entry deleted',
      details: `Entry <strong>${primaryField.actualName}</strong> = <strong>${entry[primaryField.name]}</strong> deleted in project <strong>${project.name}</strong> by <strong>${req.session.user.email}</strong>`,
      color: 'red',
      isNotification: true,  
    })

    res.status(200).json({ message: 'Entry and associated Cloudinary files deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting entry or associated files', details: error.message });
  }
});

router.get('/entry/:entryId/project/:slug', authenticate, authorize("viewEntry"), allProjects, async (req,res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    const DynamicModel = await createDynamicModel(project.slug);
    const entry = await DynamicModel.findOne({_id: req.params.entryId}).lean();

    res.render('entry', {
      layout: "dashboard",
      data: {
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
        activeMenu: project.slug,
        projects: req.allProjects,
        project,
        fields: project.fields, 
        layout: req.session.layout,
        entry, 
        role: req.userPermissions,
        logs: await visibleLogs(req,res),
        entryLogs: await entryLogs(req,res)
      }
    })

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }
})

module.exports = router;