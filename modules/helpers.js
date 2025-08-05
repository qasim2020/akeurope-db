const hbs = require('handlebars');
const moment = require('moment');
const getLetterIcon = require('../modules/iconLetter');
const getOrderIcon = require('../modules/iconOrder');
const cheerio = require('cheerio');
const roles = require('../modules/roles');
const maskList = require('../../akeurope-cp/static/maskList');
const { get } = require('mongoose');

const or = function (a,b) {
    return a || b;
};

const categoryOptions = function (selectedCategory, options) {
    const categories = [
        { value: "thankyou", label: "Thank You Note" },
        { value: "general", label: "General" },
        { value: 'qurbani', label: "Qurbani"},
        { value: "health", label: "Health Report" },
        { value: "paymentProof", label: "Payment Proof" },
        { value: "schoolReport", label: "School Report" },
        { value: "rent", label: "Rent Report" },
        { value: "monthlyReport", label: "Monthly Report" },
        { value: "invoice", label: "Invoice" },
        { value: 'receipt', label: "Receipt"},
    ];

    let html = "";
    categories.forEach((category) => {
        html += `
        <label class="form-selectgroup-item flex-fill">
            <input type="radio" name="fileCategory" value="${category.value}" class="form-selectgroup-input"
                ${selectedCategory === category.value ? "checked" : ""}>
            <div class="form-selectgroup-label d-flex align-items-center p-3">
                <div class="me-3">
                    <span class="form-selectgroup-check"></span>
                </div>
                <div>${category.label}</div>
            </div>
        </label>`;
    });

    return new hbs.SafeString(html);
};

const eq = function (a, b) {
    return a === b;
};

const gt = function (a, b) {
    return a > b;
};

const and = function(a,b) {
    return a && b;
}

const compareIds = function (a, b) {
    if (!a || !b) return false;
    return a.toString() === b.toString();
};

const neq = function (a, b) {
    return a != b;
};

const inc = function (a) {
    return a + 1;
};

const dec = function (a) {
    return a - 1;
};

const formatDate = function (date) {
    if (!date) return '';
    return moment(date).format('DD-MM-YYYY');
};


const getAgeInYearsAndMonths = function (date) {
    const birthDate = moment(date);
    const today = moment();

    const years = today.diff(birthDate, 'years');
    const months = today.diff(birthDate.add(years, 'years'), 'months');

    if (years === 0) {
        return `${months} months`;
    } else {
        return `${years} years`;
    }
};

const formatTime = function (timestamp) {
    if (!timestamp) return '';
    return moment(timestamp).format('D MMM YYYY [at] h:mm A');
};

const browserDate = function (dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const resizeCloudinaryUrl = function (url, template) {
    if (!url) return '/static/images/no-image-placement.png';
    return url.replace('/upload/', `/upload/${template}/`);
};

const capitalizeFirstLetter = function (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const lowerCaseFirstLetter = function (str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
};

const getUniqueCustomers = function (entries) {
    if (!entries || !Array.isArray(entries)) return [];
    
    const customerMap = new Map();
    
    entries.forEach(entry => {
        if (entry.customer && entry.customer._id) {
            customerMap.set(entry.customer._id.toString(), {
                _id: entry.customer._id,
                name: entry.customer.name
            });
        }
    });
    
    return Array.from(customerMap.values());
}

const isInHideList = function (customerId, hideCustomersString) {
    if (!hideCustomersString || !customerId) return false;
    
    const hideList = hideCustomersString.split(',').map(id => id.trim());
    return hideList.includes(customerId.toString())
}

const checkInputType = function (input) {
    if (input == 'file') {
        return 'URL of the file';
    } else if (input == 'image') {
        return 'URL of the image';
    } else {
        return 'String value';
    }
};

const findInArray = function (array, item) {
    if (array && Array.isArray(array) && array.includes(item)) {
        return true;
    } else {
        return false;
    }
};

const getFirstTwoLetters = function (name) {
    if (!name) return '';
    const words = name.trim().split(' ');
    const firstLetters = words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase());
    return firstLetters.join('');
};

const arrayToCsv = function (array) {
    return array.join(', ');
};

const getOptionsFromValues = function (options) {
    return options.map((option) => option.value).join(', ');
};

const getKey = function (obj) {
    return Object.keys(obj)[0];
};

const getValue = function (obj) {
    return Object.values(obj)[0];
};

const transformArrayOfObjects = function (arrayOfObjects) {
    return arrayOfObjects.flatMap((obj) =>
        Object.entries(obj).map(([key, value]) => ({ key, value })),
    );
};

const getValueOfFieldInArray = function (array, fieldName) {
    const fieldObject = array.find((item) => item.fieldName === fieldName);
    return fieldObject ? fieldObject.value : null;
};

const isEmptyObject = function (obj) {
    if (Object.keys(obj).length === 0) {
        return false;
    } else {
        return true;
    }
};

const findPrimaryKey = function (fields) {
    const primaryField = fields.find((field) => field.primary === true);
    return primaryField ? primaryField.name : null;
};

const timeDaysAgo = function (timestamp) {
    const now = moment();
    const date = moment(timestamp);

    const seconds = now.diff(date, 'seconds');
    const minutes = now.diff(date, 'minutes');
    const hours = now.diff(date, 'hours');
    const days = now.diff(date, 'days');

    if (seconds < 60) return 'few seconds ago';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return `${days} days ago`;
};

const timeAgo = function (timestamp) {
    const now = moment();
    const date = moment(timestamp);

    const seconds = now.diff(date, 'seconds');
    const minutes = now.diff(date, 'minutes');
    const hours = now.diff(date, 'hours');
    const days = now.diff(date, 'days');

    if (seconds < 60) return 'few seconds ago';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return date.format('DD MMM YYYY');
};

const camelCaseToNormalString = function (string) {
    if (typeof string !== 'string') return;
    string = string ? string : '';
    return string
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (str) => str.toUpperCase());
};

