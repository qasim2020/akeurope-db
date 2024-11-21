const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const { toKebabCase } = require("../modules/stringFuncs");
const { generatePagination } = require("../modules/generatePagination");
const { projectEntries } = require("../modules/projectEntries");
const { saveLog, visibleLogs } = require("../controllers/logAction");

router.post('/project/create', authenticate, authorize("createProject"), async (req, res) => {
  try {
    const { name, slug, status, location, fields} = req.body;

    const project = new Project({
      _id: new mongoose.Types.ObjectId(),
      name,
      slug: toKebabCase(slug),
      status,
      location,
      fields
    });

    await project.save();

    await saveLog({
      entityType: 'project',
      entityId: project._id,
      actorType: 'user',
      actorId: req.session.user._id,
      url: `/project/${project.slug}`,
      action: 'Project created',
      details: `Project <strong>${project.slug}</strong> created by <strong>${req.session.user.email}</strong>`,
      color: 'green',
      isNotification: true,
    });

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
    
    const originalProject = await Project.findById(id);
    
    if (!originalProject) {
      return res.status(404).send("Project not found");
    }
    
    const updatedData = {
      name,
      slug: toKebabCase(slug),
      status,
      location,
      fields,
    };
    
    const updatedProject = await Project.findByIdAndUpdate(
      id,
      updatedData,
      { new: true } 
    );
    
    let changeDetails = '';

    for (const [key, newValue] of Object.entries(updatedData)) {
      const oldValue = originalProject[key];

      if (key === 'fields' && Array.isArray(newValue) && Array.isArray(oldValue)) {
        const fieldChanges = [];

        const maxLength = Math.max(oldValue.length, newValue.length);
        for (let i = 0; i < maxLength; i++) {
          const oldField = oldValue[i] ?? {};
          const newField = newValue[i] ?? {};

          const fieldDiffs = [];
          for (const [fieldKey, newFieldValue] of Object.entries(newField)) {
            const oldFieldValue = oldField[fieldKey];
            if (oldFieldValue !== newFieldValue) {
              fieldDiffs.push(
                `${fieldKey}: ${oldFieldValue ?? 'null'} → ${newFieldValue ?? 'null'}`
              );
            }
          }

          if (fieldDiffs.length > 0) {
            fieldChanges.push(`<strong>${newField.actualName}</strong>: ${fieldDiffs.join(', ')}`);
          }
        }

        if (fieldChanges.length > 0) {
          changeDetails += `${fieldChanges.join('<br>')}<br>`;
        }
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changeDetails += `<strong>${key}</strong>: ${oldValue ?? 'null'} → ${newValue ?? 'null'}<br>`;
      }
    }

    if (changeDetails) {

      await saveLog({
        entityType: 'project',
        entityId: id,
        actorType: 'user',
        actorId: req.session.user._id,
        url: `/project/${updatedProject.slug}`,
        action: 'Project updated',
        details: `Project <strong>${updatedProject.slug}</strong> updated by <strong>${req.session.user.email}</strong>:<br>${changeDetails}`,
        color: 'green',
        isNotification: true,
      });
    
    }

    res.status(200).send("Project updated successfully");

  } catch (err) {
    console.error(err.toString());
    res.status(500).send(err.toString());
  }
});

router.get('/project/:slug', authenticate, authorize("viewProject"), allProjects, async (req, res) => {
  try {

    const { entries, project, pagination } = await projectEntries(req,res);

    const newEntryId = new mongoose.Types.ObjectId();
    res.render('project', {
      layout: "dashboard",
      data: {
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
        project,
        fields: project.fields,
        entries,
        layout: req.session.layout,
        newEntryId,
        projects: req.allProjects,
        activeMenu: project.slug,
        role: req.userPermissions,
        pagination,
        logs: await visibleLogs(req,res)
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }
});


module.exports = router;