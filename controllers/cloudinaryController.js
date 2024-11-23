const cloudinary = require('cloudinary').v2;

require('dotenv').config();

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadImage = async(req,res) => {
    try {
        const imageFile = req.file;
    
        if (!imageFile || !imageFile.mimetype.startsWith('image/')) {
            return res.status(400).json({ message: 'Only image files are allowed.' });
        }
    
        const imageBase64 = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;
    
        const sanitizedImageName = imageFile.originalname
            .split('.')[0]                  
            .replace(/[^a-zA-Z0-9]/g, '-')  
            .replace(/-+/g, '-')            
            .toLowerCase();                 
    
        const customPublicId = `${req.body.entryId}-${sanitizedImageName}`;
    
        await cloudinary.uploader.destroy(customPublicId, { resource_type: 'image' })
            .then(result => console.log("Deleted existing image:", result))
            .catch(error => console.error("Error deleting existing image (if any):", error));

        const uploadResult = await cloudinary.uploader.upload(imageBase64, {
            folder: req.body.folderName,
            public_id: customPublicId,
            resource_type: 'image',  
        });
    
        res.json({ cloudinaryUrl: uploadResult.secure_url });
    
    } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload image' });
    }
}

exports.uploadPdf = async(req,res) => {
    try {
        const file = req.file;
    
        if (!file || file.mimetype !== 'application/pdf') {
            return res.status(400).json({ message: 'Only PDF files are allowed.' });
        }
    
        const pdfBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
        const sanitizedFileName = file.originalname
            .replace(/[^a-zA-Z0-9.]/g, '-')  
            .replace(/-+/g, '-')              
            .toLowerCase();                   
    
        const customPublicId = `${req.body.entryId}-${sanitizedFileName}`;
    
        await cloudinary.uploader.destroy(customPublicId, { resource_type: 'raw' })
            .then(result => console.log("Deleted existing file:", result))
            .catch(error => console.error("Error deleting existing file (if any):", error));
    
        const uploadResult = await cloudinary.uploader.upload(pdfBase64, {
            folder: req.body.folderName,
            public_id: customPublicId,
            resource_type: 'raw',  
        });
    
        res.json({ cloudinaryUrl: uploadResult.secure_url });
    
    } catch (error) {
        console.error('Error uploading PDF to Cloudinary:', error);
        res.status(500).json({ message: 'Failed to upload PDF' });
    }
}