/* eslint-disable no-unused-vars */
const { ClientRequestInterceptor } = require('@mswjs/interceptors/ClientRequest');
const logger = require('./logger');

const interceptor = {
  intercept: () => {
    const instance = new ClientRequestInterceptor();
    // enable the interception of requests
    instance.apply();

    instance.on('request', async ({ request, requestId }) => {
      const json = await request.clone().json();
      logger.info(`${request.method} ${request.url}, with ${JSON.stringify(json)}`);
    });

    instance.on('response', async ({
      response, isMockedResponse, request, requestId,
    }) => {
      const json = await response.clone().json();
      logger.info(`response: ${JSON.stringify(json)}`);
    });
  },
};

module.exports = interceptor;
