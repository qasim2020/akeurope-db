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
                _id: { ip: '$geo.ip' },
                firstHit: { $first: '$$ROOT' },
                earliestCreated: { $first: '$createdAt' },
                hits: {
                    $push: {
                        userAgent: '$userAgent',
                        platform: '$platform',
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
            ...await Order.find({ cloudflareIp: track.geo.ip, status: 'paid' }).sort({ createdAt: -1 }).lean(),
            ...await Subscription.find({ cloudflareIp: track.geo.ip, status: 'paid' }).sort({ createdAt: -1 }).lean(),
        ];
        if (track.orders.length === 0) {
            track.paid = false;
        };
        for (const order of track.orders) {
            track.paid = order.status === 'paid' ? true : false;
        }

        const timeline = [...track.hits.map(hit => ({ ...hit, type: 'hit' }))];

        for (const order of track.orders) {
            const index = timeline.findIndex(hit => new Date(hit.createdAt) <= new Date(order.createdAt));
            const orderEntry = { ...order, type: 'order' };

            if (index === -1) {
                timeline.unshift(orderEntry);
            } else {
                timeline.splice(index + 1, 0, orderEntry);
            }
        }

        timeline.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        track.hits = timeline;

    };

    return tracks;

};

const customerJourney = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;

        const query = {};

        const countResult = await Tracker.aggregate([
            { $match: query },
            { $group: { _id: { ip: '$geo.ip' } } },
            { $count: 'total' }
        ]);

        const total = countResult[0]?.total || 0;

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
