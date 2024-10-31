const Project = require("../models/Project");

const allProjects = async (req, res, next) => {
    let allProjects = await Project.find().lean();
    req.allProjects = allProjects;
    next();
};

module.exports = { allProjects };