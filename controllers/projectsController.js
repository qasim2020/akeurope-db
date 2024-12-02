const Project = require('../models/Project');
const { visibleLogs } = require("../modules/logAction");

exports.projects = async(req,res) => {
    let projects = await Project.find().lean();

    res.render('projects', { 
        layout: "dashboard", 
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            projects: projects,
            layout: req.session.layout,
            activeMenu: "allProjects",
            role: req.userPermissions,
            logs: await visibleLogs(req,res),
            sidebarCollapsed: req.session.sidebarCollapsed
        }
    });
};

exports.getData = async(req,res) => {
    let projects = await Project.find().lean();
  
    res.render('partials/showProjects', { 
        layout: false,
        data: {
            projects: projects,
            layout: req.session.layout
        }
    });
}