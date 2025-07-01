const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects, authProject } = require('../modules/mw-data');
const entryController = require('../controllers/entryController');

router.get(
    '/entry/:entryId/project/:slug',
    authenticate,
    authorize('viewEntry'),
    authProject,
    allProjects,
    entryController.entry,
);
router.get(
    '/entryPrint/:entryId/project/:slug',
    authenticate,
    authorize('viewEntry'),
    authProject,
    allProjects,
    entryController.entryPrint,
);
router.get('/getEntryData/:slug', authenticate, authorize('viewEntry'), authProject, entryController.getData);
router.get('/getEntryModal/:slug/:id', authenticate, authorize('editEntry'), allProjects, authProject, entryController.editModal);
router.post('/project/entry/:slug', authenticate, authorize('createEntry'), authProject, entryController.createEntry);
router.post('/project/entry/update/:slug/:id', authenticate, authorize('updateEntry'), authProject, entryController.updateEntry);
router.post('/project/entry/delete/:slug', authenticate, authorize('deleteEntry'), authProject, entryController.deleteEntry);

router.get(
    '/getSingleEntryData/:entryId/project/:slug',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getSingleEntryData,
);
router.get(
    '/getSingleEntryLogs/:entryId/project/:slug',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getSingleEntryLogs,
);
router.get(
    '/getSingleEntryPayments/:entryId/project/:slug',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getSingleEntryPayments,
);
router.get(
    '/getPaginatedEntriesForDraftOrder/:slug/:customerId',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getPaginatedEntriesForDraftOrder,
);
router.get(
    '/getPaginatedEntriesForOrderPage/:slug/:customerId',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getPaginatedEntriesForOrderPage,
);
router.get(
    '/getPaginatedEntriesForModal/:slug/:customerId',
    authenticate,
    authorize('viewEntry'),
    authProject,
    entryController.getPaginatedEntriesForModal,
);

router.get('/searchEntry/:slug', authenticate, authorize('viewEntry'), entryController.searchEntry);

router.get('/getSendUpdateModal-entry/:entryId/:slug', authenticate, authorize('sendEntryUpdates'), entryController.getSendUpdateModal);
router.post('/sendEntryUpdateOnEmail/:entryId/:slug', authenticate, authorize('sendEntryUpdates'), entryController.sendEntryUpdateOnEmail);

module.exports = router;
