// index.d.ts
// Type definitions for qweb3.js (Quantova Post-Quantum Web3 Client SDK)

export interface Account {
  address: string;
  publicKey: string;
  scheme: 'falcon' | 'dilithium' | 'sphincsp';
}

export class QuantumWallet {
  constructor();
  create(scheme: 'falcon' | 'dilithium' | 'sphincsp'): Account;
  import(mnemonicOrSeed: string, scheme: 'falcon' | 'dilithium' | 'sphincsp'): Account;
  signTransaction(message: string, address: string): string;
  getAccount(address: string): Account | undefined;
}

export class QuantumSigner {
  static sign(message: string, privateKey: string, scheme: 'falcon' | 'dilithium' | 'sphincsp'): string;
  static verify(message: string, signature: string, publicKey: string, scheme: 'falcon' | 'dilithium' | 'sphincsp'): boolean;
}

export class QRpcClient {
  constructor(nodeUrl: string);
  request(method: string, params?: any[]): Promise<any>;

  q_accounts(): Promise<string[]>;
  q_blockNumber(): Promise<string>;
  q_call(transaction: object, block?: string): Promise<string>;
  q_chainId(): Promise<string>;
  q_estimateGas(transaction: object): Promise<string>;
  q_gasPrice(): Promise<string>;
  q_getBalance(address: string, block?: string): Promise<string>;
  q_getBlockByHash(hash: string, fullTx?: boolean): Promise<object>;
  q_getBlockByNumber(block: string, fullTx?: boolean): Promise<object>;
  q_getBlockTransactionCountByHash(hash: string): Promise<string>;
  q_getBlockTransactionCountByNumber(block: string): Promise<string>;
  q_getCode(address: string, block?: string): Promise<string>;
  q_getLogs(filter: object): Promise<any[]>;
  q_getStorageAt(address: string, position: string, block?: string): Promise<string>;
  q_getTransactionByBlockHashAndIndex(hash: string, index: string): Promise<object>;
  q_getTransactionByBlockNumberAndIndex(block: string, index: string): Promise<object>;
  q_getTransactionByHash(hash: string): Promise<object>;
  q_getTransactionCount(address: string, block?: string): Promise<string>;
  q_getTransactionReceipt(hash: string): Promise<object>;
  q_listening(): Promise<boolean>;
  q_maxPriorityFeePerGas(): Promise<string>;
  q_net_version(): Promise<string>;
  q_sendRawTransaction(data: string): Promise<string>;
  q_sendTransaction(transaction: object): Promise<string>;
  q_syncing(): Promise<boolean | object>;
  q_web3_clientVersion(): Promise<string>;
}

export class BrowserProvider {
  constructor();
  request(payload: object): Promise<any>;
}

export class RpcProvider {
  constructor(endpoint: string);
  send(method: string, params: any[]): Promise<any>;
}

export namespace AddressUtils {
  /** True for a Quantova account address ("Q1...") or a 0x H160 contract address. */
  function isAddress(address: string): boolean;
  /** Derive the Quantova account address ("Q1...") from a post-quantum public key. */
  function deriveAddressFromPublicKey(publicKey: string | Uint8Array): string;
  /** Derive the 20-byte account body (SHA3-256(pubKey)[..20], byte[0]=0x40) from a public key. */
  function accountBodyFromPublicKey(publicKey: string | Uint8Array): Uint8Array;
  /** Decode a "Q1..." address back to its 20-byte account body. */
  function addressToBytes(address: string): Uint8Array;
}

export namespace ValidationUtils {
  function isAddress(address: string): boolean;
  function isQNSName(name: string): boolean;
}

// Custom Error Classes
export class ConnectionError extends Error {
  nodeUrl: string;
  statusCode: string;
  constructor(message: string, nodeUrl: string, statusCode: string);
}

export class InvalidArgumentError extends Error {
  functionName: string;
  invalidValue: any;
  expectedType: string;
  constructor(message: string, functionName: string, invalidValue: any, expectedType: string);
}

export class RpcError extends Error {
  endpoint: string;
  method: string;
  statusCode: number;
  constructor(message: string, endpoint: string, method: string, statusCode: number);
}

export class TransactionError extends Error {
  txHash: string;
  statusCode: number;
  constructor(message: string, txHash: string, statusCode: number);
}

