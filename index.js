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
  HAYSTACK_FORMAT: 'text/zinc',
  HAYSTACK_LEASE: '1min',
  HAYSTACK_POLL: '5sec'
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
  HAYSTACK_FORMAT: process.env.HAYSTACK_FORMAT || defaults.HAYSTACK_FORMAT,
  HAYSTACK_LEASE: process.env.HAYSTACK_LEASE || defaults.HAYSTACK_LEASE,
  HAYSTACK_POLL: process.env.HAYSTACK_POLL || defaults.HAYSTACK_POLL
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
var haystack = {};
var subscribers = {};
var watches = {};
var unwatches = {};

var sync;

// Fetch operation
async function requestOp(req) {
  var status = 'error';
  var error = '';
  var response = '';

  try {
    // Get request
    const res = await session.request(haystack, req);

    response = res.data;
    status = 'ok';
  } catch (e) {
    // Failure
    error = e.message;
  }

  return {
    status: status,
    error: error,
    response: response
  };
}

// Fetch dataset
async function requestDataset(req, columns) {
  var status = 'error';
  var labels = 'Error';
  var values = '';

  try {
    // Get request
    const res = await session.request(haystack, req);

    if (res.error === null) {
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
    } else values = res.error;
  } catch (e) {
    // Failure
    values = e.message;
  }

  return {
    status: status,
    labels: labels,
    values: values
  };
}

// Fetch value
async function requestValue(req, columns) {
  var status = 'error';
  var value = '';

  try {
    // Get request
    const res = await session.request(haystack, req);

    if (res.error === null) {
      // Reduce to specified columns?
      if (columns !== undefined)
        pairs.reduce(res, columns);

      // Fetch first row
      for (const val of res.values) {
        if (value !== '') value += ',';
        value += val[0];
      }
      status = 'ok';
    } else value = res.error;
  } catch (e) {
    // Failure
    value = e.message;
  }

  return {
    status: status,
    value: value
  };
}

// Process haystack op
async function processOp(profile, connId, conn) {
  const properties = conn.properties || {};

  const method = (properties.method || '').toUpperCase();
  const op = properties.op || '';
  const request = properties.request || '';
  const content = properties.content || 'text/zinc';
  const status = properties.status || '';

  // Create request
  const req = {
    method: method,
    accept: content,
    op: op,
    raw: true
  };

  // Parse filter
  pairs.parse(req, request);

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch op request
      const res = await requestOp(req);
      await updateConn(profile, connId, res);
      break;
  }
}

// Process dataset connection
async function processDataset(profile, connId, conn) {
  const properties = conn.properties || {};

  const filter = properties.filter || '';
  const status = properties.status || '';
  const labels = properties.labels || '';
  const values = properties.values || '';

  // Parse filter
  var columns;

  const parts = filter.split(';');
  const names = parts[0];

  if (parts[1] !== undefined)
    columns = parts[1].split(',');

  // Create request
  const req = {
    op: 'read'
  };

  // Parse names
  pairs.parse(req, names);

  // Specific id?
  if (names.includes('id')) {
    // Add subscription
    subscribe(req, profile, connId, columns, {
      status: status,
      labels: labels,
      values: values
    });

    return;
  }

  // Remove subscription
  unsubscribe(connId);

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch request
      const res = await requestDataset(req, columns);
      await updateConn(profile, connId, res);
      break;
  }
}

// Process value connection
async function processValue(profile, connId, conn) {
  const properties = conn.properties || {};

  const id = properties.id || '';
  const status = properties.status || '';
  const value = properties.value || '';

  // Parse id
  var columns;

  const parts = id.split(';');
  const names = parts[0];

  if (parts[1] !== undefined)
    columns = parts[1].split(',');

  // Create request
  const req = {
    op: 'read'
  };

  // Parse names
  pairs.parse(req, names);

  // Specific id?
  if (names.includes('id')) {
    // Add subscription
    subscribe(req, profile, connId, columns, {
      status: status,
      value: value
    });

    return;
  }

  // Remove subscription
  unsubscribe(connId);

  // What status?
  switch (status) {
    case 'ok':
    case 'error':
      // Already processed
      break;
    default:
      // Fetch request
      const res = await requestValue(req, columns);
      await updateConn(profile, connId, res);
      break;
  }
}

// Is id subscribed
function isSubscribed(id) {
  for (const connId in subscribers) {
    const sub = subscribers[connId];
    if (sub.id === id) return true;
  }
  return false;
}

// Subscribe connection
function subscribe(req, profile, connId, columns, properties) {
  // Find id
  const x = pairs.getCol(req, 'id');
  const id = pairs.getValue(req, x, 0);

  // Already subscribed?
  const sub = subscribers[connId];

  if (sub !== undefined) {
    // Refresh on id change
    if (sub.id !== id) {
      const old = sub.id;
      sub.id = null;

      // Remove old
      if (isSubscribed(old))
        haystack.refresh = true;
      else watchRemove(old);

      // Add new
      if (isSubscribed(id))
        haystack.refresh = true;
      else watchAdd(id);

      sub.id = id;
    }

    // Refresh on columns change
    const c1 = sub.columns || [];
    const c2 = columns || [];

    if (c1.join(',') !== c2.join(',')) {
      sub.columns = columns;
      haystack.refresh = true;
    }

    // Update properties
    sub.properties = properties;
    return;
  }

  // Add subscription
  subscribers[connId] = {
    profile: profile,
    connId: connId,
    id: id,
    columns: columns,
    properties: properties
  };

  // Add watch
  watchAdd(id);
}

