const mongoose = require('mongoose');

const CurrencyRateSchema = new mongoose.Schema(
    {
        baseCurrency: {
            type: String,
            required: true,
            // enum: ['USD', 'NOK', 'SEK', 'GBP', 'EUR', 'PKR', 'ILS', 'EGP', 'GBP', 'DKK', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'INR', 'ZAR', 'UAH', 'BGN', 'BAM', 'CZK', 'RON', 'PLN', 'AED'], 
        },
        rates: {
            type: Map,
            of: Number, 
        },
        date: {
            type: Date,
            required: true,
            default: () => new Date().toISOString().split('T')[0], 
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

const CurrencyRate = mongoose.model('CurrencyRate', CurrencyRateSchema);

module.exports = { CurrencyRate };