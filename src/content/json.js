// json.js - Haystack json content
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const pairs = require('../pairs');

// Errors

const E_DATA = 'Failed to parse response';
const E_GRID = 'Response is not grid';

// Json content

// Convert to json
function toJson(req, names, values) {
  const cols = [];
  const rows = [];

  const cx = pairs.getCols(req);
  const cy = pairs.getRows(req);

  if (cx > 0) {
    for (var x = 0; x < cx; x++)
      cols.push({name: pairs.getName(req, x)});

    for (var y = 0; y < cy; y++) {
      const row = {};

      for (var x = 0; x < cx; x++)
        row[pairs.getName(req, x)] = toType(pairs.getRaw(req, x, y));

      rows.push(row);
    }
  } else cols.push({name: 'empty'});

  return JSON.stringify({
    _kind: 'grid',
    meta: {
      ver: req.version
    },
    cols: cols,
    rows: rows
  });
}

// Convert to json type
function toType(value) {
  if (value === undefined)
    return undefined;

  if (value === null) {
    return {
      _kind: 'marker'
    };
  }

  if (typeof value === 'number') {
    return {
      _kind: 'number',
      val: Number(value)
    }
  }

  if (typeof value === 'string') {
    if (isFinite(value)) {
      return {
        _kind: 'number',
        val: Number(value)
      }
    }

    if (value.startsWith('^')) {
      return {
        _kind: 'symbol',
        val: value.substr(1)
      }
    }

    if (value.startsWith('@')) {
      return {
        _kind: 'ref',
        val: value.substr(1)
      };
    }

    if (value.startsWith('http')) {
      return {
        _kind: 'uri',
        val: value//.substring(1, value.length - 1)
      }
    }
    return value;
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      return {
        _kind: 'dateTime',
        val: value.toISOString()
      };
    }


  }

/*
  if (typeof value === 'string') {
    return {
      _kind: 'uri',
      val: value
    };
  }
*/




  return value;
}

// Convert from json
function fromJson(res) {
  var data;

  try {
    data = JSON.parse(res.data);
  } catch(e) {
    return E_DATA + ': ' + res.content;
  }

  if (data._kind !== 'grid')
    return E_GRID;

  const meta = data.meta || {};
  const cols = data.cols || [];
  const rows = data.rows || [];

  res.version = meta.ver;

  res.names = [];
  res.values = [];

  if (meta.err !== undefined)
    return meta.dis;

  for (const col of cols) {
    res.names.push(col.name);
    res.values.push([]);
  }

  for (const row of rows)
  for (const col of cols)
    pairs.add(res, col.name, fromType(row[col.name]));

  return null;
}

// Convert from json type
function fromType(value) {
  if (value === undefined)
    return '';

  if (Array.isArray(value)) {
    const arr = [];

    for (const a of value)
      arr.push(fromType(a));

    return '[' + arr.join(',') + ']';
  }

  if (typeof value === 'object') {
    switch (value._kind) {
      case 'marker':
        return null;
      case 'symbol':
        return '^' + value.val;
      case 'ref':
        if (value.dis !== undefined)
          return '@' + value.val + ' "' + value.dis + '"';
        return '@' + value.val;
      case 'uri':
        return value.val;
      case 'number':
        if (value.unit !== undefined)
          return value.val + value.unit;
        return value.val;
      case 'coord':
        return {
          toString: () => {return 'C(' + value.lat + ',' + value.lng + ')';},
          lat: value.lat,
          lon: value.lng
        };
      case 'dateTime':
        return new Date(value.val);//value.val + ' ' + value.tz;
    }
  }
  return value;
}

// Exports

exports.toJson = toJson;
exports.fromJson = fromJson;
