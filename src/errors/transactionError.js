// src/errors/transactionError.js

/**
 * Custom error class to handle errors related to Quantova transactions.
 * This class extends the built-in Error class and adds more context, such as
 * the transaction hash, status code, and other details that can be useful for debugging.
 * 
 * @class TransactionError
 * @extends {Error}
 * @param {string} message - The error message explaining what went wrong with the transaction.
 * @param {string} txHash - The transaction hash that caused the error.
 * @param {number} statusCode - The status code returned from the RPC server (e.g., 200, 400, 500).
 * @param {object} [transactionData] - Additional data related to the transaction (optional).
 * @param {object} [responseBody] - The response body returned by the RPC server (optional).
 */
class TransactionError extends Error {
  /**
   * Creates an instance of the TransactionError class.
   * @param {string} message - The error message describing the transaction failure.
   * @param {string} txHash - The transaction hash that caused the error.
   * @param {number} statusCode - The status code from the RPC response.
   * @param {object} [transactionData] - The transaction data (optional).
   * @param {object} [responseBody] - The response body returned by the RPC server (optional).
   */
  constructor(message, txHash, statusCode, transactionData = null, responseBody = null) {
    super(message); // Call the parent class constructor (Error)
    this.name = "TransactionError"; // Set the error name to "TransactionError"
    this.message = message || "An error occurred during the transaction process.";
    this.txHash = txHash || "Unknown Transaction Hash"; // Transaction hash that failed
    this.statusCode = statusCode || 500; // Default to 500 if no status code is provided
    this.transactionData = transactionData || {}; // Transaction data (e.g., from the transaction request)
    this.responseBody = responseBody || {}; // Response body returned by the RPC server
    this.stack = (new Error()).stack; // Capture the stack trace

    // Log detailed information about the transaction error
    this.logErrorDetails();
  }

  /**
   * Logs detailed information about the transaction error.
   * This method is useful for debugging and tracking down the issue.
   */
  logErrorDetails() {
    console.error(`[${this.name}] ${this.message}`);
    console.error(`Transaction Hash: ${this.txHash}`);
    console.error(`HTTP Status Code: ${this.statusCode}`);
    console.error(`Transaction Data: ${JSON.stringify(this.transactionData)}`);
    console.error(`Response Body: ${JSON.stringify(this.responseBody)}`);
    console.error("Stack trace:", this.stack);
  }

  /**
   * Provides a formatted error message that can be shown to the user.
   * This method can be useful for displaying user-friendly error messages on the frontend.
   * 
   * @returns {string} - A formatted string representing the error.
   */
  getFormattedErrorMessage() {
    return `${this.name}: ${this.message}. Transaction hash: ${this.txHash}. Please check the transaction and try again.`;
  }

  /**
   * A helper method to provide additional context about the error.
   * This could be used to add more information or metadata to the error for debugging purposes.
   * 
   * @returns {object} - An object containing additional context about the transaction error.
   */
  getAdditionalContext() {
    return {
      txHash: this.txHash,
      statusCode: this.statusCode,
      transactionData: this.transactionData,
      responseBody: this.responseBody,
    };
  }

  /**
   * Parses the response body from the transaction RPC call.
   * This method checks if the response body has an error field and returns the error message.
   * 
   * @returns {string} - The error message from the response body, if available.
   */
  parseResponseError() {
    if (this.responseBody && this.responseBody.error) {
      return this.responseBody.error.message || "Unknown error in response body.";
    }
    return "No error message in response body.";
  }

  /**
   * Checks if the transaction was successful based on the status code.
   * 
   * @returns {boolean} - Returns true if the transaction was successful, otherwise false.
   */
  isTransactionSuccessful() {
    return this.statusCode === 200 && !this.responseBody.error;
  }
}


module.exports = TransactionError;

