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
        'viewCustomers',
        'createCustomers',
        'editCustomers',
        'updateCustomers',
        'deleteCustomers',
        'editNotifications',
        'createOrders',
    ],
    editor: [
        'viewDashboard', 
        'viewProject',
        'viewEntry',
        'viewOrders',
        'createEntry', 
        'editEntry', 
        'updateEntry', 
        'deleteEntry',
        'uploadPdf',
        'uploadImage',
        'editNotifications',
        'createOrders',
    ],
    viewer: [
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'viewOrders',
        'editNotifications'
    ]
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };