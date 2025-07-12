const Project = require('../models/Project');
const { createDynamicModel } = require('../models/createDynamicModel');
const { countPaidEntriesInProject } = require('../modules/projectEntries');
const { visibleLogs } = require('../modules/logAction');
const Country = require('../models/Country');

exports.projects = async (req, res) => {
    let projects = await Project.find({
        slug: { $in: req.user.projects },
    }).lean();

    for (const project of projects) {
        const model = await createDynamicModel(project.slug);
        project.total = await model.countDocuments();
        project.paid = await countPaidEntriesInProject(project.slug);
    }

    const countries = await Country.find({}).lean();

    res.render('projects', {
        layout: 'dashboard',
        data: {
            userId: req.session.user._id,
            userName: req.session.user.name,
            userRole:
            req.session.user.role.charAt(0).toUpperCase() +
            req.session.user.role.slice(1),
            projects: projects,
            countries: countries,
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
