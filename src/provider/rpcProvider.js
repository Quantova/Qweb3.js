// src/provider/rpcProvider.js

/**
 * The RpcProvider class provides raw JSON-RPC methods to interact with Quantova post-quantum blockchains.
 * It allows for direct q_* RPC calls to the blockchain.
 */
class RpcProvider {
    constructor(rpcUrl) {
        this.rpcUrl = rpcUrl || 'http://127.0.0.1:9944'; // RPC URL for connecting to Quantova node
        this.isConnected = false;
        this.networkId = null;

        // Setup the basic connection with the Quantova node via RPC URL
        this.initConnection();
    }

    /**
     * Initialize the connection to the Quantova node using the provided RPC URL.
     * It checks the connection and fetches the network ID.
     */
    async initConnection() {
        try {
            // Test the connection by calling `q_blockNumber`
            const blockNumber = await this._sendRpcRequest('q_blockNumber', []);
            this.isConnected = true;
            console.log("Successfully connected to Quantova node. Block number:", blockNumber);

            // Get the network ID from the node
            this.networkId = await this._sendRpcRequest('q_net_version', []);
            console.log("Network ID:", this.networkId);
        } catch (error) {
            console.error("Failed to connect to Quantova node:", error);
            this.isConnected = false;
        }
    }

    /**
     * Internal method to send raw JSON-RPC requests to the Quantova node.
     * @param {string} method The JSON-RPC method to call (e.g., 'q_blockNumber').
     * @param {Array} params The parameters for the RPC method.
     * @returns {Promise<any>} The result of the RPC request.
     */
    async _sendRpcRequest(method, params) {
        const payload = {
            jsonrpc: "2.0",
            method,
            params,
            id: 1,
        };

        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (result.error) {
                throw new Error(result.error.message);
            }

            return result.result;
        } catch (error) {
            console.error(`RPC request failed for method ${method}:`, error);
            throw error;
        }
    }

    // --- The 27 Custom q_* RPC methods ---
    async accounts() {
        return this._sendRpcRequest('q_accounts', []);
    }

    async getBlockNumber() {
        return this._sendRpcRequest('q_blockNumber', []);
    }

    async blockNumber() {
        return this.getBlockNumber();
    }

    async call(tx, block = 'latest') {
        return this._sendRpcRequest('q_call', [tx, block]);
    }

    async chainId() {
        return this._sendRpcRequest('q_chainId', []);
    }

    async estimateGas(txData) {
        return this._sendRpcRequest('q_estimateGas', [txData]);
    }

    async getGasPrice() {
        return this._sendRpcRequest('q_gasPrice', []);
    }

    async gasPrice() {
        return this.getGasPrice();
    }

    async getBalance(address, block = 'latest') {
        return this._sendRpcRequest('q_getBalance', [address, block]);
    }

    async getBlockByHash(hash, fullTxs = false) {
        return this._sendRpcRequest('q_getBlockByHash', [hash, fullTxs]);
    }

    async getBlockByNumber(block, fullTxs = false) {
        return this._sendRpcRequest('q_getBlockByNumber', [block, fullTxs]);
    }

    async getBlockTransactionCountByHash(hash) {
        return this._sendRpcRequest('q_getBlockTransactionCountByHash', [hash]);
    }

    async getBlockTransactionCountByNumber(block) {
        return this._sendRpcRequest('q_getBlockTransactionCountByNumber', [block]);
    }

    async getCode(address, block = 'latest') {
        return this._sendRpcRequest('q_getCode', [address, block]);
    }

    async getLogs(filter) {
        return this._sendRpcRequest('q_getLogs', [filter]);
    }

    async getStorageAt(address, position, block = 'latest') {
        return this._sendRpcRequest('q_getStorageAt', [address, position, block]);
    }

    async getTransactionByBlockHashAndIndex(hash, index) {
        return this._sendRpcRequest('q_getTransactionByBlockHashAndIndex', [hash, index]);
    }

    async getTransactionByBlockNumberAndIndex(block, index) {
        return this._sendRpcRequest('q_getTransactionByBlockNumberAndIndex', [block, index]);
    }

    async getTransactionByHash(txHash) {
        return this._sendRpcRequest('q_getTransactionByHash', [txHash]);
    }

    async getTransactionCount(address, block = 'latest') {
        return this._sendRpcRequest('q_getTransactionCount', [address, block]);
    }

    async getTransactionReceipt(hash) {
        return this._sendRpcRequest('q_getTransactionReceipt', [hash]);
    }

    async maxPriorityFeePerGas() {
        return this._sendRpcRequest('q_maxPriorityFeePerGas', []);
    }

    async sendRawTransaction(rawTx) {
        return this._sendRpcRequest('q_sendRawTransaction', [rawTx]);
    }

    async sendTransaction(txData) {
        return this._sendRpcRequest('q_sendTransaction', [txData]);
    }

    async syncing() {
        return this._sendRpcRequest('q_syncing', []);
    }

    async listening() {
        return this._sendRpcRequest('q_listening', []);
    }

    async getNetworkId() {
        return this._sendRpcRequest('q_net_version', []);
    }

    async net_version() {
        return this.getNetworkId();
    }

    async web3_clientVersion() {
        return this._sendRpcRequest('q_web3_clientVersion', []);
    }

    async feeHistory(blockCount, newestBlock, rewardPercentiles = []) {
        return this._sendRpcRequest('q_feeHistory', [blockCount, newestBlock, rewardPercentiles]);
    }

    isExpectedNetwork(expectedNetworkId) {
        return this.networkId === expectedNetworkId;
    }
}

export default RpcProvider;
