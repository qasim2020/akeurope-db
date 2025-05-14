const { visibleLogs, userLogs } = require('../modules/logAction');
const User = require('../models/User');
const { projectEntries } = require('../modules/projectEntries');
const { URL } = require('url');

const getUserEntries = async (userId) => {
    const user = await User.findById(userId).lean();
    let allEntries = [];
    if (!user.entries) {
        return null;
    }

    for (const userProject of user.entries) {
        const slug = userProject.slug;
        const fullUrl = new URL(`http://dummy.com?${userProject.query}`);
        const req = {
            query: Object.fromEntries(fullUrl.searchParams.entries()),
            params: { slug },
        };

        const { entries, project, pagination } = await projectEntries(req);

        allEntries.push({
            heading: userProject.heading,
            headingSlug: userProject.headingSlug,
            project,
            entries,
            pagination,
            userId: user._id,
            note: userProject.note
        });
    }

    return allEntries;
};

const dataForUserPage = async (req, res, activeMenu, userId) => {
    return {
        layout: req.session.layout,
        userEmail: req.session.user.email,
        userId: req.session.user._id,
        userName: req.session.user.name,
        userRole: req.session.user.role.charAt(0).toUpperCase() + req.session.user.role.slice(1),
        activeMenu,
        userEntries: await getUserEntries(userId),
        projects: req.allProjects,
        role: req.userPermissions,
        logs: await visibleLogs(req, res),
        userLogs: await userLogs(req, userId),
        user: await User.findById(userId).lean(),
        sidebarCollapsed: req.session.sidebarCollapsed,
    };
};

module.exports = { dataForUserPage, getUserEntries };
