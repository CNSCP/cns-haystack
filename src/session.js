// session.js - Haystack session
// Copyright 2025 Padi, Inc. All Rights Reserved.

// https://project-haystack.org/doc/docHaystack/HttpApi

'use strict';

// Imports

const auth = require('./auth');
const fetch = require('./fetch');
const grid = require('./grid');

// Errors

const E_FAILED = 'Request failed';

// Defaults

const DEF_URI = 'http://localhost:3000/api';
const DEF_OP = 'about';
const DEF_METHOD = 'POST';
const DEF_CONTENT = 'text/zinc';
const DEF_VERSION = '3.0';

// Status

const S_OK = 200;

// Session

// Start haystack session
async function start(ses) {
  // Set defaults
  ses.uri = ses.uri || DEF_URI;

  // Needs auth token?
  if (ses.token === undefined)
    ses.token = await auth.token(ses);
}

// Send api request
async function request(ses, req) {
  // Set defaults
  req.op = req.op || DEF_OP;
  req.method = req.method || DEF_METHOD;
  req.content = req.content || DEF_CONTENT;
  req.accept = req.accept || req.content;
  req.version = req.version || DEF_VERSION;

  // Get url and body
  var url = ses.uri + '/' + req.op + '/';
  var body;

  switch (req.method) {
    case 'GET':
      // Get method
      url += grid.toQuery(req);
      break;
    case 'POST':
      // Post method
      body = grid.toGrid(req);
      break;
  }

  // Set headers
  const headers = {
    'Content-Type': req.content,
    'Accept': req.accept
  };

  // Using token?
  if (ses.token !== null)
    headers['Authorization'] = 'BEARER authToken=' + ses.token;

  // Send request
  const res = await fetch.request(req.method, url, headers, body);
  const data = await fetch.response(res);

  // Decode response
  if (res.statusCode !== S_OK)
    throw new Error(E_FAILED + ': ' + res.statusMessage);

  return {
    content: fetch.header(res, 'content-type'),//req.accept,
    data: data
  };
}

// End session
async function end(ses) {
  // Has a token?
  if (ses.token !== undefined) {
    // Send close op
    const res = await request(ses, {
      op: 'close'
    });

    // Remove token
    delete ses.token;
  }
}

// Exports

exports.start = start;
exports.request = request;
exports.end = end;
