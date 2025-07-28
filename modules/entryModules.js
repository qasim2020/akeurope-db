const mongoose = require('mongoose');
const Project = require('../models/Project');
const Sponsorship = require('../models/Sponsorship');
const { createDynamicModel } = require('../models/createDynamicModel');
const { saveLog } = require('../modules/logAction');
const { logTemplates } = require('../modules/logTemplates');
const Order = require('../models/Order');

const replaceEntryInOrder = async (orderId, entryId, slug, reason, actor) => {

  const order = await Order.findById(orderId).populate('customerId');
  if (!order) {
    return res.status(404).send('Order not found');
  }

  const customer = order.customerId;

  const project = await Project.findOne({ slug }).lean();
  const DynamicModel = await createDynamicModel(slug);
  const entry = await DynamicModel.findById(entryId).lean();

  const orderProject = order.projects.find(p => p.slug === slug);
  const orderEntry = orderProject?.entries.find(e => e.entryId.toString() === entryId.toString());

  if (!orderProject || !orderEntry) {
    return res.status(404).send('Entry not found in order');
  }

  const entrySponsorship = await Sponsorship.findOne({ entryId, orderId, customerId: order.customerId }).lean();

  if (!entrySponsorship) {
    console.log(entryId, orderId, entrySponsorship);
    throw new Error('entry Sponsorship not found... why');
  }

  const startDate = entrySponsorship.startedAt;
  const stopDate = new Date();
  const daysSponsored = Math.ceil((stopDate - startDate) / (1000 * 60 * 60 * 24));

  const dailyRate = orderEntry.totalCost / 30;
  const actualAmountPaid = dailyRate * daysSponsored;

  const occupiedEntryIds = await Order.distinct('projects.entries.entryId', {
    'projects.slug': slug,
    status: { $in: ['paid', 'draft', 'aborted', 'pending payment', 'processing'] }
  });

  let projectUnavailableEntryIds;
  if (project.type === 'orphan') {
    const sponsorshipField = project.fields.find(f => f.subscription)?.name;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 17);
    cutoffDate.setMonth(cutoffDate.getMonth() - 10);
    projectUnavailableEntryIds = await DynamicModel.find({
      dateOfBirth: {
        $lte: cutoffDate
      },
      [sponsorshipField]: { $ne: entry[sponsorshipField] }
    }).select('_id').lean();
  } else if (project.type === 'scholarship') {
    const sponsorshipEndDateField = project.fields.find(f => f.sStop)?.name;
    const sponsorshipField = project.fields.find(f => f.subscription)?.name;
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(now.getMonth() + 1);
    projectUnavailableEntryIds = await DynamicModel.find({
      [sponsorshipEndDateField]: { $lt: oneMonthFromNow },
      [sponsorshipField]: { $ne: entry[sponsorshipField] }
    }).select(`_id`).lean();
  }

  const unavailableEntryIds = [
    ...occupiedEntryIds.map(id => id.toString()),
    ...projectUnavailableEntryIds.map(val => val._id.toString()),
    entryId
  ];

  const replacementEntry = await DynamicModel.findOne({
    _id: { $nin: unavailableEntryIds.map(id => new mongoose.Types.ObjectId(id)) },
  }).lean();

  if (!replacementEntry) throw new Error('No replacement entry found');

  await Sponsorship.findOneAndUpdate({ _id: entryId }, {
    $set: {
      stoppedAt: stopDate,
      reasonStopped: reason,
      daysSponsored: daysSponsored,
      totalPaid: actualAmountPaid
    }
  })

  const newEntrySponsorship = new Sponsorship({
    entryId: replacementEntry._id,
    customerId: customer._id,
    orderId: order._id,
    projectSlug: slug,
    startedAt: new Date(),
    stoppedAt: null,
    reasonStopped: null,
    daysSponsored: null,
    totalPaid: null
  });

  await newEntrySponsorship.save();

  await Order.updateOne(
    {
      _id: orderId,
    },
    {
      $set: {
        'projects.$[project].entries.$[entry].entryId': replacementEntry._id
      }
    },
    {
      arrayFilters: [
        { 'project.slug': slug },
        { 'entry.entryId': new mongoose.Types.ObjectId(entryId) }
      ]
    }
  );

  await saveLog(
    logTemplates({
      type: 'entrySponsorshipStopped',
      entity: entry,
      actor,
      project,
      entry,
      changes: [{
        key: 'Sponsorship Ended',
        oldValue: '',
        newValue: reason
      }],
    })
  );

  await saveLog(
    logTemplates({
      type: 'customerEntryReplaced',
      entity: customer,
      actor,
      project,
      order,
      entry,
      changes: [{
        key: 'replacement',
        oldValue: entry.name || entry._id,
        newValue: replacementEntry.name || replacementEntry._id
      }, {
        key: 'replacementReason',
        oldValue: '',
        newValue: reason
      }],
    })
  );

  await saveLog(
    logTemplates({
      type: 'orderEntryReplaced',
      entity: order,
      actor,
      project,
      entry,
      changes: [{
        key: 'replacement',
        oldValue: entry.name || entry._id,
        newValue: replacementEntry.name || replacementEntry._id
      }, {
        key: 'replacementReason',
        oldValue: '',
        newValue: reason
      }],
    })
  );

  return replacementEntry;

}

module.exports = { replaceEntryInOrder };