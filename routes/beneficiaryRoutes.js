const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const beneficiaryController = require('../controllers/beneficiaryController');

router.get("/beneficiaries", authenticate, authorize("viewBeneficiaries"), allProjects, beneficiaryController.beneficiaries);
router.get('/getBeneficiariesData', authenticate, authorize("viewBeneficiaries"), allProjects, beneficiaryController.getBeneficiariesData);
router.get('/getEditBeneficiaryModal/:beneficiaryId', authenticate, authorize("editBeneficiaries"), allProjects, beneficiaryController.editModal);

router.post("/beneficiary/update/:beneficiaryId", authenticate, authorize("editBeneficiaries"), beneficiaryController.updateBeneficiary);
router.get('/get-linked-children/:beneficiaryId', authenticate, authorize('viewBeneficiaries'), beneficiaryController.linkedProfiles);

router.get("/beneficiary/:beneficiaryId", authenticate, authorize("viewBeneficiaries"), allProjects, beneficiaryController.beneficiary);
router.get("/getBeneficiaryData/:beneficiaryId", authenticate, authorize("viewBeneficiaries"), beneficiaryController.getBeneficiaryData);
router.get("/getBeneficiaryLogs/:beneficiaryId", authenticate, authorize("viewBeneficiaries"), beneficiaryController.getLogs);

router.post('/generate-invite-link/:beneficiaryId', authenticate, authorize("editBeneficiaries"), allProjects, beneficiaryController.generateInviteLink);

module.exports = router;