# Security Assessment - qweb3.js

- **Package:** `qweb3.js` (npm)
- **Assessment date:** 2026-06-23
- **Version assessed:** 1.1.10
- **Scope:** the published client library and CLI (`index.js`, `src/`, `bin`/CLI)

## Summary

An adversarial security review of the qweb3.js SDK found **no cryptographic break and no
remote path to recover a private key or forge a signature** from public data (address, public
key, or network traffic). Key generation, the sign/verify binding, and address derivation are
sound and consistent with the Python and Rust SDKs.

Three classes of defect were identified and remediated across releases:

1. Secret material (seed/mnemonic) was reachable through default serialization and logging.
2. The REST client interpolated unvalidated input into request URL paths.
3. `verify()` could raise on malformed input, and an unknown signature scheme could fall
   through to a default algorithm.

All three are fixed in the current release. The remaining residual exposure - an attacker who
is **already executing code in the host process** - cannot be eliminated in any pure-JavaScript
library and is addressed under *Recommendations*.

qweb3.js is a thin client over the `q_*` JSON-RPC. Post-quantum signing is delegated to the
external libraries listed under *Trust boundary*, which require their own review.

## Methodology

| Area | Tests performed |
| --- | --- |
| Cryptographic correctness | Entropy source, seed derivation, deterministic signing, sign/verify binding, address derivation, cross-SDK address parity |
| Signature forgery surface | Tampered message, modified signature, empty/zero signature, wrong key, wrong scheme |
| Untrusted-input parsing | ABI decoder against crafted contract return data; Bech32m, address, and hex decoders against malformed input; numeric/amount conversions |
| Network surface | RPC/REST transport, URL construction, TLS verification, error handling |
| Supply chain | Dependency CVEs, lifecycle (install) scripts, lockfile integrity |
| Secret hygiene | JSON serialization, console/inspection output, structured logging, CLI output |

## Findings and remediation

| ID | Description | Severity | Fixed in | Advisory |
| --- | --- | --- | --- | --- |
| QW3-KEY-001 | Account object exposed the reversible private key (QSEC1) and mnemonic as enumerable properties, leaking them via `JSON.stringify`, `console.log`, structured loggers, and `Object.getOwnPropertyNames` | High | 1.1.7 (hardened in 1.1.8) | GHSA-4v25-64xj-v65r |
| QW3-KEY-003 | CLI printed the private key to stdout and accepted the seed as a command-line argument | High | 1.1.8 | GHSA-4v25-64xj-v65r |
| QWEB3-VAL-001 | REST client interpolated unvalidated input (address, storage slot, block number/hash) into URL paths; `toNodeAddress` passed non-address strings through unchanged | Low-medium | 1.1.9 | GHSA-wwv3-wvvp-mpq3 |
| QWEB3-VAL-002 | `verify()` could throw on a malformed signature; an unknown scheme silently fell through to Falcon | Low | 1.1.10 | - |

## Verified sound

- **Cryptography.** Accounts originate from a 24-word BIP-39 mnemonic over a CSPRNG (256-bit
  entropy). Seeds are derived by PBKDF2-HMAC-SHA512. Per-message signing randomness is handled
  inside the post-quantum cores, not by the SDK. The full forgery matrix (tampered message,
  modified signature, empty/zero signature, wrong key, wrong scheme) is rejected.
- **Address derivation.** `Q1...` = Bech32m of `SHA3-256(publicKey)[0:20]` with the leading
  `0x40` brand byte, enforced on decode; consistent across all three SDKs.
- **Amount conversions.** `qtovToWei` / `weiToQtov` use BigInt integer arithmetic; no
  floating-point precision loss in the transfer path.
- **Parsers.** The ABI decoder and Bech32m decoder reject malformed input without hang, crash,
  or out-of-bounds access.
- **Dependencies.** No known CVEs (`npm audit`). No `preinstall`/`postinstall`/`prepare`
  lifecycle scripts.
- **Network.** TLS verification is never disabled. The node endpoint is operator-configured,
  not attacker-controlled.

## Trust boundary

The SDK delegates all signing, per-signature randomness, and verification math to external
libraries that are outside the scope of this assessment and require their own cryptographic
review:

- Falcon-512 - `@quantova/falcon-wasm`
- ML-DSA / Dilithium - FIPS-204 implementation
- SLH-DSA / SPHINCS+ - FIPS-205 implementation

## Recommendations for integrators

1. Use version **1.1.10 or later**.
2. Validate user-supplied addresses at your own trust boundary before passing them to SDK
   methods.
3. Do not rely on the SDK to redact secrets that an in-process attacker is actively trying to
   read. A leaked QSEC1 string reconstitutes full signing capability. For high-value keys, hold
   key material in an HSM or OS keystore - no pure-JavaScript library can prevent code running
   in the same process from reading a live key, which is the same trust boundary as calling
   `account.privateKey` directly.
4. If any version **earlier than 1.1.8** was used, audit application logs, crash reports, and CI
   artifacts for leaked QSEC1 or mnemonic values, and rotate any keys that may have been
   exposed.

## Remediation history

| Version | Change |
| --- | --- |
| 1.1.7 | Account secrets made non-enumerable; redacting `toJSON` and inspection output |
| 1.1.8 | Secrets moved into a module-private `WeakMap`, off the account object entirely; CLI reads the seed from `QWEB3_SEED` rather than argv |
| 1.1.9 | `toNodeAddress` validates and rejects non-addresses; REST path segments percent-encoded |
| 1.1.10 | `verify()` is total (returns `false` on malformed input); signature schemes whitelisted |
