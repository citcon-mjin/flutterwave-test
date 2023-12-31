const express = require('express');

const router = express.Router();

const card = require('./card');
const charge = require('./charge');

// card
router.post('/card/pay', card.pay);
router.post('/card/pay_api', card.pay_api);
router.post('/card/authorize', card.authorize);
router.post('/card/validate', card.validate);
router.get('/card/redirect', card.redirect);
// charge
router.post('/bank_transfer', charge.bank_transfer_api);
router.post('/ozow', charge.ozow);
router.post('/ussd', charge.ussd);
router.post('/mpesa', charge.mpesa);
router.post('/paga', charge.paga);
router.post('/barter', charge.barter);

module.exports = router;
