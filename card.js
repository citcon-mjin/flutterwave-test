/* eslint-disable no-case-declarations */
const Flutterwave = require('flutterwave-node-v3');
const logger = require('./logger');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

const transactionMap = new Map();

function generateTransactionReference() {
  return `${Date.now()}`;
}

const card = {
  pay: async (req, res, next) => {
    try {
      const payload = {
        card_number: req.body.card_number,
        cvv: req.body.card_cvv,
        expiry_month: req.body.card_expiry_month,
        expiry_year: req.body.card_expiry_year,
        currency: 'NGN',
        amount: req.body.price,
        email: req.body.email,
        fullname: req.body.card_name,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
        redirect_url: `${req.protocol}://${req.host}:3000/v1/card/redirect`,
        enckey: process.env.FLW_ENCRYPTION_KEY,
        // preauthorize: true,
      };

      const response = await flw.Charge.card(payload);

      logger.info(JSON.stringify(response));

      switch (response?.meta?.authorization?.mode) {
        case 'pin':
        case 'avs_noauth':
          // Store the current payload
          req.session.charge_payload = payload;
          // Now we'll show the user a form to enter
          // the requested fields (PIN or billing details)
          req.session.auth_fields = response.meta.authorization.fields;
          req.session.auth_mode = response.meta.authorization.mode;
          return res.redirect(`/card/authorize.html?mode=${response?.meta?.authorization?.mode}&fields=${response.meta.authorization.fields}`);
        case 'redirect':
          // Store the transaction ID
          // so we can look it up later with the flw_ref
          // await redis.setAsync(`txref-${response.data.tx_ref}`, response.data.id);
          transactionMap.set(`txref-${response.data.tx_ref}`, `${response.data.id}`);
          // Auth type is redirect,
          // so just redirect to the customer's bank
          return res.redirect(response.meta.authorization.redirect);
        default:
          // No authorization needed; just verify the payment
          const transactionId = response.data.id;
          const transaction = await flw.Transaction.verify({
            id: transactionId,
          });
          logger.info(JSON.stringify(transaction));
          if (transaction.data.status === 'successful') {
            return res.redirect('/payment-successful');
          } if (transaction.data.status === 'pending') {
            // Schedule a job that polls for the status of the payment every 10 minutes
            /* transactionVerificationQueue.add({
              id: transactionId,
            });
            */
            return res.redirect('/payment-processing');
          }
          return res.redirect('/payment-failed');
      }
    } catch (e) {
      return next(e);
    }
  },

  authorize: async (req, res, next) => {
    try {
      const payload = req.session.charge_payload;
      // Add the auth mode and requested fields to the payload,
      // then call chargeCard again
      payload.authorization = {
        mode: req.session.auth_mode,
      };
      req.session.auth_fields.forEach((field) => {
        payload.authorization[field] = req.body[field];
      });
      const response = await flw.Charge.card(payload);

      logger.info(JSON.stringify(response));

      switch (response?.meta?.authorization?.mode) {
        case 'otp':
          // Show the user a form to enter the OTP
          req.session.flw_ref = response.data.flw_ref;
          return res.redirect('/card/validate.html');
        case 'redirect':
          const authUrl = response.meta.authorization.redirect;
          return res.redirect(authUrl);
        default:
          // No validation needed; just verify the payment
          const transactionId = response.data.id;
          const transaction = await flw.Transaction.verify({
            id: transactionId,
          });
          logger.info(JSON.stringify(transaction));

          if (transaction.data.status === 'successful') {
            return res.redirect('/payment-successful');
          } if (transaction.data.status === 'pending') {
            // Schedule a job that polls for the status of the payment every 10 minutes
            /* transactionVerificationQueue.add({
              id: transactionId,
            });
            */
            return res.redirect('/payment-processing');
          }
          return res.redirect('/payment-failed');
      }
    } catch (e) {
      return next(e);
    }
  },

  validate: async (req, res, next) => {
    try {
      const response = await flw.Charge.validate({
        otp: req.body.otp,
        flw_ref: req.session.flw_ref,
      });
      logger.info(JSON.stringify(response));

      if (response.data.status === 'successful' || response.data.status === 'pending') {
        // Verify the payment
        const transactionId = `${response.data.id}`;
        const transaction = await flw.Transaction.verify({
          id: transactionId,
        });
        logger.info(JSON.stringify(transaction));

        if (transaction.data.status === 'successful') {
          return res.redirect('/payment-successful');
        } if (transaction.data.status === 'pending') {
          // Schedule a job that polls for the status of the payment every 10 minutes
          /* transactionVerificationQueue.add({
            id: transactionId,
          });
          */
          return res.redirect('/payment-processing');
        }
      }

      return res.redirect('/payment-failed');
    } catch (e) {
      return next(e);
    }
  },

  redirect: async (req, res, next) => {
    try {
      const params = JSON.parse(req.query.response);
      // if (req.query.status === 'successful' || req.query.status === 'pending') {
      // Verify the payment
      const { txRef } = params;
      // const transactionId = await redis.getAsync(`txref-${txRef}`);
      const transactionId = transactionMap.get(`txref-${txRef}`);
      const transaction = await flw.Transaction.verify({
        id: transactionId,
      });
      logger.info(JSON.stringify(transaction));

      if (transaction.data.status === 'successful') {
        return res.redirect('/payment-successful');
      } if (transaction.data.status === 'pending') {
        // Schedule a job that polls for the status of the payment every 10 minutes
        /* transactionVerificationQueue.add({
            id: transactionId,
          });
          */
        return res.redirect('/payment-processing');
      }
      // }

      return res.redirect('/payment-failed');
    } catch (e) {
      return next(e);
    }
  },

};

module.exports = card;
