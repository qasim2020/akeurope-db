const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");

router.get("/customers", authenticate, authorize("viewCustomers"), allProjects, async (req,res) => {
    res.render("customers",{
        layout: "dashboard",
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "customers",
            projects: req.allProjects
        }
    })
})

module.exports = router;