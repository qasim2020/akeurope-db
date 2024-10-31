// config/roles.js
const roles = {
    admin: [
        'inviteUsers', 
        'assignRoles', 
        'viewDashboard', 
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
        'createEntry', 
        'editEntry', 
        'updateEntry', 
        'deleteEntry'
    ],
    viewer: [
        'viewDashboard'
    ]
};

// Helper function to check if a role has a specific permission
function hasPermission(role, permission) {
    return roles[role]?.includes(permission);
}

module.exports = { roles, hasPermission };