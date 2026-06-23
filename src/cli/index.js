#!/usr/bin/env node
// src/cli/index.js
//
// qweb3-cli — Interactive CLI Toolbelt.
//
// Generate post-quantum wallets, inspect addresses, and call a Quantova node
// directly from the terminal. Uses only the qweb3.js library and Node built-ins.
//
// Usage:
//   qweb3-cli wallet new [--scheme falcon|dilithium|sphincsp]
//   qweb3-cli wallet from-seed <QSEC1...|0xseed> [--scheme ...]
//   qweb3-cli wallet from-mnemonic "<words>" [--scheme ...]
//   qweb3-cli address inspect <Q1...|0xcontract>
//   qweb3-cli address from-pubkey <QPUB1...|hexpubkey>
//   qweb3-cli sign <message> --seed <QSEC1...|0xseed> [--scheme ...]
//   qweb3-cli verify <message> --sig <0xsig> --pub <QPUB1...|hexpub> [--scheme ...]
//   qweb3-cli rpc <q_method> [params-json] [--url http://127.0.0.1:9944]
//   qweb3-cli block [number|latest|finalized] [--url ...]
//   qweb3-cli balance <address> [--url ...]
//   qweb3-cli fees [--url ...]
//   qweb3-cli rest <get|post> <path> [body-json] [--rest http://127.0.0.1:8080]
//
// Global flags: --url <jsonrpc>, --rest <rest-gateway>, --json (raw JSON output)

'use strict';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function out(obj, asJson) {
  if (asJson) {
    console.log(JSON.stringify(obj, null, 2));
  } else if (typeof obj === 'string') {
    console.log(obj);
  } else {
    console.log(JSON.stringify(obj, null, 2));
  }
}

function loadLib() {
  // Resolve the library relative to this file so the CLI works in-tree and when installed.
  try {
    return require('../../index.js');
  } catch (e) {
    return require('qweb3.js');
  }
}

