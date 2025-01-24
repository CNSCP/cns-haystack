// pairs.js - Name / value pairs
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Value pairs

//
function parse(req, s) {
  //
  if (typeof s !== 'string' || s === '') return;

  const params = s.split(',');

  for (const param of params) {
    const parts = param.split('=');

    const name = parts.shift() || '';
    const value = parts.join('=') || '';

    add(req, name, value);
  }
}

// Add value
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

// Get typeof value
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

exports.parse = parse;
exports.add = add;
exports.reduce = reduce;
exports.limit = limit;
exports.clear = clear;

exports.getCols = getCols;
exports.getRows = getRows;

exports.getName = getName;
exports.getRaw = getRaw;
exports.getValue = getValue;
exports.getType = getType;
