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
        'createPayments',
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
        'editNotifications',
        'createPayments',
    ],
    viewer: [
        'viewDashboard',
        'viewProject',
        'viewEntry',
        'editNotifications'
    ]
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };