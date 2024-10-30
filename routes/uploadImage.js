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

router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        const imageFile = req.file;
    
        // Check if file is provided and is an image
        if (!imageFile || !imageFile.mimetype.startsWith('image/')) {
            return res.status(400).json({ message: 'Only image files are allowed.' });
        }
    
        // Convert the image file to Base64 format for Cloudinary upload
        const imageBase64 = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;
    
        // Sanitize the filename: remove special characters, spaces, and extra underscores
        const sanitizedImageName = imageFile.originalname
            .split('.')[0]                    // Remove the file extension
            .replace(/[^a-zA-Z0-9]/g, '-')     // Replace non-alphanumeric characters with hyphens
            .replace(/-+/g, '-')               // Replace multiple hyphens with a single hyphen
            .toLowerCase();                    // Convert to lowercase for consistency
    
        // Create a custom public_id combining entryId and sanitized filename
        const customPublicId = `${req.body.entryId}-${sanitizedImageName}`;
    
        // Attempt to delete any existing image with the same public_id
        await cloudinary.uploader.destroy(customPublicId, { resource_type: 'image' })
            .then(result => console.log("Deleted existing image:", result))
            .catch(error => console.error("Error deleting existing image (if any):", error));

        // Upload the new image with the specified public_id
        const uploadResult = await cloudinary.uploader.upload(imageBase64, {
            folder: req.body.folderName,
            public_id: customPublicId,
            resource_type: 'image',  
        });
    
        // Send the new Cloudinary URL back to the frontend
        res.json({ cloudinaryUrl: uploadResult.secure_url });
    
    } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload image' });
    }
    
});

module.exports = router;