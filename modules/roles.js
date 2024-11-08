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
        'viewCustomers'
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
        'uploadImage'
    ],
    viewer: [
        'viewDashboard',
        'viewProject',
        'viewEntry'
    ]
};

function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };