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

module.exports = { eq , inc, formatDate};