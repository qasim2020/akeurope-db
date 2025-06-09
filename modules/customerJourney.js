const Project = require('../models/Project');
const Order = require('../models/Order');
const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Beneficiary = require('../models/Beneficiary');
const Log = require('../models/Log');
const User = require('../models/User');
const Tracker = require('../models/Tracker');
const { generatePagination } = require('../modules/generatePagination');

const getTracks = async (query, page, limit) => {
    const pipeline = [
        { $match: query },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: { ip: '$geo.ip', ua: '$userAgent' },
                firstHit: { $first: '$$ROOT' },
                earliestCreated: { $first: '$createdAt' },
                hits: {
                    $push: {
                        referrer: '$referrer',
                        fullUrl: '$fullUrl',
                        utm: '$utm',
                        createdAt: '$createdAt'
                    }
                }
            }
        },
        { $replaceWith: { $mergeObjects: ['$firstHit', { hits: '$hits', earliestCreated: '$earliestCreated' }] } },
        { $sort: { earliestCreated: -1, 'geo.ip': 1, 'userAgent': 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
    ];

    const tracks = await Tracker.aggregate(pipeline).exec();

    for (const track of tracks) {
        track.orders = [
            ...await Order.find({ cloudflareIp: track.geo.ip }).sort({ createdAt: -1 }).lean(),
            ...await Subscription.find({ cloudflareIp: track.geo.ip }).sort({ createdAt: -1 }).lean(),
        ];
        if (track.orders.length === 0) {
            track.paid = false;
        };
        for (const order of track.orders) {
            track.paid = order.status === 'paid' ? true : false;
        }
    };

    return tracks;

};

const customerJourney = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 13;

        const query = {};
        const total = await Tracker.countDocuments(query);

        const tracks = await getTracks(query, page, limit);

        const totalPages = Math.ceil(total / limit);

        console.log(JSON.stringify(tracks, 0, 2));

        return {
            tracks,
            pagesArray: generatePagination(totalPages, page),
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
        };
    } catch (error) {
        console.log(error);
        return error;
    }
};

module.exports = {
    customerJourney,
};
