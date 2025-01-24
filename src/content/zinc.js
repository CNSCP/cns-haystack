// zinc.js - Haystack zinc content
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const pairs = require('../pairs');

// Errors

const E_DATA = 'Failed to parse response';
const E_GRID = 'Response is not grid';

// Zinc content

// Convert to zinc
function toZinc(req) {
  var grid = 'ver:\"' + req.version + '\"\n';

  const cx = pairs.getCols(req);
  const cy = pairs.getRows(req);

  if (cx > 0) {
    grid += req.names.join(',') + '\n';

    for (var y = 0; y < cy; y++) {
      for (var x = 0; x < cx; x++)
        grid += ((x > 0)?',':'') + toType(pairs.getValue(req, x, y));

      grid += '\n';
    }
  } else grid += 'empty\n';

  return grid;
}

// Convert to zinc type
function toType(value) {
  if (value === undefined)
    return '';

  if (value === null)
    return 'M';

  if (value === true)
    return 'true';

  if (value === false)
    return 'false';

  if (typeof value === 'number')
    return value;

  if (typeof value === 'string') {
    if (isFinite(value))
      return value;

    if (value.startsWith('@'))
      return value;

    if (value.startsWith('^'))
      return value;

    if (value.startsWith('http'))
      return '`' + value + '`';

    return '"' + value + '"';
  }

  if (typeof value === 'object') {
    if (value instanceof Date)
      return value.toISOString(); // + timezone


  }
  return value;
}

// Convert from zinc
function fromZinc(res) {
  const lines = res.data.split('\n');
  const header = lines.shift() || '';

  if (!header.startsWith === 'ver')
    return E_DATA + ': ' + res.content;

  const meta = fromHeader(header);

  res.version = meta.ver;

  res.names = [];
  res.values = [];

  if (meta.err !== undefined)
    return meta.dis;

    //if (meta.incomplete)

  const cols = lines.shift() || '';

  if (cols === '') return E_GRID;
  if (cols === 'empty') return null;

  const names = cols.split(',');

  for (const name of names) {
    res.names.push(name)
    res.values.push([]);
  }

  while (lines.length > 0) {
    const row = lines.shift() || '';
    if (row === '') break;

    const values = fromRow(row);

    for (var n = 0; n < names.length; n++)
      pairs.add(res, names[n], values[n]);
  }
  return null;
}

// Convert zinc header
function fromHeader(line) {
  const meta = {};

  var l = line.length;
  var n = 0;

  while (n < l) {
    var name = '';
    var value = '';

    while (n < l && line[n] !== ':' && line[n] !== ' ')
      name += line[n++];

    if (n < l) {
      if (line[n++] === ':')
        value = fromParam(line, n, l);
    }

    if (name !== '')
      meta[name] = fromType(value);
  }
  return meta;
}

// Convert zinc row
function fromRow(line) {
  const values = [];

  var l = line.length;
  var n = 0;

  while (n < l) {
    var value = '';
    var q = false;

    while(n < l && (q || line[n] !== ',')) {
      if (line[n] === '"' || line[n] === '`' || line[n] === '(' || line[n] === ')' || line[n] === '[' || line[n] === ']' || line[n] === '{' || line[n] === '}') q = !q;
      value += line[n++];
    }

    if (line[n] === ',') n++;

    values.push(fromType(value));
  }
  return values;
}

// Convert zinc param
function fromParam(line, n, l) {
  var value = '';
  var q = false;

  while(n < l && (q || line[n] !== ' ')) {
    if (line[n] === '"' || line[n] === '`' || line[n] === '{' || line[n] === '}') q = !q;
    value += line[n++];
  }
  return value;
}

// Convert from zinc type
function fromType(value) {
  if (value === '')
    return undefined;

  if (value === 'M')
    return null;

  if (value === 'true')
    return true;

  if (value === 'false')
    return false;

  if (value.startsWith('"') || value.startsWith('`'))
    return value.substring(1, value.length - 1).replaceAll('\\n', '\n');

  if (value[10] === 'T' && value[23] === 'Z')
    return new Date(value.split(' ')[0]);

// geolocation
//  if (value.startsWith('C(') && value.endsWith(')'))

  return value;
}

// Exports

exports.toZinc = toZinc;
exports.fromZinc = fromZinc;
