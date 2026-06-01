

# `qweb3.js` — Quantova Post-Quantum Web3 Client SDK

> JavaScript and TypeScript client library for the **Quantova Layer 1 blockchain**, natively secured by Post-Quantum Cryptography (PQC).

[![NPM Version](https://img.shields.io/npm/v/qweb3.js?color=blue&style=flat-square)](https://www.npmjs.com/package/qweb3.js)
[![License](https://img.shields.io/npm/l/qweb3.js?color=green&style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-node%20%7C%20browser-orange?style=flat-square)](https://github.com/Quantova)

`qweb3.js` is the developer-facing client for Quantova. It signs with NIST post-quantum
signature schemes (Falcon, Dilithium, SPHINCS+), speaks the chain's `q_*` JSON-RPC
namespace, encodes and decodes QVM (Solidity-on-PolkaVM) contract calls, resolves `.q`
names, and reads the same data through the public REST gateway when you prefer HTTP.

---

## Key Features

* **Quantum-safe primitives** — key generation, signing, and verification using **Falcon**, **Dilithium**, and **SPHINCS+**.
* **Unified Q-RPC namespace** — native support for the **28 `q_*` RPC methods** covering blocks, balances, transaction counts, logs, fees, and extrinsic broadcast.
* **QVM contract layer** — instantiate Solidity-on-QVM contracts and run `.call()` / `.send()` with a standard Solidity ABI encoder/decoder (keccak-256 selectors) and human-readable event-log decoding.
* **QNS name service** — resolve and register post-quantum `.q` domains through the on-chain QVM registry contract.
* **Dynamic fee & gas oracle** — slow / standard / fast tiers derived from recent `q_feeHistory` activity.
* **Batch portal** — group many `q_*` calls into a single JSON-RPC payload.
* **Unified event hooks** — real-time block streaming plus per-transaction `pending → receipt → confirmed` tracking.
* **REST fallback** — every read can fall back to the Quantova public REST gateway (`/v1/...`).
* **CLI toolbelt** — `qweb3-cli` generates PQC wallets, inspects addresses, and calls a node from the terminal.
* **Hybrid addressing** — handles both legacy hex (`0x...`) and Quantova Base64 H160 addresses.
* **Dual delivery & typings** — ships as CommonJS (`.js`), ES modules (`.mjs`), and TypeScript definitions (`index.d.ts`).

---

## Project Layout

```bash
qweb3.js/
├── src/
│   ├── abi/             # Solidity ABI encoder/decoder (keccak-256 selectors)
│   ├── batch/           # Batch request portal (one JSON-RPC payload, many calls)
│   ├── cli/             # qweb3-cli executable toolbelt
│   ├── contract/        # QVM smart-contract class: .call/.send + event-log decoding
│   ├── errors/          # Structured SDK error definitions (Connection, Rpc, InvalidArg, Tx)
│   ├── events/          # WebSocket subscription manager
│   ├── fee/             # Dynamic fee & gas oracle
│   ├── hooks/           # Unified event hooks (blocks + transaction lifecycle)
│   ├── provider/        # BrowserProvider (injected) & RpcProvider (HTTP)
│   ├── qns/             # QNS .q name registrar & resolver
│   ├── rest/            # REST gateway client (quantova-rest-api /v1 surface)
│   ├── rpc/             # Q-RPC client (q_* namespace)
│   ├── signer/          # Post-quantum sign/verify wrappers (Falcon, Dilithium, SPHINCS+)
│   ├── utils/           # Address derivation, math formatting, hex conversions
│   └── wallet/          # PQ account/keyring manager
├── tests/               # Modular unit-test suites
├── index.js             # CommonJS entrypoint
├── index.mjs            # ES module entrypoint
├── index.d.ts           # TypeScript type definitions
├── test.js              # Test runner
└── package.json
```

---

## Installation

```bash
npm install qweb3.js
```

The SDK depends on the Quantova packages `@quantova/api`, `@quantova/keyring`,
`@quantova/util`, `@quantova/util-crypto`, `@quantova/rpc-provider`, and
`@quantova/falcon-wasm`, plus `axios`.

---

## Quick Start

### 1. One client for everything

```javascript
const { QWeb3 } = require('qweb3.js');

// JSON-RPC primary; pass restUrl to enable the REST gateway as a readable fallback.
const q = new QWeb3('http://127.0.0.1:9944', { restUrl: 'http://127.0.0.1:8080' });

const block = await q.rpc.blockNumber();
const fees  = await q.fees.estimate();
console.log({ block, standardTip: fees.tiers.standard });
```

### 2. Post-quantum wallet & signing

```javascript
const { QuantumWallet, QuantumSigner } = require('qweb3.js');

const wallet = new QuantumWallet();
const account = wallet.create('falcon');           // 'falcon' | 'dilithium' | 'sphincsp'
console.log('Address:   ', account.address);
console.log('Public key:', account.publicKey);

const message = 'Quantova post-quantum extrinsic';
const signatureHex = wallet.signTransaction(message, account.address);

const valid = QuantumSigner.verify(message, signatureHex, account.publicKey, 'falcon');
console.log('Verified:', valid);
```

### 3. Querying the node via Q-RPC

```javascript
const { QRpcClient } = require('qweb3.js');

const client = new QRpcClient('http://127.0.0.1:9944');

const blockNumber = await client.blockNumber();
const balance = await client.getBalance('QOuhXUELsRC0/zow/Vjwft8hNP8=');
console.log({ blockNumber, balance });
```

> RPC methods are exposed with friendly names (`blockNumber()`, `getBalance()`,
> `getTransactionReceipt()`, …), each mapping to its `q_*` JSON-RPC method. Use
> `client.call('q_<method>', [params])` for anything not wrapped explicitly.

### 4. QVM smart contracts

```javascript
const { QWeb3 } = require('qweb3.js');
const q = new QWeb3('http://127.0.0.1:9944', { restUrl: 'http://127.0.0.1:8080' });

const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { type: 'event', name: 'Transfer', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false } ] },
];

const token = q.contract(erc20Abi, '0xYourTokenAddress');

// Read (q_call, REST fallback) — decoded automatically:
const bal = await token.call('balanceOf', ['0xHolderAddress']);

// Write (built, post-quantum signed by the wallet, then broadcast):
const account = q.wallet.create('falcon');
const txHash = await token.send('transfer', ['0xRecipient', 1000n], { from: account.address });

// Decode logs from a receipt into readable events:
const receipt = await q.rpc.getTransactionReceipt(txHash);
const events = token.decodeLogs(receipt.logs);  // [{ name:'Transfer', args:{from,to,value}, ... }]
```

> **Write path note:** `.send()` builds a post-quantum-signed extrinsic via the
> wallet's `buildAndSignContractTx()` (provided by the `@quantova` API layer). If
> your build doesn't expose it, use `token.encode('transfer', [...])` to get the
> calldata and submit a signed transaction yourself.

### 5. ABI encoder / decoder

```javascript
const { AbiCodec } = require('qweb3.js');

AbiCodec.functionSelector('transfer(address,uint256)');   // '0xa9059cbb'
AbiCodec.eventTopic('Transfer(address,address,uint256)');  // '0xddf2...3b3ef'

const data = AbiCodec.encodeFunctionCall(
  { name: 'transfer', inputs: [{ type: 'address' }, { type: 'uint256' }] },
  ['0x1111111111111111111111111111111111111111', 1000n]
);
const value = AbiCodec.decodeParameters(['uint256'], '0x...')[0];
```

### 6. QNS — `.q` name service

```javascript
const q = new (require('qweb3.js').QWeb3)('http://127.0.0.1:9944');
const qns = q.qns('0xYourQnsRegistryAddress');

const addr  = await qns.resolve('alice.q');   // -> address or null
const owner = await qns.owner('alice.q');
const name  = await qns.reverse('0xSomeAddress');

// Registration / records require a wallet:
// await qns.register('alice.q', ownerAddress, { from: ownerAddress });
// await qns.setAddr('alice.q', targetAddress, { from: ownerAddress });
```

> The default registry ABI follows the conventional resolver/registrar shape
> (namehash node keys). If your deployed registry uses different method names,
> pass a custom ABI: `q.qns(registryAddress, { abi: myRegistryAbi })`.

### 7. Dynamic fees & gas

```javascript
const fees = await q.fees.estimate();
// { baseFeePerGas, maxPriorityFeePerGas, maxFeePerGas, tiers: { slow, standard, fast }, model }

const txFee = await q.fees.estimateForTx({ from, to, data });
// { gas, effectiveGasPrice, fee, feeWei, ... }
```

### 8. Batch requests

```javascript
const { BatchRequest } = require('qweb3.js');

const batch = new BatchRequest('http://127.0.0.1:9944');
batch.add('q_blockNumber')
     .add('q_getBalance', ['QOuhXUELsRC0/zow/Vjwft8hNP8=', 'latest'])
     .add('q_gasPrice');

const results = await batch.execute();   // [{ success, result }, ...] in insertion order
```

### 9. Unified event hooks

```javascript
const q = new (require('qweb3.js').QWeb3)('http://127.0.0.1:9944');

await q.hooks.startBlocks();
q.hooks.on('block', (header) => console.log('new head', header.number));

const tracker = q.hooks.track(txHash);
tracker.on('receipt',   (r) => console.log('mined in', r.blockNumber))
       .on('confirmed', (r) => console.log('confirmed'))
       .on('failed',    (r) => console.log('reverted'));

// Or await it:
const receipt = await q.hooks.waitForReceipt(txHash);
```

### 10. REST gateway access

```javascript
const { QRestClient } = require('qweb3.js');

const rest = new QRestClient('http://127.0.0.1:8080');
const balance = await rest.getBalance('QOuhXUELsRC0/zow/Vjwft8hNP8=');
const latest  = await rest.blockLatest();
const fees    = await rest.feesEstimate();
```

---

## CLI Toolbelt (`qweb3-cli`)

After installing, the `qweb3-cli` command is available (or run `npx qweb3-cli` / `npm run cli --`):

```bash
# Wallets
qweb3-cli wallet new --scheme falcon
qweb3-cli wallet from-seed 0x<32-byte-seed> --scheme dilithium
qweb3-cli wallet from-mnemonic "word word word ..." --scheme sphincsp

# Addresses
qweb3-cli address inspect QOuhXUELsRC0/zow/Vjwft8hNP8=
qweb3-cli address from-pubkey 0x<publickey>

# Crypto
qweb3-cli sign "message" --seed 0x<seed> --scheme falcon
qweb3-cli verify "message" --sig 0x<sig> --pub 0x<pub> --scheme falcon

# Node (JSON-RPC, --url defaults to http://127.0.0.1:9944)
qweb3-cli rpc q_blockNumber
qweb3-cli block latest
qweb3-cli balance QOuhXUELsRC0/zow/Vjwft8hNP8=
qweb3-cli fees

# REST gateway (--rest defaults to http://127.0.0.1:8080)
qweb3-cli rest get /gas-price
qweb3-cli rest post /transactions/call '{"to":"0x...","data":"0x..."}'
```

Add `--json` to any command for raw JSON output.

---

## Transport model

The contract, QNS, fee, and hook modules use **JSON-RPC (`q_*`) as the primary
transport** and fall back to the **REST gateway** when a `restClient` / `restUrl`
is configured. Construct `QWeb3(url, { restUrl })` to enable the fallback, or pass
`restClient` directly to individual modules.

A note on hashing: QVM contract **selectors** use keccak-256 (standard Solidity
ABI). This is independent of Quantova's transaction/state hashing (SHA3-256),
which is applied in the signing layer.

---

## Running Tests

```bash
npm test
```

---

## License

Licensed under the Apache-2.0 License — see [LICENSE](LICENSE).
