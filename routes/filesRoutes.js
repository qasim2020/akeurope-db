const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { authenticate, authorize } = require('../modules/auth');
const fileController = require('../controllers/fileController');

router.get(
    '/files',
    authenticate,
    authorize('uploadFile'),
    upload.single('pdf'),
    fileController.files,
);
router.get(
    '/filesByEntity/:entityId',
    authenticate,
    authorize('uploadFile'),
    fileController.filesByEntity,
);
router.get(
    '/file/:fileId',
    authenticate,
    authorize('uploadFile'),
    fileController.file,
);
router.get(
    '/unlinkedFile/:fileName',
    authenticate,
    authorize('uploadFile'),
    fileController.unlinkedFile,
);
router.get('/viewUnlinkedFile/:fileName',
    authenticate,
    authorize('viewFile'),
    fileController.viewUnlinkedFile,
),
router.post(
    '/fileUpload/:entityId/:entityType',
    authenticate,
    authorize('uploadFile'),
    upload.single('pdf'),
    fileController.upload,
);
router.post(
    '/fileUpdate/:entityId/:fileId',
    authenticate,
    authorize('uploadFile'),
    fileController.update,
);
router.post(
    '/fileDelete/:entityId/:fileId',
    authenticate,
    authorize('uploadFile'),
    fileController.delete,
);
router.get(
    '/getFileUploadModal/:entityId/:entityType',
    authenticate,
    authorize('editOrders'),
    fileController.getFileUploadModal,
);

module.exports = router;
