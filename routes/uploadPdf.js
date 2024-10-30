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
    
        // Convert the PDF file to Base64 format for Cloudinary upload
        const pdfBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
        // Sanitize the filename: remove special characters, spaces, and extra underscores
        const sanitizedFileName = file.originalname
            .split('.')[0]                    // Remove the file extension
            .replace(/[^a-zA-Z0-9]/g, '-')     // Replace non-alphanumeric characters with hyphens
            .replace(/-+/g, '-')               // Replace multiple hyphens with a single hyphen
            .toLowerCase();                    // Convert to lowercase for consistency
    
        // Create a custom public_id combining entryId and sanitized filename
        const customPublicId = `${req.body.entryId}-${sanitizedFileName}`;
    
        // Attempt to delete any existing file with the same public_id
        await cloudinary.uploader.destroy(customPublicId, { resource_type: 'raw' })
            .then(result => console.log("Deleted existing file:", result))
            .catch(error => console.error("Error deleting existing file (if any):", error));
    
        // Upload the new PDF with the specified public_id
        const uploadResult = await cloudinary.uploader.upload(pdfBase64, {
            folder: req.body.folderName,
            public_id: customPublicId,
            resource_type: 'raw',  
        });
    
        // Send the new Cloudinary URL back to the frontend
        res.json({ cloudinaryUrl: uploadResult.secure_url });
    
    } catch (error) {
        console.error('Error uploading PDF to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload PDF' });
    }
});


module.exports = router;