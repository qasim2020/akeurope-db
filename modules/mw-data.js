const Project = require("../models/Project");

const oneProject = async (req, res, next) => {
    let oneProject = await Project.findOne({slug: req.params.slug}).lean();
    req.oneProject = oneProject;
    next();
};

const allProjects = async (req, res, next) => {
    let allProjects = await Project.find({slug: {$in: req.user?.projects}}).lean();
    req.allProjects = allProjects;
    next();
};

const authProject = async (req,res, next) => {
    if (req.userPermissions.includes(req.params.slug)) {
        next();
    } else {
        res.render('error',{
            heading: 'Unauthorized',
            error: 'You are not allowed to perform actions on this project'
        });
    }
}

module.exports = { allProjects, oneProject, authProject};