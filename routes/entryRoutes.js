const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const entryController = require('../controllers/entryController');

router.get('/entry/:entryId/project/:slug', authenticate, authorize("viewEntry"), allProjects, entryController.entry);
router.get('/getEntryData/:slug', authenticate, authorize("viewEntry"), entryController.getData);
router.get('/getEntryModal/:slug/:id', authenticate, authorize("editEntry"), allProjects, entryController.editModal);
router.post('/project/entry/:slug', authenticate, authorize("createEntry"), entryController.createEntry);
router.post('/project/entry/update/:slug/:id', authenticate, authorize("updateEntry"), entryController.updateEntry);
router.post('/project/entry/delete/:slug', authenticate, authorize("deleteEntry"), entryController.deleteEntry);

router.get('/getSingleEntryData/:entryId/project/:slug', authenticate, authorize("editEntry"), entryController.getSingleEntryData);
router.get('/getSingleEntryLogs/:entryId/project/:slug', authenticate, authorize("editEntry"), entryController.getSingleEntryLogs);

router.get('/getPaginatedEntriesForDraftOrder/:slug/:customerId', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForDraftOrder);
router.get('/getPaginatedEntriesForOrderPage/:slug/:customerId', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForOrderPage);
// router.get('/getPaginatedEntriesForPendingOrder/:orderId/:slug', authenticate, authorize('viewEntry'), entryController.getPaginatedEntriesForPendingOrder);

module.exports = router;