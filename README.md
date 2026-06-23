# qweb3.js

**Quantova Post-Quantum Web3 Client SDK** — the easiest way to build on
**[Quantova](https://quantova.org)**, a post-quantum Layer-1 blockchain.

Connect to a node, create and manage post-quantum accounts, sign and broadcast
transactions, read balances, and deploy/interact with **QVM** smart contracts — all
with quantum-resistant cryptography.

## Quantum security

Quantova replaces classical ECDSA with **NIST post-quantum signatures** — **Falcon**,
**SPHINCS+** and **CRYSTALS-Dilithium** — plus **SHA3-256** hashing. Accounts are
resistant to quantum attacks (Shor's algorithm breaks ECDSA/RSA; lattice- and
hash-based signatures are designed to withstand it). Addresses are **Bech32m `Q1…`**
and the chain speaks **`q_*` JSON-RPC**.

## Install

```bash
npm install qweb3.js
```

## Quick start

```js
import { QWeb3 } from 'qweb3.js';

// connect to a Quantova node (https or wss)
const q = new QWeb3('https://rpc.quantova.org');

// create a post-quantum account (Falcon by default)
const account = q.wallet.create();   // { address: 'Q1...', mnemonic, publicKey, privateKey, scheme }

// read a balance over the q_ JSON-RPC
const balance = await q.rpc.getBalance(account.address);
```

> API surface may vary by version — see the source for the exact methods.

## Resources
- 🌐 Website — https://quantova.org
- 🔎 Explorer — https://qvmscan.io
- 📦 Quantova packages — https://www.npmjs.com/org/quantova
- 💻 Source — https://github.com/Quantova/Qweb3.js

## License
BUSL-1.1 - (c) 2026 Quantova Inc. See [LICENSE](./LICENSE).
