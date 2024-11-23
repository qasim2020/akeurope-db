const moment = require('moment');

const eq = function(a, b) {
    return a === b;
};

const neq = function(a, b) {
    return a != b;
};


const inc = function(a) {
    return a + 1;
};

const dec = function(a) {
    return a - 1;
};

const formatDate = function(date) {
    return moment(date).format('MMMM Do, YYYY'); 
};

const formatTime = function(timestamp) {
    return moment(timestamp).format('D MMM YYYY [at] h:mm A');
}

const browserDate = function(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

const resizeCloudinaryUrl = function (url, template) {
    return url.replace('/upload/', `/upload/${template}/`);
};

const capitalizeFirstLetter = function (str) {
    if (!str) return ''; 
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const checkInputType = function(input) {
    if (input == "file") {
        return "URL of the file"
    } else if (input == "image") {
        return "URL of the image"
    } else {
        return "String value"
    }
}

const findInArray = function(array, item) {
    if (array && Array.isArray(array) && array.includes(item)) {
        return true;
    } else {
        return false;
    }
}

const getFirstTwoLetters = function (name) {
    if (!name) return ''; 
    return name.slice(0, 2).toUpperCase();
}

const arrayToCsv = function(array) {
    return array.join(', ');
}

const getOptionsFromValues = function(options) {
    return options.map(option => option.value).join(', ');
}

const getKey = function(obj) {
    return Object.keys(obj)[0];
};

const getValue = function(obj) {
    return Object.values(obj)[0];
}

const isEmptyObject = function(obj) {
    if (Object.keys(obj).length === 0) {
      return false;
    } else {
      return true;
    }
};

const findPrimaryKey = function(fields) {
    const primaryField = fields.find(field => field.primary === true);
    return primaryField ? primaryField.name : null; 
}



module.exports = {
    eq,
    inc,
    dec,
    formatDate,
    formatTime,
    browserDate,
    resizeCloudinaryUrl,
    neq,
    capitalizeFirstLetter,
    checkInputType,
    findInArray,
    getFirstTwoLetters,
    arrayToCsv,
    getOptionsFromValues,
    getKey,
    getValue,
    isEmptyObject,
    findPrimaryKey,
  };
