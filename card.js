/* eslint-disable no-case-declarations */
const Flutterwave = require('flutterwave-node-v3');
const forge = require('node-forge');
const logger = require('./logger');
const { post } = require('./fetch');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

const transactionMap = new Map();

function generateTransactionReference() {
  return `${Date.now()}`;
//   return '12344321';
}

const card = {
  pay: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        card_number: req.body.card_number,
        cvv: req.body.card_cvv,
        expiry_month: req.body.card_expiry_month,
        expiry_year: req.body.card_expiry_year,
        currency: req.body.currency,
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

  encrypt: (encryptionKey, payload) => {
    const text = JSON.stringify(payload);
    const cipher = forge.cipher.createCipher(
      '3DES-ECB',
      forge.util.createBuffer(encryptionKey),
    );
    cipher.start({ iv: '' });
    cipher.update(forge.util.createBuffer(text, 'utf-8'));
    cipher.finish();
    const encrypted = cipher.output;
    return forge.util.encode64(encrypted.getBytes());
  },

  pay_api: async (req, res, next) => {
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const payload = {
        card_number: req.body.card_number,
        cvv: req.body.card_cvv,
        expiry_month: req.body.card_expiry_month,
        expiry_year: req.body.card_expiry_year,
        currency: req.body.currency,
        amount: req.body.price,
        email: req.body.email,
        fullname: req.body.card_name,
        // Generate a unique transaction reference
        tx_ref: generateTransactionReference(),
        redirect_url: `${req.protocol}://${req.hostname}:3000/v1/card/redirect`,
        preauthorize: true,
      };

      const encrypted = {
        client: card.encrypt(process.env.FLW_ENCRYPTION_KEY, payload),
      };

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      };
      const response = await post(`${process.env.FLW_ENDPOINT}/charges?type=card`, encrypted, headers);

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
    logger.info(`request body: ${JSON.stringify(req.body)}`);
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
      // const response = await flw.Charge.card(payload);
      const encrypted = {
        client: card.encrypt(process.env.FLW_ENCRYPTION_KEY, payload),
      };

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      };
      const response = await post(`${process.env.FLW_ENDPOINT}/charges?type=card`, encrypted, headers);

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
    logger.info(`request body: ${JSON.stringify(req.body)}`);
    try {
      const response = await flw.Charge.validate({
        otp: req.body.otp,
        flw_ref: req.session.flw_ref,
      });

      if (response.data.status === 'successful' || response.data.status === 'pending') {
        // Verify the payment
        const transactionId = `${response.data.id}`;
        const transaction = await flw.Transaction.verify({
          id: transactionId,
        });

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
    logger.info(`request body: ${JSON.stringify(req.body)}`);
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
