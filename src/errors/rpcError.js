// src/errors/rpcError.js

/**
 * Custom error class to handle errors related to RPC calls in Quantova or other blockchain platforms.
 * This class extends the built-in Error class to provide more context about the RPC error, such as 
 * the endpoint URL, status code, request method, and the error message returned from the server.
 * 
 * @class RpcError
 * @extends {Error}
 * @param {string} message - The error message explaining what went wrong with the RPC request.
 * @param {string} endpoint - The URL of the RPC endpoint that was used (e.g., an Quantova node).
 * @param {string} method - The name of the RPC method that was called.
 * @param {number} statusCode - The HTTP status code returned from the RPC server.
 * @param {string} [requestPayload] - The payload that was sent in the RPC request (optional).
 * @param {object} [responseBody] - The response body returned by the RPC server (optional).
 */
class RpcError extends Error {
  /**
   * Creates an instance of the RpcError class.
   * @param {string} message - The error message describing the RPC error.
   * @param {string} endpoint - The URL of the RPC endpoint.
   * @param {string} method - The name of the RPC method.
   * @param {number} statusCode - The status code returned from the RPC server.
   * @param {string} [requestPayload] - The RPC request payload (optional).
   * @param {object} [responseBody] - The response body returned by the server (optional).
   */
  constructor(message, endpoint, method, statusCode, requestPayload = null, responseBody = null) {
    super(message); // Call the parent class constructor (Error)
    this.name = "RpcError"; // Set the error name to "RpcError"
    this.message = message || "An error occurred with the RPC call.";
    this.endpoint = endpoint || "Unknown Endpoint"; // The RPC endpoint (e.g., URL of Quantova node)
    this.method = method || "Unknown Method"; // The RPC method (e.g., q_getBlockByNumber)
    this.statusCode = statusCode || 500; // Default to 500 if no status code is provided
    this.requestPayload = requestPayload || "No request payload"; // The request sent to the RPC server
    this.responseBody = responseBody || {}; // The response body returned by the server
    this.stack = (new Error()).stack; // Capture the stack trace

    // Log detailed information about the RPC error
    this.logErrorDetails();
  }

  /**
   * Logs detailed information about the RPC error.
   * This method is useful for debugging and tracking down the issue.
   */
  logErrorDetails() {
    console.error(`[${this.name}] ${this.message}`);
    console.error(`RPC Method: ${this.method}`);
    console.error(`RPC Endpoint: ${this.endpoint}`);
    console.error(`HTTP Status Code: ${this.statusCode}`);
    console.error(`Request Payload: ${JSON.stringify(this.requestPayload)}`);
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
    return `${this.name}: ${this.message}. Please check the RPC method and endpoint.`;
  }

  /**
   * A helper method to provide additional context about the error.
   * This could be used to add more information or metadata to the error for debugging purposes.
   * 
   * @returns {object} - An object containing additional context about the RPC error.
   */
  getAdditionalContext() {
    return {
      endpoint: this.endpoint,
      method: this.method,
      statusCode: this.statusCode,
      requestPayload: this.requestPayload,
      responseBody: this.responseBody,
    };
  }

  /**
   * Parses the response body from the RPC call.
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
}


module.exports = RpcError;

