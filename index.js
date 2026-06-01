// index.js

// Utilities
const { 
  AddressUtils, 
  BigIntUtils, 
  FormatUtils, 
  HexUtils, 
  NumberUtils, 
  ValidationUtils 
} = require('./src/utils');

// Custom Errors
const { 
  ConnectionError, 
  InvalidArgumentError, 
  RpcError, 
  TransactionError 
} = require('./src/errors');

// Providers
const { 
  RpcProvider, 
  BrowserProvider
} = require('./src/provider');

// Custom post-quantum modules
const QRpcClient = require('./src/rpc');
const QuantumWallet = require('./src/wallet');
const QuantumSigner = require('./src/signer');
const EventSubscriptionManager = require('./src/events');

// Extended modules (contracts, ABI, QNS, batch, fees, hooks, REST)
const QRestClient = require('./src/rest');
const AbiCodec = require('./src/abi');
const QContract = require('./src/contract');
const QNS = require('./src/qns');
const BatchRequest = require('./src/batch');
const FeeOracle = require('./src/fee');
const EventHooks = require('./src/hooks');

// Post-quantum packages
const { ApiPromise, WsProvider } = require('@quantova/api');
const { Keyring } = require('@quantova/keyring');
const { compactFromU8a, hexToU8a, u8aToHex } = require('@quantova/util');
const { cryptoWaitReady, setDilithiumWasmCrypto, setFalconWasmCrypto, setSphincspWasmCrypto } = require('@quantova/util-crypto');

class QWeb3 {
  /**
   * @param {string} url - JSON-RPC endpoint (http/ws).
   * @param {Object} [opts] - { restUrl } to enable the REST fallback transport.
   */
  constructor(url = 'http://127.0.0.1:9944', opts = {}) {
    this.url = url;
    this.q = new RpcProvider(url);
    this.rpc = new QRpcClient(url);
    this.wallet = new QuantumWallet();
    this.signer = QuantumSigner;
    this.events = new EventSubscriptionManager(url.replace(/^http/, 'ws'));

    // REST fallback client (optional; used by contract/QNS/fee/hooks fallbacks).
    this.rest = opts.restUrl ? new QRestClient(opts.restUrl) : null;

    // Batch portal + fee oracle + unified event hooks, pre-wired.
    this.batch = () => new BatchRequest(url);
    this.fees = new FeeOracle({ rpc: this.rpc, restClient: this.rest });
    this.hooks = new EventHooks({ rpc: this.rpc, events: this.events, restClient: this.rest });

    // ABI codec (stateless helpers).
    this.abi = AbiCodec;
  }

  /**
   * Instantiate a QVM contract bound to this client's transports.
   * @param {Array} abi
   * @param {string} address
   */
  contract(abi, address) {
    return new QContract(abi, address, {
      rpc: this.rpc,
      wallet: this.wallet,
      restClient: this.rest,
    });
  }

  /**
   * Create a QNS resolver bound to a registry contract address.
   * @param {string} registryAddress
   * @param {Object} [qnsOpts]
   */
  qns(registryAddress, qnsOpts = {}) {
    return new QNS({
      registryAddress,
      rpc: this.rpc,
      wallet: this.wallet,
      restClient: this.rest,
      ...qnsOpts,
    });
  }
}

// Exporting all properties
module.exports = {
  // QWeb3 Wrapper
  QWeb3,

  // Custom post-quantum modules
  QRpcClient,
  QuantumWallet,
  QuantumSigner,
  EventSubscriptionManager,

  // Extended modules
  QRestClient,
  AbiCodec,
  QContract,
  QNS,
  BatchRequest,
  FeeOracle,
  EventHooks,

  // Post-quantum
  ApiPromise,
  WsProvider,
  Keyring,
  compactFromU8a,
  hexToU8a,
  u8aToHex,
  cryptoWaitReady,
  setDilithiumWasmCrypto,
  setFalconWasmCrypto,
  setSphincspWasmCrypto,

  // Utilities from utils
  AddressUtils, 
  BigIntUtils, 
  FormatUtils, 
  HexUtils, 
  NumberUtils, 
  ValidationUtils,

  // Custom error classes
  ConnectionError, 
  InvalidArgumentError, 
  RpcError, 
  TransactionError,

  // Provider-related modules
  RpcProvider,
  BrowserProvider
};

// Lazy-loaded falconWasm to prevent Node 24 require(esm) WASM crash
let _falconWasm = null;
Object.defineProperty(module.exports, 'falconWasm', {
  get: () => {
    if (!_falconWasm) {
      try {
        _falconWasm = require('@quantova/falcon-wasm');
      } catch (err) {
        console.warn("falconWasm was requested synchronously under CJS but failed to load due to Node 24 require(esm) WASM limitations.");
      }
    }
    return _falconWasm;
  },
  enumerable: true
});
