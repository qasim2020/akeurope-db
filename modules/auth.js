const { roles, hasPermission } = require('../modules/roles');

const authenticate = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        return next();
    }
    return res.status(404).render('error', {
        heading: 'Unauthorized',
        error: 'User is not logged in.',
    });
};

const authorize = (permission) => {
    return async (req, res, next) => {
        try {
            const userRole = req.user?.role;
            const userId = req.user?._id;
            const userProjects = req.user?.projects || [];

            if (!userRole) {
                return res.status(401).send('Unauthorized: No role assigned');
            }

            if (permission === 'viewUsers' && roles[userRole].includes('viewSelf')) {
                const testOne = req.user?._id.toString();
                const testTwo = req.params.userId.toString();
                const test = testOne === testTwo;
                if (!test) {
                    return res.status(401).render('error', {
                        heading: 'Unauthorized',
                        error: `Insufficient permissions to view another Admin`,
                    });
                }
            } else {
                const hasPermissionResult = await hasPermission(userRole, userId, permission);
                if (!hasPermissionResult) {
                    return res.status(401).render('error', {
                        heading: 'Unauthorized',
                        error: `Unauthorized: ${userRole} can't ${permission}`,
                    });
                }
            }

            req.userPermissions = [...(roles[userRole] || []), ...(userProjects || [])];

            next();
        } catch (error) {
            console.error('Error in authorization middleware:', error);
            res.status(500).send('Error in authorization middleware');
        }
    };
};

module.exports = { authenticate, authorize };
