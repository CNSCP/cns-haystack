// index.js - CNS Haystack
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const dapr = require('@dapr/dapr');

const env = require('dotenv').config();
const merge = require('object-merge');

const session = require('./src/session');
const pairs = require('./src/pairs');
const grid = require('./src/grid');

const pack = require('./package.json');

// Errors

const E_CONTEXT = 'no context';

// Defaults

const defaults = {
  CNS_CONTEXT: '',
  CNS_DAPR: 'cns-dapr',
  CNS_DAPR_HOST: 'localhost',
  CNS_DAPR_PORT: '3500',
  CNS_PUBSUB: 'cns-pubsub',
  CNS_SERVER_HOST: 'localhost',
  CNS_SERVER_PORT: '3100',
  HAYSTACK_URI: 'http://localhost:8080/api',
  HAYSTACK_USER: '',
  HAYSTACK_PASS: '',
  HAYSTACK_VERSION: '3.0',
  HAYSTACK_FORMAT: 'text/zinc'
};

// Config

const config = {
  CNS_CONTEXT: process.env.CNS_CONTEXT || defaults.CNS_CONTEXT,
  CNS_DAPR: process.env.CNS_DAPR || defaults.CNS_DAPR,
  CNS_DAPR_HOST: process.env.CNS_DAPR_HOST || defaults.CNS_DAPR_HOST,
  CNS_DAPR_PORT: process.env.CNS_DAPR_PORT || defaults.CNS_DAPR_PORT,
  CNS_PUBSUB: process.env.CNS_PUBSUB || defaults.CNS_PUBSUB,
  CNS_SERVER_HOST: process.env.CNS_SERVER_HOST || defaults.CNS_SERVER_HOST,
  CNS_SERVER_PORT: process.env.CNS_SERVER_PORT || defaults.CNS_SERVER_PORT,
  HAYSTACK_URI: process.env.HAYSTACK_URI || defaults.HAYSTACK_URI,
  HAYSTACK_USER: process.env.HAYSTACK_USER || defaults.HAYSTACK_USER,
  HAYSTACK_PASS: process.env.HAYSTACK_PASS || defaults.HAYSTACK_PASS,
  HAYSTACK_VERSION: process.env.HAYSTACK_VERSION || defaults.HAYSTACK_VERSION,
  HAYSTACK_FORMAT: process.env.HAYSTACK_FORMAT || defaults.HAYSTACK_FORMAT
};

// Constants

const SYNCTIME = 2000;

// Dapr client

const client = new dapr.DaprClient({
  daprHost: config.CNS_DAPR_HOST,
  daprPort: config.CNS_DAPR_PORT,
  logger: {
    level: dapr.LogLevel.Error
  }
});

// Dapr server

const server = new dapr.DaprServer({
  serverHost: config.CNS_SERVER_HOST,
  serverPort: config.CNS_SERVER_PORT,
  clientOptions: {
    daprHost: config.CNS_DAPR_HOST,
    daprPort: config.CND_DAPR_PORT
  },
  logger: {
    level: dapr.LogLevel.Error
  }
});

// Local data

var context = 'node/contexts/' + config.CNS_CONTEXT;

var options = {};
var cache = {};
var changes = {};
//var haystack = {};

var sync;

// Fetch operation
async function fetchOp(method, op, request) {
  // Create session request
  const ses = {
    uri: config.HAYSTACK_URI,
    username: config.HAYSTACK_USER,
    password: config.HAYSTACK_PASS
  };

  const req = {
    version: config.HAYSTACK_VERSION,
    content: config.HAYSTACK_FORMAT,
    method: method,
    op: op
  };

  // Parse filter
  pairs.parse(req, request);

  // Get properties
  var status = 'error';
  var error = null;
  var response = null;

  try {
    // Open session
    await session.start(ses);

    // Get request
    const res = await session.request(ses, req);

    error = grid.fromGrid(res);
    response = res.data;

    if (error === null) status = 'ok';
  } catch (e) {
    // Failure
    error = e.message;
  }

  // End session
  await session.end(ses);

  return {
    status: status,
    error: error,
    response: response
  };
}

// Fetch dataset
async function fetchDataset(filter) {
  // Create session request
  const ses = {
    uri: config.HAYSTACK_URI,
    username: config.HAYSTACK_USER,
    password: config.HAYSTACK_PASS
  };

  const req = {
    version: config.HAYSTACK_VERSION,
    content: config.HAYSTACK_FORMAT,
    op: 'read'
  };

  // Parse filter
  var columns;

  const parts = filter.split(';');
  pairs.parse(req, parts[0]);

  if (parts[1] !== undefined)
    columns = parts[1].split(',');

  // Get properties
  var status = 'error';
  var labels = '';
  var values = '';

  try {
    // Open session
    await session.start(ses);

    // Get request
    const res = await session.request(ses, req);
    const error = grid.fromGrid(res);

    if (error === null) {
      // Reduce to specified columns?
      if (columns !== undefined)
        pairs.reduce(res, columns);

      // Fetch labels
      labels = res.names.join(',');

      // Fetch first row
      for (const val of res.values) {
        if (values !== '') values += ',';
        values += val[0];
      }
      status = 'ok';
    }
  } catch (e) {
    // Failure
  }

  // End session
  await session.end(ses);

  return {
    status: status,
    labels: labels,
    values: values
  };
}

