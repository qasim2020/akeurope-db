const User = require('../models/User');

const roles = {
    admin: [
        'inviteUsers',
        'assignRoles',
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'viewUsers',
        'createUsers',
        'editUsers',
        'updateUsers',
        'deleteUsers',
        'viewOrders',
        'createOrders',
        'editOrders',
        'deleteOrders',
        'viewCustomers',
        'createCustomers',
        'editCustomers',
        'updateCustomers',
        'deleteCustomers',
        'viewFiles',
        'uploadFiles',
        'editFiles',
        'changeFilesAccess',
        'deleteFiles',
        'updateFiles',
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
        'editNotifications',
        'viewInvoices',
        'viewLogs',
        'viewNotifications',
        'viewSelf',
        'chat',
        'viewBeneficiaries',
        'editBeneficiaries',
    ],
    editor: [
        'viewSelf',
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'viewBeneficiaries',
        'createEntry',
        'editEntry',
        'updateEntry',
        'deleteEntry',
        'viewFiles',
        'uploadFiles',
        'editFiles',
        'deleteFiles',
        'updateFiles',
        'uploadPdf',
        'viewOrderOutline',
        'uploadImage',
        'chat',
        'changeFilesAccess'
    ],
    viewer: ['viewEntry'],
};

async function getDynamicPermissions(role, userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error ('user not found while fetching role for user');
    return user.projects || [];
}

async function hasPermission(role, userId, permission) {
    const staticPermissions = roles[role] || [];
    const dynamicPermissions = await getDynamicPermissions(role, userId);

    const allPermissions = [...staticPermissions, ...dynamicPermissions];

    return allPermissions.includes(permission);
}

module.exports = { roles, hasPermission, getDynamicPermissions };
