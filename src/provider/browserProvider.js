// src/provider/browserProvider.js

/**
 * BrowserProvider class for interacting with the Quantova Wallet.
 * Provides functionality to connect to the Quantova Wallet, manage accounts,
 * send transactions, estimate gas, and more.
 */
class BrowserProvider {
    constructor() {
        // Ensure the custom Quantova Wallet is available in the window object
        if (typeof window !== 'undefined' && window.quantova) {
            this.quantova = window.quantova;
            this.isInjected = true;  // Indicating that the custom wallet is injected into the window object
        } else {
            this.isInjected = false;  // No custom wallet found
            this.quantova = null;
            console.error("Quantova Wallet is not available in the current environment.");
        }

        // State variables
        this.isConnected = false;
        this.networkId = null;
        this.accounts = [];
        this.selectedAccount = null;
    }

    /**
     * Connect to the Quantova Wallet and request accounts.
     * It fetches accounts from the wallet and subscribes to account/network change events.
     */
    async connect() {
        if (this.isInjected) {
            try {
                // Request accounts from Quantova wallet
                const accounts = await this.quantova.request({ method: 'q_accounts' });
                this.accounts = accounts;
                this.selectedAccount = accounts[0];  // Use the first account as the selected account
                this.isConnected = true;

                // Fetch the network ID
                this.networkId = await this.quantova.request({ method: 'q_net_version' });

                // Listen for account or network changes
                this.quantova.on('accountsChanged', this.onAccountsChanged.bind(this));
                this.quantova.on('chainChanged', this.onChainChanged.bind(this));

                console.log("Successfully connected to Quantova Wallet. Network ID:", this.networkId);
            } catch (error) {
                console.error("Failed to connect to Quantova Wallet:", error);
                this.isConnected = false;
            }
        } else {
            console.error("Quantova Wallet not detected.");
        }
    }

    /**
     * Handle account changes. Update the selected account accordingly.
     */
    onAccountsChanged(accounts) {
        if (accounts.length === 0) {
            console.warn("No accounts found. Please connect a Quantova Wallet account.");
            this.isConnected = false;
        } else {
            this.accounts = accounts;
            this.selectedAccount = accounts[0];
            console.log("Account changed to:", this.selectedAccount);
        }
    }

    /**
     * Handle network changes. Update the network ID accordingly.
     */
    onChainChanged(chainId) {
        this.networkId = chainId;
        console.log("Network changed to:", this.networkId);
    }

    /**
     * Get the currently selected account.
     * @returns {string|null} The address of the selected account or null if not connected.
     */
    getSelectedAccount() {
        return this.selectedAccount || null;
    }

    /**
     * Get the list of available accounts from Quantova Wallet.
     * @returns {Array} List of account addresses.
     */
    getAccounts() {
        return this.accounts;
    }

    /**
     * Get the current network ID.
     * @returns {string|null} The network ID or null if no connection exists.
     */
    async getNetworkId() {
        return this.networkId;
    }

    /**
     * Send a transaction using the Quantova Wallet.
     * @param {Object} txData Transaction data object containing 'from', 'to', 'value', etc.
     * @returns {Promise<string>} The transaction hash.
     */
    async sendTransaction(txData) {
        if (!this.isConnected) {
            throw new Error("Not connected to Quantova Wallet.");
        }

        try {
            // Ensure the transaction has the selected account as 'from' if it's not provided
            if (!txData.from) {
                txData.from = this.selectedAccount;
            }

            // Send the transaction using Quantova Wallet's API
            const txHash = await this.quantova.request({
                method: 'q_sendTransaction',
                params: [txData],
            });

            console.log("Transaction sent. Hash:", txHash);
            return txHash;
        } catch (error) {
            console.error("Failed to send transaction:", error);
            throw new Error("Transaction failed.");
        }
    }

    /**
     * Estimate gas for a transaction.
     * @param {Object} txData Transaction data object to estimate gas for.
     * @returns {Promise<string>} The estimated gas amount (hex string).
     */
    async estimateGas(txData) {
        if (!this.isConnected) {
            throw new Error("Not connected to Quantova Wallet.");
        }

        try {
            const gasEstimate = await this.quantova.request({
                method: 'q_estimateGas',
                params: [txData],
            });

            console.log("Estimated gas:", gasEstimate);
            return gasEstimate;
        } catch (error) {
            console.error("Failed to estimate gas:", error);
            throw new Error("Gas estimation failed.");
        }
    }

    /**
     * Get the balance of an address.
     * @param {string} address The address to check.
     * @returns {Promise<string>} The balance in wei (hex string).
     */
    async getBalance(address) {
        if (!this.isConnected) {
            throw new Error("Not connected to Quantova Wallet.");
        }

        try {
            const balance = await this.quantova.request({
                method: 'q_getBalance',
                params: [address, 'latest'],
            });

            console.log("Balance for", address, "is", balance);
            return balance;
        } catch (error) {
            console.error("Failed to fetch balance:", error);
            throw new Error("Failed to fetch balance.");
        }
    }

    /**
     * Check if the current network is the expected network ID.
     * @param {string} expectedNetworkId The expected network ID.
     * @returns {boolean} True if the current network matches the expected network ID.
     */
    isExpectedNetwork(expectedNetworkId) {
        return this.networkId === expectedNetworkId;
    }

    /**
     * Listen for account changes and call the provided callback function.
     * @param {Function} callback The callback function to be called when accounts change.
     */
    onAccountChange(callback) {
        this.quantova.on('accountsChanged', (accounts) => {
            callback(accounts);
        });
    }

    /**
     * Listen for network changes and call the provided callback function.
     * @param {Function} callback The callback function to be called when the network changes.
     */
    onNetworkChange(callback) {
        this.quantova.on('chainChanged', (chainId) => {
            callback(chainId);
        });
    }

    /**
     * Get the current gas price.
     * @returns {Promise<string>} The gas price in wei (hex string).
     */
    async getGasPrice() {
        if (!this.isConnected) {
            throw new Error("Not connected to Quantova Wallet.");
        }

        try {
            const gasPrice = await this.quantova.request({
                method: 'q_gasPrice',
            });

            console.log("Current gas price:", gasPrice);
            return gasPrice;
        } catch (error) {
            console.error("Failed to fetch gas price:", error);
            throw new Error("Failed to fetch gas price.");
        }
    }

    /**
     * Disconnect from the Quantova Wallet, reset internal state.
     */
    disconnect() {
        this.accounts = [];
        this.selectedAccount = null;
        this.networkId = null;
        this.isConnected = false;

        console.log("Disconnected from Quantova Wallet.");
    }
}

module.exports = BrowserProvider;
