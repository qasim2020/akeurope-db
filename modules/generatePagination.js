const generatePagination = function (totalPages, currentPage) {
    const pagination = [];
    const maxVisiblePages = 2; // Adjust this to show more pages around the current page if needed
  
    if (totalPages <= maxVisiblePages + 2) {
      // If total pages are small, display all pages
      for (let i = 1; i <= totalPages; i++) pagination.push(i);
    } else {
      // Always include the first page
      pagination.push(1);
  
      // Show dots if current page is beyond the first few pages
      if (currentPage > maxVisiblePages / 2 + 1) pagination.push("...");
  
      // Pages around the current page
      let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages - 1, currentPage + Math.floor(maxVisiblePages / 2));
  
      // Adjust if near the beginning or end of the page range
      if (currentPage <= maxVisiblePages / 2) endPage = maxVisiblePages;
      if (currentPage > totalPages - maxVisiblePages / 2) startPage = totalPages - maxVisiblePages + 1;
  
      for (let i = startPage; i <= endPage; i++) pagination.push(i);
  
      // Show dots if current page is far from the last page, but avoid showing dots if near the last page
      if (currentPage < totalPages - maxVisiblePages / 2 - 1) pagination.push("...");
  
      // Always include the last page, but only if not already included
      if (pagination[pagination.length - 1] !== totalPages) pagination.push(totalPages);
    }
  
    return pagination;
  };
  
  module.exports = { generatePagination };
  