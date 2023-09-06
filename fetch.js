const fetch = require('node-fetch');
const logger = require('./logger');

// if (!globalThis.Headers) {
//   globalThis.Headers = fetch.Headers;
// }
// if (!globalThis.Request) {
//   globalThis.Request = fetch.Request;
// }

const request = async (method, url, reqData = null, headers = null) => {
  const content = {
    method,
    // timeout: 5000,
  };

  if (reqData) {
    content.body = JSON.stringify(reqData);
  }

  if (headers) {
    content.headers = headers;
  }

  const response = await fetch(url, content);

  const body = await response.text();

  if (response.status < 200 || response.status >= 300) {
    logger.error(`HTTP Error Response ${response.status} ${response.statusText} body: ${body}`);
  }

  return JSON.parse(body);
};

const get = async (url, headers) => {
  const result = await request('GET', url, null, headers);
  return result;
};

const post = async (url, reqData, headers) => {
  const result = await request('POST', url, reqData, headers);
  return result;
};

const patch = async (url, reqData, headers) => {
  const result = await request('PATCH', url, reqData, headers);
  return result;
};

const deleted = async (url, headers) => {
  const result = await request('DELETE', url, null, headers);
  return result;
};

module.exports = {
  get,
  post,
  patch,
  deleted,
};