const kebabCaseToNormalString = function (string) {
    string = string ? string : '';
    return string
        .split('-') 
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) 
        .join(' '); 
};

const camelCaseWithCommaToNormalString = function (string) {
    string = string ? string : '';
    return string
        .split(',')
        .map((part) =>
            part
                .trim()
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/^./, (str) => str.toUpperCase()),
        )
        .join(', ');
};

const startsWith = function (str, prefix) {
    if (!str || !prefix) return false;
    return str.toString().startsWith(prefix.toString());
}

const includes = function(str, substring) {
    if (!str || !substring) return false;
    return str.toString().includes(substring.toString());
};

const getSvgForFirstLetter = function (str) {
    if (!str || typeof str !== 'string') return '<svg></svg>';
    const firstLetter = str.trim().charAt(0).toLowerCase();
    return getLetterIcon(firstLetter);
};

const lte = function(a, b) {
    return a <= b;
};



const regexMatch = function (value, pattern) {
    let regex = new RegExp(pattern);
    return regex.test(value);
};

const stringifyDate = function (query) {
    const operators = ['$gt', '$gte', '$lt', '$lte', '$eq'];

    for (let operator of operators) {
        if (query[operator]) {
            const dateValue = query[operator];

            if (dateValue instanceof Date || !isNaN(Date.parse(dateValue))) {
                const date = new Date(dateValue);
                const formattedDate = date.toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                });

                let operatorString = '';
                switch (operator) {
                    case '$gt':
                        operatorString = '> ';
                        break;
                    case '$gte':
                        operatorString = '>= ';
                        break;
                    case '$lt':
                        operatorString = '< ';
                        break;
                    case '$lte':
                        operatorString = '<= ';
                        break;
                    case '$eq':
                        operatorString = '= ';
                        break;
                    default:
                        break;
                }

                return operatorString + formattedDate;
            } else {
                console.error('Invalid date in query:', dateValue);
                return null;
            }
        }
    }

    return null;
};

const json = function (value) {
    return JSON.stringify(value);
};

const expiresOn = (createdAt, months) => {
    if (!createdAt || !months || months <= 0) {
        throw new Error('Invalid input: createdAt and months must be valid');
    }
    return moment(createdAt).add(months, 'months').format('DD-MM-YYYY');
};

