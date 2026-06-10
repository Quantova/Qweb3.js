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
import { Qweb3 } from 'qweb3.js';

// connect to a Quantova node
const q = new Qweb3('wss://rpc.quantova.org');

// create a post-quantum account (Falcon by default)
const account = await q.accounts.create();      // → { address: 'Q1…', mnemonic }

// read a balance
const balance = await q.getBalance(account.address);

// sign + send a transfer
const hash = await q.tx.transfer(account, 'Q1…recipient', '1.5');
```

> API surface may vary by version — see the source for the exact methods.

## Resources
- 🌐 Website — https://quantova.org
- 🔎 Explorer — https://qvmscan.io
- 📦 Quantova packages — https://www.npmjs.com/org/quantova
- 💻 Source — https://github.com/Quantova/Qweb3.js

## License
Apache-2.0 © Quantova
