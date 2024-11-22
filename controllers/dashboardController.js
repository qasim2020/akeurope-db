const { visibleLogs } = require('./logAction');

exports.showDashboard = async (req, res) => { 
    res.render('dashboard', { layout: "dashboard", 
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "dashboard",
            projects: req.allProjects,
            logs: await visibleLogs(req,res)
        }
    });
};