// ===========================================================================
// Extended modules (v1.1.0)
// ===========================================================================

export type SignatureScheme = 'falcon' | 'dilithium' | 'sphincsp';

export interface AbiInput { name?: string; type: string; indexed?: boolean; }
export interface AbiFragment {
  type?: 'function' | 'event' | 'constructor' | 'fallback' | string;
  name?: string;
  inputs?: AbiInput[];
  outputs?: AbiInput[];
  stateMutability?: 'view' | 'pure' | 'nonpayable' | 'payable' | string;
  constant?: boolean;
}

// ABI Encoder & Decoder (standard Solidity ABI, keccak-256 selectors)
export namespace AbiCodec {
  function functionSelector(signature: string): string;
  function buildSignature(name: string, inputs?: AbiInput[]): string;
  function eventTopic(signature: string): string;
  function encodeParameters(types: string[], values: any[]): Uint8Array;
  function encodeFunctionCall(fnAbi: AbiFragment, args: any[]): string;
  function decodeParameters(types: string[], data: string): any[];
  function decodeFunctionResult(fnAbi: AbiFragment, data: string): any;
  function canonicalType(type: string): string;
  function setKeccak(fn: (bytes: Uint8Array) => Uint8Array): void;
}

export interface DecodedEvent {
  name: string;
  signature: string;
  topic: string;
  args: Record<string, any>;
  raw: any;
}

export interface ContractCallOverrides { from?: string; block?: string; }
export interface ContractSendOverrides {
  from: string; value?: string; gas?: string; gasPrice?: string; nonce?: string | number;
}

// QVM Smart Contract wrapper
export class QContract {
  constructor(abi: AbiFragment[], address: string, opts?: {
    rpc?: QRpcClient; wallet?: QuantumWallet; restClient?: QRestClient; signer?: typeof QuantumSigner;
  });
  address: string;
  abi: AbiFragment[];
  methods: Record<string, (...args: any[]) => {
    encode(): string;
    call(overrides?: ContractCallOverrides): Promise<any>;
    send(overrides?: ContractSendOverrides): Promise<string>;
  }>;
  encode(name: string, args?: any[]): string;
  call(name: string, args?: any[], overrides?: ContractCallOverrides): Promise<any>;
  send(name: string, args?: any[], overrides?: ContractSendOverrides): Promise<string>;
  estimateGas(name: string, args?: any[], overrides?: ContractCallOverrides): Promise<string>;
  decodeLog(log: any): DecodedEvent | null;
  decodeLogs(logs: any[]): DecodedEvent[];
  eventTopic(name: string): string;
}

// QNS Name Registrar & Resolver
export class QNS {
  constructor(opts: {
    registryAddress: string;
    rpc?: QRpcClient; wallet?: QuantumWallet; restClient?: QRestClient;
    abi?: AbiFragment[]; tld?: string;
  });
  isValidName(name: string): boolean;
  namehash(name: string): string;
  labelhash(label: string): string;
  resolve(name: string): Promise<string | null>;
  owner(name: string): Promise<string | null>;
  reverse(address: string): Promise<string | null>;
  register(name: string, ownerAddress: string, overrides?: Partial<ContractSendOverrides>): Promise<string>;
  setAddr(name: string, targetAddress: string, overrides?: Partial<ContractSendOverrides>): Promise<string>;
  static setKeccak(fn: (bytes: Uint8Array) => Uint8Array): void;
  static DEFAULT_REGISTRY_ABI: AbiFragment[];
}

// Batch Requests Portal
export interface BatchResult { success: boolean; result?: any; error?: string; }
export class BatchRequest {
  constructor(endpoint: string, opts?: { timeout?: number });
  readonly length: number;
  add(method: string, params?: any[], callback?: (err: Error | null, result: any) => void): this;
  reset(): this;
  execute(): Promise<BatchResult[]>;
  executeOrThrow(): Promise<any[]>;
}

