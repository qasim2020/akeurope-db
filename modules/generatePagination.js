const generatePagination = function (totalPages, currentPage) {
    const pagination = [];
    const maxVisiblePages = 2;

    if (totalPages <= maxVisiblePages + 2) {
        for (let i = 1; i <= totalPages; i++) pagination.push(i);
    } else {
        pagination.push(1);

        if (currentPage > maxVisiblePages / 2 + 1) pagination.push('...');

        let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages - 1, currentPage + Math.floor(maxVisiblePages / 2));

        if (currentPage <= maxVisiblePages / 2) endPage = maxVisiblePages;
        if (currentPage > totalPages - maxVisiblePages / 2) startPage = totalPages - maxVisiblePages + 1;

        for (let i = startPage; i <= endPage; i++) pagination.push(i);

        if (currentPage < totalPages - maxVisiblePages / 2 - 1) pagination.push('...');
        if (pagination[pagination.length - 1] !== totalPages) pagination.push(totalPages);
    }

    return pagination;
};

const createPagination = ({ req, totalEntries, fieldFilters, filtersQuery, pageType }) => {
    const limit = parseInt(req.query.limit) || 10;
    const totalPages = Math.ceil(totalEntries / limit);
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || '_id';
    return {
        totalEntries,
        totalPages,
        currentPage: page,
        limit,
        startIndex: totalEntries == 0 ? 0 : skip + 1,
        endIndex: Math.min(skip + limit, totalEntries),
        pagesArray: generatePagination(totalPages, page),
        sort: {
            sortBy,
            order: req.query.orderBy == undefined ? 'asc' : req.query.orderBy,
        },
        search: req.query.search,
        filtersQuery,
        fieldFilters: fieldFilters == {} ? undefined : fieldFilters,
        showSearchBar: req.query.showSearchBar,
        showFilters: req.query.showFilters,
        pageType,
    };
};

module.exports = { generatePagination, createPagination };
