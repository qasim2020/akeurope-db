const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/dashboard');

router.get('/dashboard', authenticate, authorize, (req, res) => res.render('dashboard', {
    layout: "dashboard", 
    name: req.session.user.name,
    role: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1)
}));

// router.get('/projects', (req,res) => res.render('projects', {layout: 'dashboard'}));
// router.get('/projects', authenticate, authorize, (req,res) => res.render('projects', {
    // layout: 'dashboard',
    // name: req.session.user.name,
    // role: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1)
// }))

module.exports = router;