// src/events/index.js

const { WsProvider } = require('@quantova/rpc-provider');

class EventSubscriptionManager {
  constructor(wsUrl = 'ws://127.0.0.1:9944') {
    this.wsUrl = wsUrl;
    this.provider = null;
    this.subscriptions = new Map();
  }

  /**
   * Initializes connection to the Quantova WebSocket endpoint.
   */
  async _connect() {
    if (!this.provider) {
      this.provider = new WsProvider(this.wsUrl);
      await this.provider.connect();
    }
  }

  /**
   * Subscribes to new finalized head block events.
   * 
   * @param {Function} callback - Triggered with the block header.
   * @returns {Promise<string>} - The subscription ID.
   */
  async subscribeNewHeads(callback) {
    await this._connect();
    const subId = await this.provider.send('chain_subscribeFinalizedHeads', [], (error, result) => {
      if (error) {
        console.error('Error in finalized heads subscription:', error);
      } else {
        callback(result);
      }
    });

    this.subscriptions.set(subId, 'chain_unsubscribeFinalizedHeads');
    return subId;
  }

  /**
   * Unsubscribes from an active subscription.
   * 
   * @param {string} subId - The subscription ID.
   * @returns {Promise<boolean>}
   */
  async unsubscribe(subId) {
    if (!this.provider) return false;
    const method = this.subscriptions.get(subId);
    if (!method) return false;

    try {
      await this.provider.send(method, [subId]);
      this.subscriptions.delete(subId);
      return true;
    } catch (e) {
      console.error(`Failed to unsubscribe ${subId}:`, e);
      return false;
    }
  }

  /**
   * Disconnects the WebSocket provider cleanly.
   */
  async disconnect() {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }
  }
}

module.exports = EventSubscriptionManager;
