const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../modules/auth');
const { allProjects } = require("../modules/mw-data");
const customersController = require('../controllers/customersController');

router.get("/customers", authenticate, authorize("viewCustomers"), allProjects, customersController.customers);
router.get('/getCustomersData', authenticate, authorize("viewCustomers"), customersController.getCustomersData);
router.get('/getEditCustomerModal/:customerId', authenticate, authorize("editCustomers"), allProjects, customersController.editModal);
router.post('/customer/sendInvite', authenticate, authorize("editCustomers"), customersController.sendInvite);
router.post("/customer/update/:customerId", authenticate, authorize("createCustomers"), customersController.updateCustomer);
router.post("/customer/create", authenticate, authorize("createCustomers"), customersController.createCustomer);
router.get('/get-active-subscriptions/:customerId', authenticate, authorize('viewCustomers'), customersController.activeSubscriptions);
router.get('/get-previous-sponsorships/:customerId', authenticate, authorize('viewCustomers'), customersController.previousSponsorships);

router.get("/customer/:customerId", authenticate, authorize("viewCustomers"), allProjects, customersController.customer);
router.get("/getCustomerData/:customerId", authenticate, authorize("viewCustomers"), customersController.getCustomerData);
router.get("/getCustomerLogs/:customerId", authenticate, authorize("viewCustomers"), customersController.getLogs);

module.exports = router;