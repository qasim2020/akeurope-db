const fs = require('fs').promises;
const path = require('path');

const truncateFileName = (fileName) => {
    const ext = path.extname(fileName); // Extract file extension
    const baseName = path.basename(fileName, ext); // Get base name without extension
    if (baseName.length > 7) {
        return `${baseName.slice(0, 4)}...${ext}`; // Truncate and add ellipsis
    }
    return fileName; // Return as-is if not too long
};

const getUnlinkedFiles = async function () {
    try {
        const directories = [path.resolve(__dirname, '../../uploads'), path.resolve(__dirname, '../../payments')];

        const allFiles = [];
        for (const directory of directories) {
            try {
                const files = await fs.readdir(directory);

                // Get file details (name and size)
                for (const file of files) {
                    const filePath = path.join(directory, file);
                    try {
                        const stats = await fs.stat(filePath);
                        if (stats.isFile()) {
                            allFiles.push({
                                name: truncateFileName(file),
                                size: stats.size / 1000,
                                originalName: file,
                            });
                        }
                    } catch (statError) {
                        console.warn(`Error reading file stats: ${filePath}`, statError);
                    }
                }
            } catch (error) {
                console.warn(`Error reading directory: ${directory}`, error);
            }
        }

        return allFiles;
    } catch (error) {
        console.error('Error reading directories:', error);
        return [];
    }
};

const getUnlinkedFile = async (req, res) => {
    const { fileName } = req.params;
    if (!fileName) {
        return res.status(400).json({ error: 'fileName is required' });
    }

    const directories = [path.resolve(__dirname, '../../uploads'), path.resolve(__dirname, '../../payments')];

    let foundFile = null;

    for (const directory of directories) {
        try {
            const files = await fs.readdir(directory);

            if (files.some((file) => file === fileName)) {
                const filePath = path.join(directory, fileName);
                const stats = await fs.stat(filePath);
                foundFile = {
                    name: fileName,
                    size: stats.size,
                    directory,
                    path: filePath,
                };
                break;
            }
        } catch (dirError) {
            console.warn(`Error reading directory: ${directory}`, dirError);
        }
    }

    if (!foundFile) {
        return res.status(404).json({ error: 'File not found' });
    }

    return foundFile;
};

module.exports = { getUnlinkedFiles, getUnlinkedFile };
