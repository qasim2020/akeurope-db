const mongoose = require('mongoose');
const Project = require('./Project');

const createDynamicModel = async function(projectName) {
    try {
        // Fetch the project by name
        const project = await Project.findOne({ slug: projectName });
        if (!project) throw new Error(`Project with name "${projectName}" not found`);

        // Define schema fields based on project.fields
        const dynamicFields = {};

        project.fields.forEach(field => {
            let fieldType;

            switch (field.type) {
                case 'string':
                    fieldType = String;
                    break;
                case 'number':
                    fieldType = Number;
                    break;
                case 'boolean':
                    fieldType = Boolean;
                    break;
                case 'dropdown':
                    fieldType = String;
                    break;
                case 'date':
                    fieldType = Date;
                    break;
                case 'image':
                    fieldType = String; 
                    break;
                case 'file':
                    fieldType = String; 
                    break;
                default:
                    fieldType = String; 
            }

            dynamicFields[field.name] = { type: fieldType };
        });

        // Define a dynamic schema
        const dynamicSchema = new mongoose.Schema(dynamicFields);

        // Model name
        const modelName = project.name;

        // Check if the model already exists
        if (mongoose.models[modelName]) {
            // If it exists, we can recompile it with the new schema
            mongoose.deleteModel(modelName); // Remove existing model from Mongoose cache
        }

        // Create and return a new model
        const DynamicModel = mongoose.model(modelName, dynamicSchema, modelName.toLowerCase());
        return DynamicModel;
    } catch (error) {
        console.error('Error creating dynamic model:', error);
        throw error;
    }
};

module.exports = { createDynamicModel };