// Unsubscribe connection
function unsubscribe(connId) {
  // Is subscribed?
  const conn = subscribers[connId];
  if (conn === undefined) return;

  const id = conn.id;

  // Remove subscription
  delete subscribers[connId];

  // Remove watch?
  if (!isSubscribed(id))
    watchRemove(id);
}

// Add to watch list
function watchAdd(id) {
  // Already watched?
  if (haystack.watches !== undefined) {
    const watch = haystack.watches[id];
    if (watch !== undefined) return;
  }

  // Add watch
  watches[id] = {
    id: id,
    watchFn: watchUpdate
  };
}

// Remove from watch list
function watchRemove(id) {
  // Is watched?
  if (haystack.watches === undefined) return;

  const watch = haystack.watches[id];
  if (watch === undefined) return;

  // Remove watch
  unwatches[id] = {
    id: id
  };
}

// Update watch connections
async function watchUpdate(watch, res, y) {
  // Find subscribers
  for (const connId in subscribers) {
    const sub = subscribers[connId];

    if (sub.id === watch.id) {
      // Process properties
      const columns = sub.columns || res.names;
      const properties = sub.properties;

      const result = {};

      for (const name in properties) {
        var value = '';

        switch (name) {
          case 'status':
            // Set status
            value = 'ok';
            break;
          case 'labels':
            // Set labels
            value = columns.join(',');
            break;
          case 'values':
          case 'value':
            // Set value
            for (const name of columns) {
              const x = pairs.getCol(res, name);

              if (value !== '') value += ',';
              value += (x === -1)?'':pairs.getValue(res, x, y);
            }
            break;
        }

        // Property changed?
        if (properties[name] !== value) {
          // Update result
          properties[name] = value;
          result[name] = value;
        }
      }

      // Update changes?
      if (Object.keys(result).length > 0) {
        // Update connection properties
        debug('Haystack update ' + connId + ' ' + JSON.stringify(result));
        await updateConn(sub.profile, connId, result);
      }
    }
  }
}

// Update connection
async function updateConn(profile, connId, properties) {
  try {
    // Post new properties
    const res = await client.invoker.invoke(
      config.CNS_DAPR,
      context + '/capabilities/' + profile + '/connections/' + connId + '/properties',
      dapr.HttpMethod.POST,
      properties);

    // CNS Dapr error?
    if (res.error !== undefined)
      throw new Error(res.error);
  } catch(e) {
    // Failure
    error(e);
  }
}

// Update connections
async function updateConns(profile, cap, fn) {
  // Clear watches
  watches = {};
  unwatches = {};

  // Look at connections
  const conns = cap.connections;

  for (const connId in conns) {
    // Process connection
    const conn = conns[connId];

    if (conn === null) unsubscribe(connId);
    else await fn(profile, connId, conn);
  }

  // Add watches
  await session.subscribe(haystack, watches);
  await session.unsubscribe(haystack, unwatches);
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
  print('CNS Haystack ' + pack.version);

  print('CNS Haystack on ' + config.CNS_SERVER_HOST + ' port ' + config.CNS_SERVER_PORT);
  print('CNS Dapr on ' + config.CNS_DAPR_HOST + ' port ' + config.CNS_DAPR_PORT);

  // No context?
  if (config.CNS_CONTEXT === '')
    throw new Error(E_CONTEXT);

  print('CNS context: ' + config.CNS_CONTEXT);

  print('Haystack server: ' + config.HAYSTACK_URI);
  print('Haystack auth: ' + ((config.HAYSTACK_USER === '')?'disabled':'enabled'));
  print('Haystack protocol: ' + config.HAYSTACK_VERSION + ', ' + config.HAYSTACK_FORMAT + ', ' + config.HAYSTACK_LEASE + ' lease, ' + config.HAYSTACK_POLL + ' poll');

  // Create session
  haystack = {
    uri: config.HAYSTACK_URI,
    username: config.HAYSTACK_USER,
    password: config.HAYSTACK_PASS,
    version: config.HAYSTACK_VERSION,
    content: config.HAYSTACK_FORMAT,
    lease: config.HAYSTACK_LEASE,
    poll: config.HAYSTACK_POLL
  };

  await session.start(haystack);

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

// Log text to console
global.print = (text) => {
  console.log(text);
}

// Log debug to console
global.debug = (text) => {
  if (options.debug)
    console.debug(text);
}

// Log error to console
global.error = (e) => {
  console.error('System Error:', e.message);
  debug(e.stack);
}

// Catch terminate signal
process.on('SIGINT', async () => {
  print('\rAborted.');

  await session.end(haystack);
  process.exit(1);
});

// Start application
start(process.argv.slice(2)).catch((e) => {
  error(e);
  process.exit(1);
});
