// index.mjs

// Post-quantum packages
import { ApiPromise, WsProvider } from '@quantova/api';
import { Keyring } from '@quantova/keyring';
import { compactFromU8a, hexToU8a, u8aToHex } from '@quantova/util';
import { cryptoWaitReady, setDilithiumWasmCrypto, setFalconWasmCrypto, setSphincspWasmCrypto } from '@quantova/util-crypto';
import * as falconWasm from '@quantova/falcon-wasm';

// Custom post-quantum modules
import QRpcClient from './src/rpc/index.js';
import QuantumWallet from './src/wallet/index.js';
import QuantumSigner from './src/signer/index.js';
import EventSubscriptionManager from './src/events/index.js';

// Extended modules (contracts, ABI, QNS, batch, fees, hooks, REST)
import QRestClient from './src/rest/index.js';
import AbiCodec from './src/abi/index.js';
import QContract from './src/contract/index.js';
import QNS from './src/qns/index.js';
import BatchRequest from './src/batch/index.js';
import FeeOracle from './src/fee/index.js';
import EventHooks from './src/hooks/index.js';

// Legacy utils
import utils from './src/utils/index.js';
const { AddressUtils, BigIntUtils, FormatUtils, HexUtils, NumberUtils, ValidationUtils } = utils;

// Legacy errors
import errors from './src/errors/index.js';
const { ConnectionError, InvalidArgumentError, RpcError, TransactionError } = errors;

// Legacy provider
import provider from './src/provider/index.js';
const { RpcProvider, BrowserProvider } = provider;

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

    this.rest = opts.restUrl ? new QRestClient(opts.restUrl) : null;
    this.batch = () => new BatchRequest(url);
    this.fees = new FeeOracle({ rpc: this.rpc, restClient: this.rest });
    this.hooks = new EventHooks({ rpc: this.rpc, events: this.events, restClient: this.rest });
    this.abi = AbiCodec;
  }

  contract(abi, address) {
    return new QContract(abi, address, {
      rpc: this.rpc,
      wallet: this.wallet,
      restClient: this.rest,
    });
  }

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

export {
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
  falconWasm,

  // Legacy
  AddressUtils,
  BigIntUtils,
  FormatUtils,
  HexUtils,
  NumberUtils,
  ValidationUtils,
  ConnectionError,
  InvalidArgumentError,
  RpcError,
  TransactionError,
  RpcProvider,
  BrowserProvider
};
