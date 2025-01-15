const File = require('../models/File');
const { getUnlinkedFiles, getUnlinkedFile } = require('../modules/fileUtils');
const Order = require('../models/Order');
const fs = require('fs').promises;
const path = require('path');

exports.upload = async (req, res) => {
    try {
        const file = new File({
            entityType: req.params.entityType,
            entityId: req.params.entityId,
            name: req.file.originalname,
            path: req.file.path,
            mimeType: req.file.mimetype,
        });
        await file.save();
        res.status(200).send('File uploaded successfully!');
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.files = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'createdAt';
        const files = await File.find().sort({
            [sortOption]: -1,
        });
        res.status(200).send(files);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.filesByEntity = async (req, res) => {
    try {
        const sortOption = req.query.sort || 'createdAt';
        const files = await File.find({
            entityId: req.params.entityId,
        }).sort({
            [sortOption]: -1,
        });
        res.status(200).send(files);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.file = async (req, res) => {
    try {
        const file = await File.findById(req.params.fileId).lean();
        res.status(200).send(file);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.toString());
    }
};

exports.update = async (req, res) => {
    try {
        const { fileId, entityId } = req.params;
        const { newName, newEntityId, newEntityType } = req.body;
        const file = await File.findOne({ fileId, entityId });
        if (!file) return res.status(404).send('File not found');

        const oldPath = file.path;
        const newPath = oldPath.replace(file.name, newName);

        const fs = require('fs/promises');
        await fs.rename(oldPath, newPath);

        file.name = newName;
        file.path = newPath;
        file.entityId = newEntityId;
        file.entityType = newEntityType;
        await file.save();
        res.status(200).send('File renamed successfully!');
    } catch (error) {
        res.status(500).send('Error renaming file');
    }
};

exports.delete = async (req, res) => {
    try {
        const { fileId, entityId } = req.params;
        const file = await File.findOneAndDelete({ fileId, entityId });
        if (!file) return res.status(404).send('File not found');

        const fs = require('fs/promises');
        await fs.unlink(file.path);

        res.status(200).send('File deleted successfully!');
    } catch (error) {
        res.status(500).send('Error deleting file');
    }
};

exports.getFileUploadModal = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const linkedFiles = await File.find({ entityId }).lean();
        const unlinkedFiles = await getUnlinkedFiles();
        let modal = {};
        if (entityType == 'order') {
            const order = await Order.findById(entityId).lean();
            modal.header = `Attach Documents to Invoice-${order.orderNo}`;
        }
        res.render('partials/editFileUploadModal', {
            layout: false,
            data: {
                entityId: req.params.entityId,
                entityType: req.params.entityType,
                modal,
                linkedFiles,
                unlinkedFiles,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occured while fetching file modal',
            details: error.message,
        });
    }
};

exports.unlinkedFile = async (req, res) => {
    try {
        const foundFile = await getUnlinkedFile(req, res);
        return res.render('partials/components/showUnlinkedFile', {
            layout: false,
            data: {
                file: foundFile,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error occurred while fetching the file',
            details: error.message,
        });
    }
};

exports.viewUnlinkedFile = async (req, res) => {
    try {
        const { fileName } = req.params;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const directories = [
            path.resolve(__dirname, '../../uploads'),
            path.resolve(__dirname, '../../payments'),
        ];

        let filePath = null;

        for (const directory of directories) {
            const files = await fs.readdir(directory);
            if (files.includes(fileName)) {
                filePath = path.join(directory, fileName);
                break;
            }
        }

        if (!filePath) {
            return res.status(404).json({ error: 'File not found' });
        }

        const fileExtension = path.extname(fileName).toLowerCase();
        const supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];

        if (fileExtension === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            return res.sendFile(filePath);
        } else if (supportedImageTypes.includes(fileExtension)) {
            res.setHeader('Content-Type', `image/${fileExtension.slice(1)}`); // Remove dot from extension
            return res.sendFile(filePath);
        } else {
            return res.status(400).json({ error: 'Unsupported file type' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: 'Error occurred while fetching unlinked file',
            details: error.message,
        });
    }
};
