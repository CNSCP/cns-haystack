#!/usr/bin/env node

// haystack.html - Haystack client
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const colours = require('colors');
const tables = require('table');

const session = require('./src/session');
const pairs = require('./src/pairs');
const grid = require('./src/grid');

const pack = require('./package.json');

// Errors

const E_ILLEGAL = 'Illegal argument';
const E_MISSING = 'Missing argument';
const E_RANGE = 'Out of range';

// Local data

var options;

// Main entry point
async function main(args) {
  try {
    // Construct request
    const ses = {};
    const req = {};

    options = {};

    // Fetch next arg
    function next(arg) {
      if (args.length === 0)
        throw new Error(E_MISSING + ': ' + arg);

      return args.shift();
    }

    while (args.length > 0) {
      // Pop next arg
      const arg = args.shift();

      switch (arg) {
        case '-?':
        case '-h':
        case '--help':
          // Show usage
          usage();
          break;
        case '-v':
        case '--version':
          // Show version
          version();
          break;
        case '-u':
        case '--username':
          // Set username
          ses.username = next(arg);
          break;
        case '-p':
        case '--password':
          // Set password
          ses.password = next(arg);
          break;
        case '-t':
        case '--token':
          // Set token
          ses.token = next(arg);
          break;
        case '-k':
        case '--keepalive':
          // Keep session alive
          options.keepalive = true;
          break;
        case '-g':
        case '--get':
          // Use get method
          req.method = 'GET';
          break;
        case '-c':
        case '--content':
          // Set content type
          req.content = next(arg);
          break;
        case '-a':
        case '--accept':
          // Set accept type
          req.accept = next(arg);
          break;
        case '-x':
        case '--haystack':
          // Set haystack version
          req.version = next(arg);
          break;
        case '-r':
        case '--raw':
          // Output raw
          options.raw = true;
          break;
        case '-n':
        case '--names':
          // Output columns
          options.names = next(arg).split(',');
          break;
        case '-l':
        case '--limit':
          // Row limit
          options.limit = Number(next(arg));
          break;
        case '-i':
        case '--index':
          // Output index
          options.index = Number(next(arg));
          break;
        case '-m':
        case '--monochrome':
          // No colour mode
          colours.disable();
          break;
        case '-s':
        case '--silent':
          // Silent mode
          options.silent = true;
          break;
        case '-d':
        case '--debug':
          // Debug mode
          options.debug = true;
          break;
        default:
          // Unknoen flag?
          if (arg.startsWith('-'))
            throw new Error(E_ILLEGAL + ': ' + arg);

          // Set uri, op then grid
          if (ses.uri === undefined) ses.uri = arg;
          else if (req.op === undefined) req.op = arg;
          else {
            // Add grid value
            const parts = arg.split('=');

            const name = parts.shift() || '';
            const value = parts.join('=') || '';

            pairs.add(req, name, value);
          }
          break;
      }
    }

    // Start session
    await session.start(ses);

    // Get request
    const res = await session.request(ses, req);
    display(res);

    // Close session?
    if (options.keepalive)
      print(tables.table([['Token', ses.token]]));
    else await session.end(ses);
  } catch(e) {
    // Failure
    error(e);
    process.exit(1);
  }
}

// Output usage
function usage() {
  print('usage: haystack [options] uri [op] [name=value...]\n');

  print('Options:');
  print('  -h, --help                    Output usage information');
  print('  -v, --version                 Output version information');
  print('  -u, --username string         Set session username');
  print('  -p, --password string         Set session password');
  print('  -t, --token string            Set session token');
  print('  -k, --keepalive               Keep session token alive');
  print('  -g, --get                     Set request method');
  print('  -c, --content mime            Set request content type');
  print('  -a, --accept mime             Set request accept type');
  print('  -x, --haystack number         Set haystack version');
  print('  -r, --raw                     Output raw response');
  print('  -n, --names name,...          Output columns specified');
  print('  -l, --limit number            Output rows limit');
  print('  -i, --index number            Output row index');
  print('  -m, --monochrome              Disable console colours');
  print('  -s, --silent                  Disable console output');
  print('  -d, --debug                   Output debug information\n');

  print('Operations:');
  print('  about                         Read about information');
  print('  defs [filter] [limit]         Read configured definitions');
  print('  libs [filter] [limit]         Read installed libraries');
  print('  ops [filter] [limit]          Read avaliable operations');
  print('  filetypes [filter] [limit]    Read supported file types');
  print('  nav [navId]                   Read database navigation');
  print('  read filter [limit]           Read database records');
  print('  watchSub watchId [lease]      Watch subscribe');
  print('  watchUnsub watchId [close]    Watch unsubscribe');
  print('  watchPoll watchId [refresh]   Watch poll');
  print('  pointWrite id [val]           Write point priority array');
  print('  hisRead id [range]            Read time-series data');
  print('  hisWrite ts val               Write time-series data');
  print('  invokeAction id action        Invoke user action');
//  print('  eval                          Evaluate Axon expression');
//  print('  commit                        Commit diffs to Folio database');
  print('  close                         Close session\n');

  process.exit(1);
}

// Output version
function version() {
  console.log(pack.version);
  process.exit(1);
}

// Display results
function display(res) {
  // Output raw response?
  if (options.raw) {
    console.log(res.data);
    return;
  }

  // Convert from grid?
  const error = grid.fromGrid(res);

  if (error !== null) {
    print(tables.table([['Error', error]]));
    return;
  }

  // Reduce columns?
  if (options.names !== undefined)
    pairs.reduce(res, options.names);

  // Limit rows?
  if (options.limit !== undefined)
    pairs.limit(res, options.limit);

  // Format table data
  const data = [];

  const cx = pairs.getCols(res);
  const cy = pairs.getRows(res);

  // Ouput index only?
  const index = options.index;

  if (index !== undefined) {
    // In range?
    if (isNaN(index) || index < 0 || index >= cy)
      throw new Error(E_RANGE + ': ' + index);

    // Show index
    data.push(['Name', 'Value', 'Type']);

    for (var x = 0; x < cx; x++) {
      const name = pairs.getName(res, x);
      const raw = pairs.getRaw(res, x, index);
      const value = pairs.getValue(res, x, index);
      const type = pairs.getType(raw);

      data.push([name, value, type]);
    }
  } else {
    // Show names and values
    data.push(res.names);

    for (var y = 0; y < cy; y++) {
      const row = [];

      for (var x = 0; x < cx; x++)
        row.push(pairs.getValue(res, x, y));

      data.push(row);
    }
  }

  // Output table
  print(tables.table(data));
}

// Log text to console
function print(text) {
  if (!options.silent)
    console.log(text.green);
}

// Log debug to console
function debug(text) {
  if (options.debug)
    console.debug(text.magenta);
}

// Log error to console
function error(e) {
  console.error((options.debug?e.stack:('Error: ' + e.message)).red);
}

// Output debug
global.logDebug = function() {
  if (options.debug) console.debug.apply(null, arguments);
}

// Call main
main(process.argv.slice(2));
