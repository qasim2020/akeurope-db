const moment = require('moment');

// helpers/eqHelper.js
const eq = function(a, b) {
    return a === b;
};

const inc = function(a) {
    return a + 1;
};

const formatDate = function(date) {
    return moment(date).format('MMMM Do, YYYY'); // Customize the format as needed
};

const browserDate = function(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

module.exports = { eq , inc, formatDate, browserDate};