// Fetch value
async function fetchValue(id) {
  // Create session request
  const ses = {
    uri: config.HAYSTACK_URI,
    username: config.HAYSTACK_USER,
    password: config.HAYSTACK_PASS
  };

  const req = {
    version: config.HAYSTACK_VERSION,
    content: config.HAYSTACK_FORMAT,
    op: 'read'
  };

  // Parse filter
  var columns;

  const parts = id.split(';');
  pairs.parse(req, parts[0]);

  if (parts[1] !== undefined)
    columns = parts[1].split(',');

  // Get properties
  var status = 'error';
  var value = '';

  try {
    // Open session
    await session.start(ses);

    // Get request
    const res = await session.request(ses, req);
    const error = grid.fromGrid(res);

    if (error === null) {
      // Reduce to specified columns?
      if (columns !== undefined)
        pairs.reduce(res, columns);

      // Fetch first row
      for (const val of res.values) {
        if (value !== '') value += ',';
        value += val[0];
      }
      status = 'ok';
    } else value = error;
  } catch (e) {
    // Failure
    value = e.message;
  }

  // End session
  await session.end(ses);

  return {
    status: status,
    value: value
  };
}

// Process haystack op
async function processOp(properties) {
  const method = (properties.method || '').toUpperCase();
  const op = properties.op || '';
  const request = properties.request || '';
  const status = properties.status || '';

  var result;

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch op request
      result = await fetchOp(method, op, request);
      break;
  }
  return result;
}

// Process dataset connection
async function processDataset(properties) {
  const filter = properties.filter || '';
  const status = properties.status || '';

  var result;

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch value
      result = await fetchDataset(filter);
      break;
  }
  return result;
}

// Process value connection
async function processValue(properties) {
  const id = properties.id || '';
  const status = properties.status || '';

  var result;

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch value
      result = await fetchValue(id);
      break;
  }
  return result;
}

// Update connections
async function updateConns(profile, cap, fn) {
  // Look at connections
  const conns = cap.connections;

  for (const connId in conns) {
    // Process connection
    const conn = conns[connId];
    const properties = conn.properties;

    const result = await fn(properties);

    if (result !== undefined) {
      try {
        // Post new properties
        const res = await client.invoker.invoke(
          config.CNS_DAPR,
          context + '/capabilities/' + profile + '/connections/' + connId + '/properties',
          dapr.HttpMethod.POST,
          result);

        // CNS Dapr error?
        if (res.error !== undefined)
          throw new Error(res.error);
      } catch(e) {
        // Failure
        console.error('System Error:', e.message);
      }
    }
  }
}

// Update context
async function updateContext(data) {
  // Look at capabilities
  const caps = data.capabilities;

  for (const profile in caps) {
    const cap = cache.capabilities[profile];

    // What profile?
    switch (profile) {
      case 'cp:haystack.op.v1:provider':
        // Process haystack op
        await updateConns(profile, cap, processOp);
        break;
      case 'cp:padi.dataset.v1:provider':
        // Process dataset
        await updateConns(profile, cap, processDataset);
        break;
      case 'cp:padi.value.v1:provider':
        // Process value
        await updateConns(profile, cap, processValue);
        break;
    }
  }
}

// Sync context changes
function syncContext(data) {
  // Keep changes
  changes = merge(changes, data);

  // Reset sync timer
  if (sync !== undefined)
    clearTimeout(sync);

  // Defer for later
  sync = setTimeout(() => {
    sync = undefined;

    // Update all changes
    cache = merge(cache, changes);

    updateContext(changes);
    changes = {};
  }, SYNCTIME);
}

// Client application
async function start(args) {
  // Switch on debug
  if (args.includes('--debug'))
    options.debug = true;

  // Output welcome
  console.log('CNS Haystack', pack.version);

  console.log('CNS Haystack on', config.CNS_SERVER_HOST, 'port', config.CNS_SERVER_PORT);
  console.log('CNS Dapr on', config.CNS_DAPR_HOST, 'port', config.CNS_DAPR_PORT);

  // No context?
  if (config.CNS_CONTEXT === '')
    throw new Error(E_CONTEXT);

  console.log('CNS context:', config.CNS_CONTEXT);

  console.log('Haystack server:', config.HAYSTACK_URI);
  console.log('Haystack auth:', (config.HAYSTACK_USER === '')?'disabled':'enabled');
  console.log('Haystack version:', config.HAYSTACK_VERSION);
  console.log('Haystack format:', config.HAYSTACK_FORMAT);

  // Create session
//
//haystack = {
//  uri: config.HAYSTACK_URI,
//  username: config.HAYSTACK_USER,
//  password: config.HAYSTACK_PASS
//};
//  await session.start(haystack);
//  console.log('Haystack connected');

  // Start client
  await client.start();

  // Fetch context state
  const res = await client.invoker.invoke(
    config.CNS_DAPR,
    context,
    dapr.HttpMethod.GET);

  // CNS Dapr error?
  if (res.error !== undefined)
    throw new Error(res.error);

  // Initial update
  cache = merge(cache, res.data);
  await updateContext(cache);

  // Subscribe to context
  server.pubsub.subscribe(
    config.CNS_PUBSUB,
    context,
    (SYNCTIME > 0)?syncContext:updateContext);

  // Start server
  await server.start();
}

// Catch terminate signal
//process.on('SIGINT', async () => {
//  console.log('\rAborted.');

//  await session.end(haystack);
//  console.log('Haystack disconnected');

//  process.exit(1);
//});

// Output debug
global.logDebug = function() {
  if (options.debug)
    console.log.apply(null, arguments);
}

// Start application
start(process.argv.slice(2)).catch((e) => {
  console.error('System Error:', e.message);
  if (options.debug) console.error(e.stack);

  process.exit(1);
});
