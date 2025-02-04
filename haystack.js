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
const E_WATCH = 'Nothing to watch';
const E_RANGE = 'Out of range';

// Local data

var options = {};
var haystack = {};

// Main entry point
async function main(args) {
  try {
    // Construct request
    const req = {};

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
          haystack.username = next(arg);
          break;
        case '-p':
        case '--password':
          // Set password
          haystack.password = next(arg);
          break;
        case '-t':
        case '--token':
          // Set token
          haystack.token = next(arg);
          break;
        case '-L':
        case '--lease':
          // Set lease period
          haystack.lease = next(arg);
          break;
        case '-P':
        case '--poll':
          // Set poll period
          haystack.poll = next(arg);
          break;
        case '-H':
        case '--haystack':
          // Set haystack version
          haystack.version = next(arg);
          break;
        case '-c':
        case '--content':
          // Set content type
          haystack.content = next(arg);
          break;
        case '-a':
        case '--accept':
          // Set accept type
          haystack.accept = next(arg);
          break;
        case '-g':
        case '--get':
          // Use get method
          req.method = 'GET';
          break;
        case '-r':
        case '--raw':
          // Output raw
          req.raw = true;
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
        case '-k':
        case '--keepalive':
          // Keep session alive
          options.keepalive = true;
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
          if (haystack.uri === undefined) haystack.uri = arg;
          else if (req.op === undefined) req.op = arg;
          else pairs.parse(req, arg);
          break;
      }
    }

    // What op?
    switch (req.op) {
      case 'watchSub':
        // Handle watch
        await watch(req);
        break;
      default:
        // Handle request
        await request(req);
        break;
    }
  } catch(e) {
    // Failure
    error(e);
    process.exit(1);
  }
}

// Output usage
function usage() {
  print('usage: haystack [options] uri [op] [name:value...] [name=value...]\n');

  print('Options:');
  print('  -h, --help                    Output usage information');
  print('  -v, --version                 Output version information');
  print('  -u, --username string         Set session username');
  print('  -p, --password string         Set session password');
  print('  -t, --token string            Set session token');
  print('  -L, --lease duration          Set watch lease period');
  print('  -P, --poll duration           Set watch poll period');
  print('  -H, --haystack number         Set haystack version');
  print('  -c, --content mime            Set request content type');
  print('  -a, --accept mime             Set request accept type');
  print('  -g, --get                     Set request method');
  print('  -r, --raw                     Output raw response');
  print('  -n, --names name,...          Output columns specified');
  print('  -l, --limit number            Output rows limit');
  print('  -i, --index number            Output row index');
  print('  -k, --keepalive               Keep session token alive');
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
  print('  watchSub [watchId] [lease]    Watch subscribe');
  print('  watchUnsub watchId [close]    Watch unsubscribe');
  print('  watchPoll watchId [refresh]   Watch poll');
  print('  pointWrite id [val]           Write point priority array');
  print('  hisRead id [range]            Read time-series data');
  print('  hisWrite ts val               Write time-series data');
  print('  invokeAction id action        Invoke user action');
  print('  close                         Close session\n');

  process.exit(1);
}

// Output version
function version() {
  console.log(pack.version);
  process.exit(1);
}

// Start session
async function start() {
  // Open session
  await session.start(haystack);
}

// Handle request
async function request(req) {
  // Start session
  await start();

  // Get request and display
  const res = await session.request(haystack, req);
  display(res);

  // End session
  await end();
}

// Handle watch
async function watch(req) {
  // Has valid grid?
  if (req.names === undefined || req.names[0] !== 'id')
    throw new Error(E_WATCH);

  // Setup watch
  const watches = {};

  for (const id of req.values[0]) {
    watches[id] = {
      id: id
    };
  }

  const meta = req.meta || {};

  haystack.watchDis = meta.watchDis;
  haystack.lease = meta.lease;
  haystack.watchFn = results;

  // Start session
  await start();

  // Start watching
  await session.subscribe(haystack, watches);
}

// End session
async function end() {
  // Keep alive?
  if (options.keepalive) {
    print(tables.table([['Token', haystack.token]]));
    return;
  }

  // Close session
  await session.end(haystack);
}

// Display results
function display(res) {
  // Output raw response?
  if (options.raw)
    process.stdout.write(res.data.green);

  // Grid error?
  if (res.error !== null) {
    process.stdout.write(tables.table([['Error', res.error]]).red);
    return;
  }

  // Raw only?
  if (options.raw) return;

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

  if (cx > 0) {
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
  } else data.push(['empty']);

  // Output table
  process.stdout.write(tables.table(data).green);
}

// Display watch results
function results(res) {
  cls();

  // Update screen
  const cols = process.stdout.columns;
  const lins = process.stdout.rows;

  // Output details?
  if (!options.debug) {
    process.stdout.write('Watch: ' + haystack.watchDis + ', ' + haystack.watchId + ', ' + haystack.lease + ' lease, ' + haystack.poll + ' poll.\n');
    process.stdout.write('Status: ' + haystack.polls + ' polls, ' + haystack.updates + ' updates, ' + haystack.errors + ' errors.\n\n');
  }

  // Display results
  display(res);

  // Output time?
  if (!options.debug) {
    const time = new Date().toLocaleTimeString();
    process.stdout.write('\u001b[0;' + (cols - 7) + 'H' + time + '\r');
  }
}

// Clear screen
function cls() {
  if (!options.silent && !options.debug)
    console.clear();
}

// Log text to console
global.print = (text) => {
  if (!options.silent)
    console.log(text.green);
}

// Log debug to console
global.debug = (text) => {
  if (options.debug)
    console.debug(text.magenta);
}

// Log error to console
global.error = (e) => {
  console.error(('System Error: ' + e.message).red);
  debug(e.stack);
}

// Catch terminate signal
process.on('SIGINT', async () => {
  cls();
  print('\rAborted.');

  try {
    await end();
  } catch (e) {
    // Failure
    error(e);
  }

  process.exit(1);
});

// Call main
main(process.argv.slice(2));
