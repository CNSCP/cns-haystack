// grid.js - Haystack grid
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const pairs = require('./pairs');

const zinc = require('./content/zinc');
const json = require('./content/json');

// Errors

const E_CONTENT = 'Unsupported content type';

// Content types

//const C_CSV = 'text/csv';
//const C_XML = 'text/xml';
const C_ZINC = 'text/zinc';
const C_JSON = 'application/json';

// Convert

// Convert to query
function toQuery(req) {
  var query = '';

  const cx = pairs.getCols(req);

  for (var x = 0; x < cx; x++) {
    const name = pairs.getName(req, x);
    const value = pairs.getValue(req, x, 0);

    query += ((x === 0)?'?':'&') + encodeURIComponent(name);
    if (value !== '') query += '=' + encodeURIComponent(value);
  }
  return query;
}

// Convert to grid
function toGrid(req) {
  switch (req.content) {
    case C_ZINC: return zinc.toZinc(req);
    case C_JSON: return json.toJson(req);
  }
  throw new Error(E_CONTENT + ': ' + req.content);
}

// Revert from grid
function fromGrid(res) {
  switch (res.content) {
    case C_ZINC: return zinc.fromZinc(res);
    case C_JSON: return json.fromJson(res);
  }
  throw new Error(E_CONTENT + ': ' + res.content);
}

// Exports

exports.toQuery = toQuery;
exports.toGrid = toGrid;
exports.fromGrid = fromGrid;
