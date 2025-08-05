const parseDateQuery = function (queryValue) {
    try {
        const parsedQuery = JSON.parse(queryValue);

        if (parsedQuery) {
            let dateOperator = null;
            let dateValue = null;

            for (let operator of ['$gt', '$gte', '$lt', '$lte', '$eq']) {
                if (parsedQuery[operator]) {
                    dateOperator = operator;
                    dateValue = parsedQuery[operator];
                    break;
                }
            }

            if (dateOperator && dateValue) {
                const parsedDate = new Date(dateValue);

                if (!isNaN(parsedDate)) {
                    return { [dateOperator]: parsedDate };
                } else {
                    console.error('Invalid date in query: ', dateValue);
                    return null;
                }
            }
        }
    } catch (error) {
        console.error('Error parsing query:', error);
        return null;
    }

    return null;
};

const generateSearchQuery = function (req, project) {
    const search = req.query.search || '';
    const fieldFilters = {};

    project.fields.forEach((field) => {
        if (req.query[field.name]) {
            let queryValue = req.query[field.name];

            if (isDateString(queryValue)) {
                const query = parseDateQuery(queryValue);
                if (query) {
                    fieldFilters[field.name] = query;
                } else {
                    fieldFilters[field.name] = queryValue;
                }
            } else {
                fieldFilters[field.name] = queryValue;
            }
        }
    });

    function isDateString(value) {
        const parsedDate = Date.parse(value);
        return !isNaN(parsedDate);
    }

    const stringFields = project.fields
        .filter((field) => /string|textarea|boolean|image|file|dropdown/i.test(field.type))
        .map((field) => ({ [field.name]: new RegExp(search, 'i') }));
    const numberFields = project.fields.filter((field) => field.type === 'number');
    const dateFields = project.fields.filter((field) => field.type === 'date');

    let searchQuery = {};

    if (Object.keys(fieldFilters).length > 0) {
        Object.assign(searchQuery, fieldFilters);
    }

    if (req.query.hideCustomers) {
        const hiddenCustomerIds = req.query.hideCustomers
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);

        if (hiddenCustomerIds.length > 0) {
            console.log('🔒 Hiding customers with IDs:', hiddenCustomerIds);
            
            const { ObjectId } = require('mongoose').Types;
            const objectIds = hiddenCustomerIds.map(id => {
                try {
                    return new ObjectId(id);
                } catch (error) {
                    console.warn(`Invalid ObjectId: ${id}`);
                    return id; 
                }
            });

            searchQuery._id = { $nin: objectIds };
        }
    }

    if (search) {
        const searchConditions = [];

        if (stringFields.length > 0) {
            searchConditions.push({ $or: stringFields });
        }

        const searchAsNumber = parseFloat(search);
        if (!isNaN(searchAsNumber)) {
            searchConditions.push({
                $or: numberFields.map((field) => ({
                    [field.name]: searchAsNumber,
                })),
            });
        }

        const searchAsDate = new Date(search);
        if (!isNaN(searchAsDate.getTime())) {
            searchConditions.push({
                $or: dateFields.map((field) => ({
                    [field.name]: searchAsDate,
                })),
            });
        }

        if (searchConditions.length > 0) {
            if (searchQuery.$or) {
                searchQuery = {
                    $and: [
                        { $or: searchConditions },
                        searchQuery
                    ]
                };
            } else {
                searchQuery.$or = searchConditions;
            }
        }
    }

    return { searchQuery, fieldFilters };
};

const generateSearchQueryFromSchema = (req, schema) => {
    const search = req.query.search || '';
    const fieldFilters = {};
    const paths = schema.paths;

    const stringFields = [];
    const numberFields = [];
    const dateFields = [];

    for (const key in paths) {
        if (['_id', '__v'].includes(key)) continue;

        const type = paths[key].instance;

        if (req.query[key]) {
            const value = req.query[key];

            if (type === 'Date' && isDateString(value)) {
                const dateQuery = parseDateQuery(value);
                fieldFilters[key] = dateQuery || new Date(value);
            } else if (type === 'Number') {
                const num = parseFloat(value);
                if (!isNaN(num)) fieldFilters[key] = num;
            } else if (type === 'Boolean') {
                fieldFilters[key] = value === 'true';
            } else {
                fieldFilters[key] = value;
            }
        }

        if (['String'].includes(type)) {
            stringFields.push({ [key]: new RegExp(search, 'i') });
        } else if (type === 'Number') {
            numberFields.push(key);
        } else if (type === 'Date') {
            dateFields.push(key);
        }
    }

    let searchQuery = {};

    if (Object.keys(fieldFilters).length > 0) {
        Object.assign(searchQuery, fieldFilters);
    }

    if (search) {
        const conditions = [];

        if (stringFields.length > 0) {
            conditions.push({ $or: stringFields });
        }

        const searchAsNumber = parseFloat(search);
        if (!isNaN(searchAsNumber)) {
            conditions.push({
                $or: numberFields.map((key) => ({
                    [key]: searchAsNumber,
                })),
            });
        }

        const searchAsDate = new Date(search);
        if (!isNaN(searchAsDate.getTime())) {
            conditions.push({
                $or: dateFields.map((key) => ({
                    [key]: searchAsDate,
                })),
            });
        }

        if (conditions.length > 0) {
            searchQuery.$or = conditions;
        }
    }

    return { searchQuery, fieldFilters };
};

module.exports = { generateSearchQuery, generateSearchQueryFromSchema };