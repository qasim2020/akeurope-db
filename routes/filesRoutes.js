const express = require('express');
const router = express.Router();
const { uploadFile, uploadVideo } = require('../modules/uploadFile');
const { authenticate, authorize } = require('../modules/auth');
const fileController = require('../controllers/fileController');

router.get('/filesByEntityRender/:entityId', authenticate, authorize('viewFiles'), fileController.renderEntityFiles);
router.get('/file/:fileId', authenticate, authorize('viewFiles'), fileController.file);
router.post('/uploadFileToEntry', authenticate, authorize('uploadFiles'), uploadFile.single('file'), fileController.uploadFileToEntry);
router.post('/uploadVideoToEntry', authenticate, authorize('uploadFiles'), uploadVideo.single('file'), fileController.uploadVideoToEntry);
router.post('/uploadFileToOrder', authenticate, authorize('uploadFiles'), uploadFile.single('file'), fileController.uploadFileToOrder);
router.post('/fileUpdate/:fileId', authenticate, authorize('editFiles'), fileController.update);
router.post('/fileDelete/:fileId', authenticate, authorize('deleteFiles'), fileController.delete);

router.get('/getFileModal/:fileId', authenticate, authorize('editFiles'), fileController.getFileModal);

module.exports = router;