const HELP = `qweb3-cli — Quantova post-quantum CLI toolbelt

Wallet:
  wallet new [--scheme falcon|dilithium|sphincsp]
  wallet from-seed <QSEC1...|0xseed> [--scheme ...]
  wallet from-mnemonic "<words>" [--scheme ...]

Address:
  address inspect <Q1...|0xcontract>
  address from-pubkey <QPUB1...|hexpubkey>

Crypto:
  sign <message> --seed <QSEC1...|0xseed> [--scheme ...]
  verify <message> --sig <0xsig> --pub <QPUB1...|hexpub> [--scheme ...]

Node (JSON-RPC, --url, default http://127.0.0.1:9944):
  rpc <q_method> [params-json]
  block [number|latest|finalized]
  balance <address>
  fees

REST gateway (--rest, default http://127.0.0.1:8080):
  rest <get|post> <path> [body-json]

Global flags: --url <jsonrpc>  --rest <gateway>  --json  --scheme <scheme>`;

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, sub, ...rest] = positional;
  const asJson = !!flags.json;
  const scheme = flags.scheme || 'falcon';
  const url = flags.url || 'http://127.0.0.1:9944';
  const restUrl = flags.rest || 'http://127.0.0.1:8080';

  if (!command || command === 'help' || flags.help) {
    out(HELP, false);
    return;
  }

  const lib = loadLib();

  switch (command) {
    case 'wallet': {
      const { QuantumWallet } = lib;
      const wallet = new QuantumWallet();
      let account;
      if (sub === 'new') {
        account = wallet.create(scheme);
      } else if (sub === 'from-seed') {
        if (!rest[0]) throw new Error('from-seed requires a QSEC1... key or 0x seed');
        account = wallet.importPrivateKey(rest[0], scheme);
      } else if (sub === 'from-mnemonic') {
        if (!rest[0]) throw new Error('from-mnemonic requires a quoted phrase');
        account = wallet.importMnemonic(rest[0], scheme);
      } else {
        throw new Error(`unknown wallet subcommand '${sub}' (new|from-seed|from-mnemonic)`);
      }
      const revealKey = flags['show-private-key'] === true || flags['unsafe'] === true;
      const result = { address: account.address, scheme: account.scheme, publicKey: account.publicKey };
      // New wallet: show the recovery phrase (the backup) by default; never dump the raw QSEC1
      // private key unless explicitly requested with --show-private-key. (QW3-KEY-003)
      if (sub === 'new' && account.mnemonic) result.mnemonic = account.mnemonic;
      if (revealKey) result.privateKey = account.privateKey;
      result.warning = (result.mnemonic || result.privateKey)
        ? 'SECRET shown above - store it offline; never paste it into logs, chat, CI, or a recorded terminal. Anyone with it controls this account.'
        : 'Private key hidden. Re-run with --show-private-key to reveal it (handle with care).';
      out(result, asJson);
      return;
    }

    case 'address': {
      const { AddressUtils } = lib;
      if (sub === 'inspect') {
        const addr = rest[0];
        if (!addr) throw new Error('address inspect requires an address');
        out({
          address: addr,
          isValid: AddressUtils.isAddress(addr),
          isQuantovaAccount: /^(Q1|q1)/.test(addr) && AddressUtils.isAddress(addr),
          isContractAddress: /^0x[a-fA-F0-9]{40}$/.test(addr),
        }, asJson);
      } else if (sub === 'from-pubkey') {
        const pk = rest[0];
        if (!pk) throw new Error('address from-pubkey requires a public key (hex or QPUB1...)');
        out({ address: AddressUtils.deriveAddressFromPublicKey(pk) }, asJson);
      } else {
        throw new Error(`unknown address subcommand '${sub}' (inspect|from-pubkey)`);
      }
      return;
    }

    case 'sign': {
      const { QuantumSigner } = lib;
      const message = sub; // first positional after command
      if (!message) throw new Error('sign requires a <message>');
      if (!flags.seed) throw new Error('sign requires --seed <QSEC1...|0xseed>');
      const sig = QuantumSigner.sign(message, flags.seed, scheme);
      const { u8aToHex } = lib;
      out({ scheme, signature: u8aToHex(sig) }, asJson);
      return;
    }

    case 'verify': {
      const { QuantumSigner } = lib;
      const message = sub;
      if (!message) throw new Error('verify requires a <message>');
      if (!flags.sig || !flags.pub) throw new Error('verify requires --sig and --pub');
      const valid = QuantumSigner.verify(message, flags.sig, flags.pub, scheme);
      out({ scheme, valid }, asJson);
      return;
    }

    case 'rpc': {
      const QRpcClient = lib.QRpcClient;
      const client = new QRpcClient(url);
      const method = sub;
      if (!method) throw new Error('rpc requires a <q_method>');
      let params = [];
      if (rest[0]) {
        try { params = JSON.parse(rest[0]); } catch (e) { throw new Error('params must be valid JSON array'); }
      }
      const result = await client.call(method, params);
      out(result, asJson);
      return;
    }

    case 'block': {
      const QRpcClient = lib.QRpcClient;
      const client = new QRpcClient(url);
      const which = sub || 'latest';
      let result;
      if (which === 'latest') {
        const n = await client.blockNumber();
        result = await client.getBlockByNumber(n, false);
      } else if (which === 'finalized') {
        // finalized head via standard substrate RPC then fetch by hash
        const hash = await client.call('chain_getFinalizedHead', []);
        result = await client.getBlockByHash(hash, false);
      } else {
        result = await client.getBlockByNumber(which.startsWith('0x') ? which : '0x' + BigInt(which).toString(16), false);
      }
      out(result, asJson);
      return;
    }

    case 'balance': {
      const QRpcClient = lib.QRpcClient;
      const client = new QRpcClient(url);
      if (!sub) throw new Error('balance requires an address');
      const bal = await client.getBalance(sub, 'latest');
      out({ address: sub, balance: bal }, asJson);
      return;
    }

    case 'fees': {
      const QRpcClient = lib.QRpcClient;
      const FeeOracle = lib.FeeOracle;
      const oracle = new FeeOracle({ rpc: new QRpcClient(url) });
      const est = await oracle.estimate();
      out(est, asJson);
      return;
    }

    case 'rest': {
      const QRestClient = lib.QRestClient;
      const client = new QRestClient(restUrl);
      const verb = (sub || '').toLowerCase();
      const path = rest[0];
      if (!path) throw new Error('rest requires a <path>, e.g. /gas-price');
      // Use the generic underscore helpers via a tiny shim:
      const axios = require('axios');
      const full = restUrl.replace(/\/+$/, '') + (path.startsWith('/v1') || path === '/healthz' ? path : '/v1' + path);
      let result;
      if (verb === 'get') {
        result = (await axios.get(full)).data;
      } else if (verb === 'post') {
        let body = {};
        if (rest[1]) { try { body = JSON.parse(rest[1]); } catch (e) { throw new Error('body must be valid JSON'); } }
        result = (await axios.post(full, body, { headers: { 'content-type': 'application/json' } })).data;
      } else {
        throw new Error("rest verb must be 'get' or 'post'");
      }
      out(result, asJson);
      return;
    }

    default:
      out(`Unknown command '${command}'.\n\n` + HELP, false);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
