// auth.js - Haystack auth
// Copyright 2025 Padi, Inc. All Rights Reserved.

// https://bitbucket.org/skyfoundry/haystack-auth-node/src/master/crypto/MyCrypto.js
// https://bitbucket.org/skyfoundry/haystack-auth-node/src/master/auth/AuthClientContext.js

'use strict';

// Imports

const crypto = require('./crypto').crypto;
const fetch = require('./fetch');

// Errors

const E_HELLO = 'Failed to announce user';
const E_HEADER = 'Missing response header';
const E_METHOD = 'Unsupported auth method';
const E_HASH = 'Unsupported hash function';
const E_FIRST = 'Failed client first message';
const E_AUTH = 'Failed to authenticate';
const E_TOKEN = 'Failed to receive token';

// Status

const S_OK = 200;
const S_UNAUTHORIZED = 401;

// Auth

// Get auth token
async function token(ses) {
  // No login specified?
  if (ses.username === undefined || ses.username === '' ||
    ses.password === undefined || ses.password === '')
    return null;

  // Send hello
  const res = await request(ses, {
    'Authorization': 'HELLO username=' + crypto.rstr2b64uri(ses.username)
  });

  // Decode response
  if (res.statusCode !== S_UNAUTHORIZED)
    throw new Error(E_HELLO + ': ' + res.statusMessage);

  // Get auth methods
  const auth = fetch.header(res, 'www-authenticate');
  const methods = fetch.methods(auth);

  // Supports scram?
  if (methods.scram !== undefined)
    return await getScram(ses, methods.scram);

  // Supports plaintext?
  if (methods.plaintext !== undefined)
    return await getPlaintext(ses, methods.plaintext);

  // Unsupported method
  throw new Error(E_METHOD + ': ' + Object.keys(methods).join(', '));
}

// Get scam method
async function getScram(ses, scram) {
  // Send client first message
  const hash = getHash(scram.hash);
  const nonce = crypto.nonce(24);

  // Construct request
  var data = 'data=' + crypto.rstr2b64uri('m,,n=' + ses.username + ',r=' + nonce);

  if (scram.handshakeToken !== undefined)
    data += ', handshakeToken=' + scram.handshakeToken;

  const res = await request(ses, {
    'Authorization': 'SCRAM ' + data
  });

  // Decode response
  if (res.statusCode !== S_UNAUTHORIZED)
    throw new Error(E_FIRST + ': ' + res.statusMessage);

  const auth = fetch.header(res, 'www-authenticate');
  const methods = fetch.methods(auth);

  // Get final message
  return await getScramFinal(ses, nonce, methods.scram);
}

// Get scram method
async function getScramFinal(ses, nonce, scram) {
  // Send client final message
  const hash = getHash(scram.hash);
  const bits = getBits(scram.hash);

  const msg = Buffer.from(scram.data, 'base64').toString('utf8');
  const params = fetch.parameters(msg);

  // Construct proof
  const noproof = 'c=' + crypto.rstr2b64uri('m,,') + ',r=' + params.r;

  const salt = Buffer.from(params.s, 'base64').toString('binary');
  const iterations = parseInt(params.i);

  const clientKey = hash('Client Key', crypto.pbkdf2_hmac_sha256(ses.password, salt, iterations, bits));
  const storedKey = hash(clientKey);
  const clientSig = hash('n=' + ses.username + ',r=' + nonce + ',' + msg + ',' + noproof, storedKey);

  const proof = crypto.rstr2b64(crypto.xor(clientKey, clientSig));

  // Construct request
  var data = 'data=' + crypto.rstr2b64uri(noproof + ',p=' + proof);

  if (scram.handshakeToken !== undefined)
    data += ', handshakeToken=' + scram.handshakeToken;

  const res = await request(ses, {
    'Authorization': 'SCRAM ' + data
  });

  // Get token from response
  return getToken(res);
}

// Get hash function
function getHash(hash) {
  if (hash !== undefined) {
    switch (hash.toLowerCase()) {
      case "sha-1": return crypto.sha1;
      case "sha-256": return crypto.sha256;
    }
  }
  throw new Error(E_HASH + ': ' + hash);
}

// Get hash bits
function getBits(hash) {
  if (hash !== undefined) {
    switch (hash.toLowerCase()) {
      case 'sha-1': return 20;
      case 'sha-256': return 32;
    }
  }
  throw new Error(E_HASH + ': ' + hash);
}

// Get plaintext method
async function getPlaintext(ses, plaintext) {
  // Send plaintext login
  const res = await request(ses, {
    'Authorization': 'PLAINTEXT ' +
      'username=' + crypto.rstr2b64uri(ses.username) + ', ' +
      'password=' + crypto.rstr2b64uri(ses.password)
  });

  // Get token from response
  return getToken(res);
}

// Get token from response
function getToken(res) {
  // Decode response
  if (res.statusCode !== S_OK)
    throw new Error(E_AUTH + ': ' + res.statusMessage);

  const auth = fetch.header(res, 'authentication-info');
  const params = fetch.parameters(auth);

  // No auth token?
  if (params.authToken === undefined)
    throw new Error(E_TOKEN);

  return params.authToken;
}

// Send auth request
async function request(ses, headers) {
  const url = ses.uri + '/about/';

  const res = await fetch.request('GET', url, headers);
  const data = await fetch.response(res);

  return res;
}

// Exports

exports.token = token;