// Dynamic Fee & Gas Oracle
export interface FeeTiers { slow: string; standard: string; fast: string; }
export interface FeeEstimate {
  baseFeePerGas: string; maxPriorityFeePerGas: string; maxFeePerGas: string;
  tiers: FeeTiers; model: string;
}
export class FeeOracle {
  constructor(opts: {
    rpc?: QRpcClient; restClient?: QRestClient; historyBlocks?: number; percentiles?: number[];
  });
  gasPrice(): Promise<bigint>;
  maxPriorityFeePerGas(): Promise<bigint>;
  feeHistory(blockCount?: number | string, newestBlock?: string, percentiles?: number[]): Promise<any>;
  tiers(): Promise<FeeTiers>;
  estimate(): Promise<FeeEstimate>;
  estimateForTx(tx: object): Promise<{
    gas: string; baseFeePerGas: string; maxPriorityFeePerGas: string;
    effectiveGasPrice: string; fee: string; feeWei: bigint;
  }>;
}

// Unified Event Hooks
import { EventEmitter } from 'events';
export class TxTracker extends EventEmitter {
  hash: string;
  receipt: any | null;
  confirmations: number;
  done: boolean;
}
export class EventHooks extends EventEmitter {
  constructor(opts: {
    rpc?: QRpcClient; events?: EventSubscriptionManager; restClient?: QRestClient;
    pollIntervalMs?: number; confirmations?: number; timeoutMs?: number;
  });
  startBlocks(): Promise<void>;
  stopBlocks(): Promise<void>;
  track(hash: string): TxTracker;
  waitForReceipt(hash: string): Promise<any>;
  untrack(hash: string): void;
  destroy(): Promise<void>;
}

// REST gateway client (quantova-rest-api)
export class QRestClient {
  constructor(baseUrl: string, opts?: { timeout?: number });
  index(): Promise<any>;
  healthz(): Promise<any>;
  getBalance(address: string, block?: string): Promise<any>;
  getTransactionCount(address: string, block?: string): Promise<any>;
  getCode(address: string, block?: string): Promise<any>;
  getStorageAt(address: string, slot: string, block?: string): Promise<any>;
  blockLatest(hydrated?: boolean): Promise<any>;
  blockFinalized(hydrated?: boolean): Promise<any>;
  blockByNumber(number: string | number, hydrated?: boolean): Promise<any>;
  blockByHash(hash: string, hydrated?: boolean): Promise<any>;
  blockTxCountByNumber(number: string | number): Promise<any>;
  blockTxCountByHash(hash: string): Promise<any>;
  getTransaction(hash: string): Promise<any>;
  getTransactionReceipt(hash: string): Promise<any>;
  sendRawTransaction(rawTransaction: string): Promise<any>;
  call(txObject: object, block?: string): Promise<any>;
  estimateGas(txObject: object): Promise<any>;
  gasPrice(): Promise<any>;
  feesPriority(): Promise<any>;
  feesHistory(params?: object): Promise<any>;
  feesEstimate(): Promise<any>;
  feesSimulate(txObject: object): Promise<any>;
  chainId(): Promise<any>;
  networkVersion(): Promise<any>;
  networkListening(): Promise<any>;
  nodeSyncing(): Promise<any>;
  nodeClientVersion(): Promise<any>;
  nodeAccounts(): Promise<any>;
  bridgeQuote(body: object): Promise<any>;
  bridgeInitiate(body: object): Promise<any>;
  bridgeStatus(tx: string, params?: object): Promise<any>;
  bridgeClaim(body: object): Promise<any>;
}

export class EventSubscriptionManager {
  constructor(wsUrl?: string);
  subscribeNewHeads(callback: (header: any) => void): Promise<string>;
  unsubscribe(subId: string): Promise<boolean>;
  disconnect(): Promise<void>;
}

// QWeb3 facade
export class QWeb3 {
  constructor(url?: string, opts?: { restUrl?: string });
  url: string;
  rpc: QRpcClient;
  rest: QRestClient | null;
  wallet: QuantumWallet;
  signer: typeof QuantumSigner;
  events: EventSubscriptionManager;
  fees: FeeOracle;
  hooks: EventHooks;
  abi: typeof AbiCodec;
  batch(): BatchRequest;
  contract(abi: AbiFragment[], address: string): QContract;
  qns(registryAddress: string, qnsOpts?: object): QNS;
}

// Format helpers (Quantova native-asset units)
export namespace FormatUtils {
  function weiToQtov(wei: bigint | string | number): string;
  function qtovToWei(qtov: string | number): bigint;
  function weiToEther(wei: bigint | string | number): string;
  function formatNumber(value: bigint | string | number): string;
  function formatDate(date: Date | string): string;
  function formatDecimals(value: number | string, decimals: number): string;
}
