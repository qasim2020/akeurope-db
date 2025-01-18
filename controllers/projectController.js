const mongoose = require('mongoose');
const Project = require('../models/Project');
const { toKebabCase } = require("../modules/stringFuncs");
const { projectEntries } = require("../modules/projectEntries");
const { saveLog, visibleLogs } = require("../modules/logAction");
const { logTemplates } = require("../modules/logTemplates");
const { getChanges } = require("../modules/getChanges");

exports.createProject = async(req,res) => {
  try {
    const { name, slug, status, currency, location, fields} = req.body;

    const project = new Project({
      _id: new mongoose.Types.ObjectId(),
      name,
      slug: toKebabCase(slug),
      status,
      currency,
      location,
      fields
    });

    await saveLog(logTemplates({ 
      type: 'projectCreated',
      entity: project,
      actor: req.session.user 
    }));

    await project.save();

    res.status(200).send("Saved successfully");

  } catch (err) {
    console.log(err.toString());
    res.status(500).send(err.toString());
  }

}

exports.editModal = async(req,res) => {
  let project = await Project.findOne({_id: req.params.projId}).lean();
  res.render('partials/editProjectModal', { layout: false, data: {project} });
}

exports.updateProject = async(req,res) => {
  try {
    const { id } = req.params;
    const { name, slug, currency, status, location, fields } = req.body;
    
    const originalProject = await Project.findById(id);
    
    if (!originalProject) {
      return res.status(404).send("Project not found");
    }

    const updatedData = {
      name,
      slug: toKebabCase(slug),
      status,
      currency,
      location,
      fields,
    };
    
    changeDetails = getChanges(originalProject, updatedData, ['fields']);

    if (changeDetails.length > 0) {
                             
        await saveLog(logTemplates({ 
            type: 'projectUpdated',
            entity: originalProject,
            actor: req.session.user,
            changes: changeDetails
        }));
            
        await Project.findByIdAndUpdate(
            id,
            updatedData,
            { new: true } 
        );

    }

    res.status(200).send("Project updated successfully");

  } catch (err) {
    console.log(err);
    res.status(500).send(err.toString());
  }

};

exports.project = async(req,res) => {
  try {

    if (!req.userPermissions.includes(req.params.slug)) {
      return res.render('error', {
        heading: 'Unauthorized',
        error: 'You are not authorized to view this project',
      })
    }

    const { entries, project, pagination } = await projectEntries(req,res);

    const newEntryId = new mongoose.Types.ObjectId();
    res.render('project', {
      layout: "dashboard",
      data: {
        userId: req.session.user._id,
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
        logs: await visibleLogs(req,res),
        sidebarCollapsed: req.session.sidebarCollapsed
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Error fetching entries', details: error.message });
  }
};