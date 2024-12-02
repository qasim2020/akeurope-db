const { visibleLogs, activtyByEntityType } = require('../modules/logAction');

exports.showDashboard = async (req, res) => { 
    res.render('dashboard', { layout: "dashboard", 
        data: {
            userName: req.session.user.name,
            userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
            activeMenu: "dashboard",
            projects: req.allProjects,
            logs: await visibleLogs(req,res),
            activity: await activtyByEntityType(req,res),
            sidebarCollapsed: req.session.sidebarCollapsed ? req.session.sidebarCollapsed : false
        }
    });
};

exports.getActivityData = async(req,res) => {
    res.render('partials/dashboardActivity', {
        layout: false,
        data: {
            activity: await activtyByEntityType(req,res) 
        }
    })
}

exports.renderPartial = async(req,res) => {
    try {
        const { partialName, data } = req.body; 

        const validPartials = ['uploadExcelThree'];
        if (!validPartials.includes(partialName)) {
            return res.status(400).send('Invalid partial name');
        }

        res.render(`partials/${partialName}`, { layout: false, data }, (err, html) => {
            if (err) {
                return res.status(500).send('Error rendering partial');
            }
            res.send(html);
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal server error');
    }
}

exports.updateLayout = async(req,res) => {
    const newLayout = req.body.layout;
    req.session.layout = newLayout;
    res.json({ message: 'Layout updated', layout: newLayout });
}

exports.toggleSideBar = async(req,res) => {
    req.session.sidebarCollapsed = req.body.sidebarCollapsed;
    res.json({message: 'Sidebar toggled', sidebar: req.body.sidebarCollapsed });
}