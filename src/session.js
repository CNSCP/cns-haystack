// session.js - Haystack session
// Copyright 2025 Padi, Inc. All Rights Reserved.

// https://project-haystack.org/doc/docHaystack/HttpApi

'use strict';

// Imports

const auth = require('./auth');
const fetch = require('./fetch');
const grid = require('./grid');
const pairs = require('./pairs');

// Errors

const E_SESSION = 'Session not open';
const E_FAILED = 'Request failed';
const E_DURATION = 'Invalid duration';
const E_WATCH = 'No watch id';

// Defaults

const DEF_URI = 'http://localhost:8080/api';
const DEF_OP = 'about';
const DEF_METHOD = 'POST';
const DEF_CONTENT = 'text/zinc';
const DEF_VERSION = '3.0';
const DEF_WATCH = 'cns-haystack';
const DEF_LEASE = '1min';
const DEF_POLL = '5sec';

// Status

const S_OK = 200;
const S_FORBIDDEN = 403;

// Session

// Start haystack session
async function start(ses) {
  // Set defaults
  ses.uri = ses.uri || DEF_URI;

  // Reset stats
  ses.polls = 0;
  ses.updates = 0;
  ses.errors = 0;

  // Needs auth token?
  if (ses.token === undefined)
    ses.token = await auth.token(ses);

  // Session open
  debug('Haystack connected');
  ses.open = true;
}

// Send api request
async function request(ses, req) {
  // Not open?
  if (!ses.open)
    throw new Error(E_SESSION);

  // Set defaults
  req.op = req.op || DEF_OP;
  req.method = req.method || DEF_METHOD;
  req.content = req.content || ses.content || DEF_CONTENT;
  req.accept = req.accept || ses.accept || req.content;
  req.version = req.version || ses.version || DEF_VERSION;

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
  var res = await fetch.request(req.method, url, headers, body);
  var data = await fetch.response(res);

  // Forbidden?
  if (res.statusCode === S_FORBIDDEN) {
    // Using token?
    if (ses.token !== null && req.op !== 'close') {
      debug('Haystack expired');

      // Stop polling
      stopPoll(ses);

      // Destroy token
      delete ses.token;
      delete ses.watchId;

      // Re-connect
      await start(ses);

      // Re-watch
      const watches = ses.watches;
      delete ses.watches;

      await subscribe(ses, watches);

      // What op?
      switch (req.op) {
        case 'watchSub':
        case 'watchUnsub':
        case 'watchPoll':
          // Ignore watch
          debug('Haystack ignoring ' + req.op);
          return null;
      }

      // Update token
      headers['Authorization'] = 'BEARER authToken=' + ses.token;

      // Try again
      res = await fetch.request(req.method, url, headers, body);
      data = await fetch.response(res);
    }
  }

  // Decode response
  if (res.statusCode !== S_OK)
    throw new Error(E_FAILED + ': ' + res.statusMessage);

  // Create result
  const result = {
    content: fetch.header(res, 'content-type'),
    error: null,
    data: data
  };

  // Decode grid?
  if (req.raw) result.raw = true;
  else result.error = grid.fromGrid(result);

  return result;
}

// Watch subscribe request
async function subscribe(ses, watches) {
  // Nothing to add?
  if (watches === undefined ||
    Object.keys(watches).length === 0)
    return;

  try {
    const meta = {};

    // No watch?
    if (ses.watchId === undefined) {
      // Create new watch
      meta.watchDis = ses.watchDis || DEF_WATCH;
      meta.lease = ses.lease || DEF_LEASE;
    } else {
      // Add to watch
      meta.watchId = ses.watchId;
    }

    // Subscribe request
    const req = {
      accept: DEF_CONTENT,
      meta: meta,
      op: 'watchSub'
    };

    // Add watch ids
    if (ses.watches === undefined)
      ses.watches = {};

    for (const id in watches) {
      ses.watches[id] = watches[id];
      pairs.add(req, 'id', id);
    }

    // Get request
    const res = await request(ses, req);

    if (res !== null) {
      // Get watch response
      if (ses.watchId === undefined) {
        // Keep watch info
        const meta = res.meta || {};

        ses.watchId = meta.watchId;
        ses.lease = meta.lease || '1min';

        // Start poll
        startPoll(ses);
      }

      // Process updates
      watchUpdate(ses, res);
    }
  } catch(e) {
    // Failure
    ses.errors++;
    error(e);
  }
}

