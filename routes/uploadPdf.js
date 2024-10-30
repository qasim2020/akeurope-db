const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const upload = multer();  // Using multer to handle form-data files

require('dotenv').config();

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
    try {
        const file = req.file;

        // Check if file is provided and is a PDF
        if (!file || file.mimetype !== 'application/pdf') {
            return res.status(400).json({ message: 'Only PDF files are allowed.' });
        }

        // Convert the file to Base64 format for Cloudinary upload
        const pdfBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        // Extract the filename without extension to use as a unique identifier in context metadata
        const fileName = file.originalname.split('.')[0];

        // Search for an existing PDF with the same original filename in context
        const existingFile = await cloudinary.search
            .expression(`folder:${req.body.folderName} AND context.original_filename:${fileName}`)
            .execute();

        // If a duplicate exists, delete it
        if (existingFile.resources.length > 0) {
            const publicId = existingFile.resources[0].public_id;
            // await cloudinary.uploader.destroy(publicId);  // Delete the existing file
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })  // Specify resource_type if file is raw
                .then(result => console.log("Delete result:", result))
                .catch(error => console.error("Error deleting file:", error));
        }

        // Upload the new PDF with context metadata containing the original filename
        const uploadResult = await cloudinary.uploader.upload(pdfBase64, {
            folder: req.body.folderName,
            resource_type: 'raw',  // Set the resource type to 'raw' for non-image files like PDFs
            context: { original_filename: fileName }  // Store the original filename in context metadata
        });

        // Send the new Cloudinary URL back to the frontend
        res.json({ cloudinaryUrl: uploadResult.secure_url });

    } catch (error) {
        console.error('Error uploading PDF to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload PDF' });
    }
});


module.exports = router;