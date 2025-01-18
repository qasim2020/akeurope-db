const Project = require('../models/Project');
const { visibleLogs } = require('../modules/logAction');

exports.projects = async (req, res) => {
    let projects = await Project.find({
        slug: { $in: req.user.projects },
    }).lean();

    res.render('projects', {
        layout: 'dashboard',
        data: {
            userId: req.session.user._id,
            userName: req.session.user.name,
            userRole:
                req.session.user.role.charAt(0).toUpperCase() +
                req.session.user.role.slice(1),
            projects: projects,
            layout: req.session.layout,
            activeMenu: 'allProjects',
            role: req.userPermissions,
            logs: await visibleLogs(req, res),
            sidebarCollapsed: req.session.sidebarCollapsed,
        },
    });
};

exports.getData = async (req, res) => {
    let projects = await Project.find({
        slug: { $in: req.user.projects },
    }).lean();

    res.render('partials/showProjects', {
        layout: false,
        data: {
            projects: projects,
            layout: req.session.layout,
        },
    });
};
