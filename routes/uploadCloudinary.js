const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();  
const {authenticate, authorize} = require("../modules/auth");
const cloudinaryController = require('../controllers/cloudinaryController');

router.post('/upload-image', authenticate, authorize("uploadImage"), upload.single('image'), cloudinaryController.uploadImage);
router.post('/upload-pdf', authenticate, authorize("uploadPdf"), upload.single('pdf'), cloudinaryController.uploadPdf);

module.exports = router;