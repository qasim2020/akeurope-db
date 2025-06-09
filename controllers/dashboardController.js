const User = require('../models/User');
const { visibleLogs, activtyByEntityType, userLogs } = require('../modules/logAction');
const { dataForUserPage } = require('../modules/users');
const { customerJourney } = require('../modules/customerJourney');

exports.showDashboard = async (req, res) => {
    try {
        if (req.user?.role === 'admin') {
            res.render('dashboard', {
                layout: 'dashboard',
                data: {
                    userId: req.session.user._id,
                    userId: req.session.user._id,
                    userName: req.session.user.name,
                    userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
                    role: req.userPermissions,
                    activeMenu: 'dashboard',
                    projects: req.allProjects,
                    journey: await customerJourney(req,res),
                    logs: await visibleLogs(req, res),
                    activity: await activtyByEntityType(req, res),
                    sidebarCollapsed: req.session.sidebarCollapsed ? req.session.sidebarCollapsed : false,
                },
            });
        }
        if (req.user?.role === 'editor') {
            const userId = req.user._id;
            res.render('user', {
                layout: 'dashboard',
                data: await dataForUserPage(req, res, 'dashboard', userId),
            });
        }
    } catch (error) {
        console.log(error);
        res.status(404).render('error', {
            heading: 'Server error',
            error,
        });
    }
};

exports.getActivityData = async (req, res) => {
    res.render('partials/dashboardActivity', {
        layout: false,
        data: {
            activity: await activtyByEntityType(req, res),
        },
    });
};

exports.getJourneyData = async (req, res) => {
    res.render('partials/customerJourney', {
        layout: false,
        data: {
            journey: await customerJourney(req,res),
        },
    });
};

exports.renderPartial = async (req, res) => {
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
};

exports.updateLayout = async (req, res) => {
    const newLayout = req.body.layout;
    req.session.layout = newLayout;
    res.json({ message: 'Layout updated', layout: newLayout });
};

exports.toggleSideBar = async (req, res) => {
    req.session.sidebarCollapsed = req.body.sidebarCollapsed;
    res.json({
        message: 'Sidebar toggled',
        sidebar: req.body.sidebarCollapsed,
    });
};

exports.notifications = async (req, res) => {
    try {
        res.render('partials/notificationsDropdown', {
            layout: false,
            data: {
                logs: await visibleLogs(req, res),
            },
        });
    } catch (error) {
        console.log(error);
        res.status(400).send(error.toString());
    }
};
