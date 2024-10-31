const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require('../modules/allProjects');

router.get('/dashboard', authenticate, authorize('viewDashboard'), allProjects, (req, res) => res.render('dashboard', {
    layout: "dashboard", 
    data: {
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
        activeMenu: "dashboard",
        projects: req.allProjects
    }
}));

module.exports = router;