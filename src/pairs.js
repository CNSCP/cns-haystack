// pairs.js - Name and value pairs
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Value pairs

// Parse values
function parse(req, s) {
  // Not valid?
  if (typeof s !== 'string' || s === '') return;

  // Split params
  const params = s.split(',');

  for (const param of params) {
    // Split pair
    const sep = param.includes(':')?':':'=';
    const parts = param.split(sep);

    const name = parts.shift() || '';
    const value = parts.join(sep) || '';

    // Add value
    if (sep === ':') meta(req, name, value);
    else add(req, name, value);
  }
}

// Add meta value
function meta(req, name, value) {
  // Create meta?
  if (req.meta === undefined) req.meta = {};
  req.meta[name] = value;
}

// Add grid value
function add(req, name, value) {
  // Create containers?
  if (req.names === undefined) req.names = [];
  if (req.values === undefined) req.values = [];

  // Name exists?
  var index = req.names.indexOf(name);

  if (index === -1) {
    // No, create it
    index = req.names.length;

    req.names.push(name);
    req.values.push([]);
  }

  // Add value to name
  req.values[index].push(value);
}

// Reduce columns
function reduce(req, columns) {
  const cx = getCols(req);

  for (var x = cx - 1; x >= 0; x--) {
    // Not valid?
    if (!columns.includes(getName(req, x))) {
      // Remove column
      req.names.splice(x, 1);
      req.values.splice(x, 1);
    }
  }
}

// Limit rows
function limit(req, rows) {
  const cx = getCols(req);

  for (var x = 0; x < cx; x++) {
    // Clamp value array
    if (res.values[x].length > rows)
      res.values[x].length = rows;
  }
}

// Clear all values
function clear(req) {
  // Delete containers
  delete req.names;
  delete req.values;
}

// Get total columns
function getCols(req) {
  return (req.names === undefined)?0:req.names.length;
}

// Get total rows
function getRows(req) {
  var cy = 0;

  if (req.values !== undefined) {
    // Find longest value array
    const cx = getCols(req);

    for (var x = 0; x < cx; x++)
      cy = Math.max(req.values[x].length, cy);
  }
  return cy;
}

// Get column index
function getCol(req, name) {
  for (var x = 0; x < req.names.length; x++)
    if (req.names[x] === name) return x;

  return -1;
}

// Get row data
function getRow(req, y) {
  var value = '';

  for (var x = 0; x < req.names.length; x++) {
    if (x > 0) value += ',';
    value += getValue(req, x, y);
  }
  return value;
}

// Get name of column
function getName(req, x) {
  return req.names[x];
}

// Get raw value of row
function getRaw(req, x, y) {
  return req.values[x][y];
}

// Get value of row
function getValue(req, x, y) {
  const value = getRaw(req, x, y);
  return (value === undefined)?'':value;
}

// Get type of value
function getType(raw) {
  switch (typeof raw) {
    case 'undefined':
      return 'Marker';
    case 'boolean':
      return 'Bool';
    case 'string':
      if (raw.startsWith('[')) return 'Array';
      if (raw.startsWith('^')) return 'Symbol';
      if (raw.startsWith('@')) return 'Reference';
      if (raw.startsWith('http')) return 'URI';
      return 'String';
    case 'number':
      return 'Number';
    case 'object':
      if (raw === null) return 'Marker';
      if (raw instanceof Date) return 'DateTime';
      return 'Dictionary';
  }
  return '?';
}

// Exports

exports.meta = meta;

exports.parse = parse;
exports.add = add;
exports.reduce = reduce;
exports.limit = limit;
exports.clear = clear;

exports.getCols = getCols;
exports.getRows = getRows;
exports.getCol = getCol;
exports.getRow = getRow;

exports.getName = getName;
exports.getRaw = getRaw;
exports.getValue = getValue;
exports.getType = getType;