// Watch unsub request
async function unsubscribe(ses, watches) {
  // Nothing to remove?
  if (watches !== undefined &&
    Object.keys(watches).length === 0)
    return;

  try {
    // No watch id?
    if (ses.watchId === undefined)
      throw new Error(E_WATCH);

    const meta = {
      watchId: ses.watchId
    };

    // Close the lot?
    if (watches === undefined)
      meta.close = '';

    // Unsubscribe request
    const req = {
      accept: DEF_CONTENT,
      meta: meta,
      op: 'watchUnsub'
    };

    // Remove watch ids
    if (ses.watches === undefined)
      ses.watches = {};

    if (watches !== undefined) {
      for (const id in watches) {
        delete ses.watches[id];
        pairs.add(req, 'id', id);
      }
    } else pairs.add(req, 'id', '');

    // Get request
    const res = await request(ses, req);

    if (res !== null) {
      // Nothing to watch?
      if (watches === undefined ||
        Object.keys(ses.watches).length === 0) {
        // Stop polling
        stopPoll(ses);
        delete ses.watchId;
      }
    }
  } catch(e) {
    // Failure
    ses.errors++;
    error(e);
  }
}

// Watch poll request
async function watchPoll(ses) {
  try {
    // No watch id?
    if (ses.watchId === undefined)
      throw new Error(E_WATCH);

    // Poll request
    const req = {
      accept: DEF_CONTENT,
      meta: {
        watchId: ses.watchId
      },
      op: 'watchPoll'
    };

    // Refresh poll?
    if (ses.refresh) {
      req.meta.refresh = '';
      ses.refresh = false;
    }

    ses.polls++;

    // Get request
    const res = await request(ses, req);

    // Process updates
    if (res !== null)
      watchUpdate(ses, res);
  } catch (e) {
    // Failure
    ses.errors++;
    error(e);
  }

  // Next poll
  startPoll(ses);
}

// Update watch response
function watchUpdate(ses, res) {
  // Update stats
  if (res.error !== null) ses.errors++;
  ses.updates += pairs.getRows(res);

  // Master callback
  if (ses.watchFn !== undefined)
    ses.watchFn(res);

  // Process rows
  const cx = pairs.getCols(res);
  const cy = pairs.getRows(res);

  if (cx === 0 || cy === 0) return;

  const x = pairs.getCol(res, 'id');
  if (x === -1) return;

  for (var y = 0; y < cy; y++) {
    const pair = pairs.getValue(res, x, y);

    const parts = pair.split(' ');
    const id = parts[0];

    const watch = ses.watches[id];

    // Watch callback
    if (watch !== undefined && watch.watchFn !== undefined)
      watch.watchFn(watch, res, y);
  }
}

// Start poll timer
function startPoll(ses) {
  // Kill current
  stopPoll(ses);

  // Default poll time?
  if (ses.poll === undefined)
    ses.poll = DEF_POLL;

  // Next timer
  ses.timer = setTimeout(() => {
    delete ses.timer;
    watchPoll(ses);
  }, duration(ses.poll));
}

// Stop poll timer
function stopPoll(ses) {
  if (ses.timer !== undefined) {
    clearTimeout(ses.timer);
    delete ses.timer;
  }
}

// Get period in ms
function duration(value) {
  const parts = value.toString().split(/(\D+)/);

  const period = parts[0] | 0;
  const units = parts[1] || '';

  switch (units.toLowerCase()) {
    case 'h':
    case 'hr':
      // Hours
      return period * 1000 * 60 * 60;
    case 'm':
    case 'min':
      // Minutes
      return period * 1000 * 60;
    case 's':
    case 'sec':
      // Seconds
      return period * 1000;
    case 'ms':
    case '':
      // Milliseconds
      return period;
  }

  // Not valid
  throw new Error(E_DURATION + ': ' + value);
}

// End session
async function end(ses) {
  // Stop polling
  stopPoll(ses);

  // Close watch
  if (ses.watchId !== undefined)
    await unsubscribe(ses);

  // Has a token?
  if (ses.token !== null && ses.token !== undefined) {
    // Send close op
    const req = {
      accept: DEF_CONTENT,
      op: 'close'
    };

    // Get request
    const res = await request(ses, req);

    // Remove token
    delete ses.token;
  }

  // Session closed
  debug('Haystack disconnected');
  ses.open = false;
}

// Exports

exports.start = start;
exports.request = request;
exports.subscribe = subscribe;
exports.unsubscribe = unsubscribe;
exports.end = end;
