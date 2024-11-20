const Project = require("../models/Project");
const { createDynamicModel } = require("../models/createDynamicModel");
const { generatePagination } = require("../modules/generatePagination");

const generateSearchQuery = function(req, project) {
    const search = req.query.search || '';
    const fieldFilters = {};

    project.fields.forEach(field => {
        if (req.query[field.name]) {
            fieldFilters[field.name] = req.query[field.name];
        }
    });

    const stringFields = project.fields.filter(field => /string|boolean|image|file|dropdown/i.test(field.type)).map(field => ({ [field.name]: new RegExp(search, 'i') }));
    const numberFields = project.fields.filter(field => field.type === 'number');
    const dateFields = project.fields.filter(field => field.type === 'date');

    let searchQuery = {};

    if (Object.keys(fieldFilters).length > 0) {
        Object.assign(searchQuery, fieldFilters);
    }

    if (search) {
        const searchConditions = [];

        if (stringFields.length > 0) {
            searchConditions.push({ $or: stringFields });
        }

        const searchAsNumber = parseFloat(search);
        if (!isNaN(searchAsNumber)) {
            searchConditions.push({
                $or: numberFields.map(field => ({ [field.name]: searchAsNumber }))
            });
        }

        const searchAsDate = new Date(search);
        if (!isNaN(searchAsDate.getTime())) {
            searchConditions.push({
                $or: dateFields.map(field => ({ [field.name]: searchAsDate }))
            });
        }

        if (searchConditions.length > 0) {
            searchQuery.$or = searchConditions;
        }
    }

    return { searchQuery, fieldFilters };
};

const projectEntries = async function(req, res) {
    const project = await Project.findOne({ slug: req.params.slug }).lean();
    if (!project) throw new Error(`Project "${req.params.slug}" not found`);

    const DynamicModel = await createDynamicModel(project.slug);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortBy = req.query.sortBy || '_id';
    const order = req.query.orderBy === 'desc' ? 1 : -1;
    const sortOptions = { [sortBy]: order };

    const { searchQuery, fieldFilters } = generateSearchQuery(req, project);

    const filtersQuery = new URLSearchParams(fieldFilters).toString();

    const entries = await DynamicModel.find(searchQuery)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalEntries = await DynamicModel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalEntries / limit);

    return {
        entries, 
        project, 
        pagination: {
            totalEntries,
            totalPages,
            currentPage: page,
            limit,
            startIndex: totalEntries == 0 ? 0 : skip + 1,
            endIndex: Math.min(skip + limit, totalEntries),
            pagesArray: generatePagination(totalPages, page),
            sort: { 
              sortBy, 
              order: req.query.orderBy == undefined ? "asc" : req.query.orderBy
            },
            search: req.query.search,
            filtersQuery,
            fieldFilters: fieldFilters == {} ? undefined : fieldFilters,
            showSearchBar: req.query.showSearchBar,
            showFilters: req.query.showFilters
        }
    }
};

module.exports = { projectEntries };
