const mongoose = require('mongoose');
const Project = require('./Project');

const createDynamicModel = async function (slug) {
    try {
        const project = await Project.findOne({ slug: slug });
        if (!project) throw new Error(`Project with slug: "${slug}" not found`);

        const dynamicFields = {};

        project.fields.forEach(field => {
            let fieldType;
            let unique = field.primary ? true : false;

            switch (field.type) {
                case 'string':
                    fieldType = String;
                    break;
                case 'number':
                    fieldType = Number;
                    break;
                case 'boolean':
                    fieldType = String;
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

            dynamicFields[field.name] = { type: fieldType, unique: unique };
        });

        const dynamicSchema = new mongoose.Schema(dynamicFields);
        const modelName = project.slug;

        const forms = await mongoose.createConnection(process.env.MONGO_URI_FORMS, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }).asPromise();

        if (mongoose.models[modelName]) {
            mongoose.deleteModel(modelName);
        }

        if (forms.models[modelName]) {
            delete forms.models[modelName];
        }

        let DynamicModel;
        if (project.slug === 'egypt-family') {
            DynamicModel = forms.model(modelName, dynamicSchema, 'familyarabics');
        } else {
            DynamicModel = mongoose.model(modelName, dynamicSchema, modelName.toLowerCase());
        }
        return DynamicModel;
    } catch (error) {
        console.error('Error creating dynamic model:', error);
        throw error;
    }
};

module.exports = { createDynamicModel };