const expiresAfter = (expiryTime) => {
  const expiry = moment(expiryTime);
  const now = moment();
  const duration = moment.duration(expiry.diff(now));

  if (duration.asMilliseconds() <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();

  return `${hours}h ${minutes}m left`;
};

function removeLinksFromHtml(htmlString) {
    try {
        const parameters = ['project', 'user', 'customer', 'order'];
        const $ = cheerio.load(htmlString);

        parameters.forEach((param) => {
            $(`a[href*="/${param}/"]`).each(function () {
                $(this).replaceWith($(this).text());
            });
        });

        return $.html();
    } catch (error) {
        return htmlString;
    }
}

const concat = function() {
    return Array.prototype.slice.call(arguments, 0, -1).join('');
}

const shortenFileName = function(string) {
    if (string.length <= 10) {
        return string;
    }
    const start = string.slice(0, 5); 
    const end = string.slice(-4);    
    return `${start}...${end}`;       
}

const shortenCustomerName = function(string) {
    if (string.length <= 30) {
        return string;
    }
    const start = string.slice(0, 27); 
    return `${start}...`;    
}

const inArray = function(array, value) {
    if (!Array.isArray(array)) return false;
    return array.includes(value.toString());
}

const endingString = function(string, length) {
  if (typeof string !== 'string') return string;
  if (string.length <= length) {
    return string;
  }
  const end = string.slice(-length); 
  return `..${end}`;
};

const shortenString = function(string, length) {
    if (typeof string !== 'string') return string;
    if (string.length <= length) {
        return string;
    }
    const start = string.slice(0, length - 3); 
    return `${start}...`;    
}

const getFirstName = function (name) {
    if (!name) return '';
    const words = name.trim().split(' ');
    return words[0];
};

const multiply = function(a, b) {
    return a * b;
}

const divide = function(a, b) {
    return a / b;
};

const slugToString = function (slug) {
    if (!slug) return 'Slug not found';
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

function circleCloudinaryUrl(url) {
    if (!url) return '/static/images/no-image-placement.png';

    const transformation = 'ar_1:1,c_fill,e_improve,g_auto,h_250,r_max,w_250,z_1.0';
    return url.replace('/upload/', `/upload/${transformation}/`);
};

function roundedCloudinaryUrl(url) {
    if (!url) return '/static/images/no-image-placement.png';

    const transformation = 'ar_1:1,c_fill,e_improve,g_auto,h_250,w_250,r_10,z_1.0';
    return url.replace('/upload/', `/upload/${transformation}/`);
}

const capitalizeAll = function (str) {
    if (!str) return '';
    return str.toUpperCase();
};


const getMonth = function(date) {
    return moment(date).format('MMM-YY'); 
}

const formatNumber = function (num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString();
};

const getPreviousSponsorships = async (customerId) => {
    try {
        const expiredOrders = await Order.find({
            customerId: mongoose.Types.ObjectId(customerId),
            status: 'expired'
        }).lean();

        const sponsorships = await Sponsorship.find({
            customerId: mongoose.Types.ObjectId(customerId)
        }).lean();

        return await formatPreviousSponsorships(expiredOrders, sponsorships);
    } catch (error) {
        console.error('Error fetching previous sponsorships:', error);
        return [];
    }
};

const formatSponsorshipDuration = function (days) {
    if (!days) return 'Unknown duration';
    
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    
    let duration = '';
    if (years > 0) duration += `${years}y `;
    if (months > 0) duration += `${months}m `;
    if (remainingDays > 0) duration += `${remainingDays}d`;
    
    return duration.trim() || `${days} days`;
};

const getSponsorshipStatus = function (sponsorship)  {
    if (sponsorship.type === 'expired_order') {
        return 'Order Expired';
    }
    return sponsorship.reasonStopped || 'Sponsorship Ended';
};

const hasAny = function (a, b) {
    const isTruthy = val => {
        if (Array.isArray(val)) return val.length > 0;
        if (val && typeof val === 'object') return Object.keys(val).length > 0;
        return !!val;
    };

    return isTruthy(a) || isTruthy(b);
};

const convertDaysToMonths = function (days) {
  const daysInMonth = 30.44; 
  const daysInYear = 365.25; 

  const years = Math.floor(days / daysInYear);
  days %= daysInYear;

  const months = Math.floor(days / daysInMonth);
  days = Math.floor(days % daysInMonth);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ').replace(/,([^,]*)$/, ' and$1') : '0 days';
}

module.exports = { 
    formatNumber,
    getMonth,
    slugToString,
    capitalizeAll,
    categoryOptions,
    or,
    hasAny,
    eq,
    gt,
    and,
    compareIds,
    inc,
    dec,
    multiply,
    divide,
    formatDate,
    formatTime,
    browserDate,
    resizeCloudinaryUrl,
    neq,
    capitalizeFirstLetter,
    lowerCaseFirstLetter,
    checkInputType,
    findInArray,
    getFirstTwoLetters,
    arrayToCsv,
    getOptionsFromValues,
    getKey,
    getValue,
    transformArrayOfObjects,
    isEmptyObject,
    findPrimaryKey,
    timeAgo,
    timeDaysAgo,
    camelCaseToNormalString,
    kebabCaseToNormalString,
    camelCaseWithCommaToNormalString,
    getSvgForFirstLetter,
    regexMatch,
    getValueOfFieldInArray,
    stringifyDate,
    json,
    expiresOn,
    getOrderIcon,
    removeLinksFromHtml,
    concat,
    shortenString,
    shortenFileName,
    circleCloudinaryUrl,
    roundedCloudinaryUrl,
    shortenCustomerName,
    getFirstName,
    expiresAfter,
    getAgeInYearsAndMonths,
    endingString,
    getPreviousSponsorships,
    formatSponsorshipDuration,
    getSponsorshipStatus,
    convertDaysToMonths,
    getUniqueCustomers,
    isInHideList,
    inArray,
    startsWith,
    lte,
    includes,
};
