const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 
const { allProjects, oneProject, authProject } = require("../modules/mw-data");
const { authenticate, authorize } = require("../modules/auth");
const excelController = require('../controllers/excelController');

router.get("/uploadExcel/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, authProject, excelController.uploadExcel); 
router.get("/uploadExcel/step-1/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, authProject, excelController.stepOne);
router.get("/uploadExcel/step-2/:slug", authenticate, authorize("editEntry"), allProjects, oneProject, authProject, excelController.stepTwo);
router.get('/downloadExcelTemplate/:slug', authenticate, authorize("editEntry"), authProject, excelController.template);
router.post('/uploadExcel/:slug', authenticate, authorize("editEntry"), upload.single('excelFile'), authProject, excelController.upload);

module.exports = router;