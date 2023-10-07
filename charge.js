const Flutterwave = require('flutterwave-node-v3');
const logger = require('./logger');
const { post } = require('./fetch');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

function generateTransactionReference() {
  return `${Date.now()}`;
//   return '123456';
}

const charge = {
  bank_transfer: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        currency: 'NGN',
        amount: req.body.price,
        email: req.body.email,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
      };
      const response = await flw.Charge.bank_transfer(payload);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },

  bank_transfer_api: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        currency: 'NGN',
        amount: req.body.price,
        email: req.body.email,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
      };
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      };
      const response = await post(`${process.env.FLW_ENDPOINT}/charges?type=bank_transfer`, payload, headers);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },

  ozow: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        currency: req.body.currency,
        amount: req.body.price,
        email: req.body.email,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
      };
      const response = await flw.Charge.ach(payload);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },

  ussd: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        account_bank: req.body.account_bank,
        account_number: '1111', // pass sdk validation
        currency: 'NGN',
        amount: req.body.price,
        email: req.body.email,
        fullname: req.body.card_name,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
      };
      const response = await flw.Charge.ussd(payload);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },

  mpesa: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        phone_number: req.body.phone_number,
        currency: 'KES',
        amount: req.body.price,
        email: req.body.email,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
      };
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      };
      const response = await post(`${process.env.FLW_ENDPOINT}/charges?type=mpesa`, payload, headers);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },

  paga: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      return res.send('TODO');
    } catch (e) {
      return next(e);
    }
  },

  barter: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        account_bank: 'barter',
        account_number: req.body.account_number,
        currency: 'NGN',
        amount: req.body.price,
        beneficiary_name: req.body.beneficiary_name,
      };
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      };
      const response = await post(`${process.env.FLW_ENDPOINT}/transfers`, payload, headers);

      return res.send(response);
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = charge;
