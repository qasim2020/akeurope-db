// config/roles.js
const roles = {
    admin: [
        'inviteUsers', 
        'assignRoles', 
        'viewDashboard', 
        'viewProject',
        'viewEntry',
        'createProject', 
        'editProject', 
        'updateProject', 
        'deleteProject', 
        'createEntry', 
        'editEntry', 
        'updateEntry', 
        'deleteEntry'
    ],
    editor: [
        'viewDashboard', 
        'viewProject',
        'viewEntry',
        'createEntry', 
        'editEntry', 
        'updateEntry', 
        'deleteEntry'
    ],
    viewer: [
        'viewDashboard',
        'viewProject',
        'viewEntry'
    ]
};

// Helper function to check if a role has a specific permission
function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };