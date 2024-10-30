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
        // Convert the file to Base64 for upload
        const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
        // Extract the filename without extension to use as a unique identifier in context metadata
        const fileName = req.file.originalname.split('.')[0];
    
        // Search for an existing image with the same original filename in context
        const existingImage = await cloudinary.search
            .expression(`folder:${req.body.folderName} AND context.original_filename:${fileName}`)
            .execute();
    
        // If a duplicate exists, delete it
        if (existingImage.resources.length > 0) {
            const publicId = existingImage.resources[0].public_id;
            await cloudinary.uploader.destroy(publicId);  // Delete the existing image
        }
    
        // Upload the new image with context metadata containing the original filename
        const uploadResult = await cloudinary.uploader.upload(imageBase64, {
            folder: req.body.folderName, 
            resource_type: "image",
            context: { original_filename: fileName }  // Store the original filename in context metadata
        });
    
        // Send the new Cloudinary URL back to the frontend
        res.json({ cloudinaryUrl: uploadResult.secure_url });
    
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload image' });
    }
    
});

module.exports = router;