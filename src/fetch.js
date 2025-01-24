// fetch.js - Http fetch
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const http = require('http');
const https = require('https');

// Http

// Send http request
function request(method, url, headers, data) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Show request
    if (logDebug !== undefined)
      logDebug('REQ:', url, (data || '').replaceAll('\n', '\\n'));

    // What protocol?
    const prot = url.startsWith('https://')?https:http;

    // Create request
    const req = prot.request(url, {
      method: method,
      headers: headers
    }, (res) => {
      // Show response
      if (logDebug !== undefined)
        logDebug('RES:', res.statusCode, res.statusMessage);

      resolve(res);
    })
    .on('error', (e) => {
      // Show error
      if (logDebug !== undefined)
        logDebug('ERR:', e.message);

      reject(e);
    });

    // Write body?
    if (data !== undefined)
      req.write(data);

    // Send request
    req.end();
  });
}

// Get http response
function response(res) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Collate data
    var data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => resolve(data));
    res.on('error', (e) => reject(e));
  });
}

// Get response header
function header(res, name) {
  const header = res.headers[name];

  // Header not found?
  if (header === undefined)
    throw new Error(E_HEADER + ': ' + name);

  return header;
}

// Get header methods
function methods(header) {
  // Split methods
  const data = {};
  const params = header.split(';');

  for (const param of params) {
    // Get method name
    const parts = param.trim().split(' ');

    const method = parts.shift() || '';
    const name = method.toLowerCase();

    // Add method params
    if (name !== '')
      data[name] = parameters(parts.join(''));
  }
  return data;
}

// Get header parameters
function parameters(header) {
  // Split params
  const data = {};
  const params = header.split(',');

  for (const param of params) {
    // Get name and value
    const parts = param.trim().split('=');

    const name = parts[0] || '';
    const value = parts[1] || '';

    // Add param
    if (name !== '')
      data[name] = value;
  }
  return data;
}

// Exports

exports.request = request;
exports.response = response;

exports.header = header;
exports.methods = methods;
exports.parameters = parameters;
