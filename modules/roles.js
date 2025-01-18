const User = require('../models/User');

const roles = {
    admin: [
        'inviteUsers',
        'assignRoles',
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'viewUsers',
        'viewOrders',
        'createUsers',
        'editUsers',
        'updateUsers',
        'deleteUsers',
        'createProject',
        'editProject',
        'updateProject',
        'deleteProject',
        'createEntry',
        'editEntry',
        'updateEntry',
        'deleteEntry',
        'uploadPdf',
        'uploadImage',
        'uploadFile',
        'viewFile',
        'viewCustomers',
        'createCustomers',
        'editCustomers',
        'updateCustomers',
        'deleteCustomers',
        'editNotifications',
        'createOrders',
        'editOrders',
        'deleteOrders',
        'viewInvoices',
        'viewLogs',
        'viewNotifications',
        'editNotifications',
    ],
    editor: [
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'createEntry',
        'editEntry',
        'updateEntry',
        'deleteEntry',
        'uploadPdf',
        'uploadImage',
        'viewSelf',
    ],
    viewer: ['viewEntry'],
};

async function getDynamicPermissions(role, userId) {
    const user = await User.findById(userId).lean();
    return user?.projects || [];
}

async function hasPermission(role, userId, permission) {
    const staticPermissions = roles[role] || [];
    const dynamicPermissions = await getDynamicPermissions(role, userId);

    const allPermissions = [...staticPermissions, ...dynamicPermissions];

    return allPermissions.includes(permission);
}

module.exports = { roles, hasPermission, getDynamicPermissions };
