// src/errors/connectionError.js

/**
 * Custom error class to handle errors related to connection issues in Quantova-based applications.
 * This class extends the built-in Error class to provide more context about connection problems.
 *
 * @class ConnectionError
 * @extends {Error}
 * @param {string} message - The error message describing the connection issue.
 * @param {string} [nodeUrl] - The Quantova node URL that caused the connection error (optional).
 * @param {string} [statusCode] - The HTTP status code associated with the error, if applicable (optional).
 * @param {string} [retryUrl] - A suggested URL for retrying the connection (optional).
 * @param {object} [additionalInfo] - Any additional information about the connection error (optional).
 */
class ConnectionError extends Error {
  /**
   * Creates an instance of the ConnectionError class.
   * @param {string} message - The error message describing the connection issue.
   * @param {string} [nodeUrl] - The Quantova node URL that caused the connection error (optional).
   * @param {string} [statusCode] - The HTTP status code associated with the error, if applicable (optional).
   * @param {string} [retryUrl] - A suggested URL for retrying the connection (optional).
   * @param {object} [additionalInfo] - Any additional information about the connection error (optional).
   */
  constructor(message, nodeUrl = null, statusCode = null, retryUrl = null, additionalInfo = null) {
    super(message); // Call the parent class constructor (Error)
    this.name = "ConnectionError"; // Set the error name to "ConnectionError"
    this.message = message || "There was an issue with the connection to the Quantova node.";
    this.nodeUrl = nodeUrl || "Unknown Node URL"; // Default to "Unknown Node URL" if not provided
    this.statusCode = statusCode || "N/A"; // Default to "N/A" if no status code is provided
    this.retryUrl = retryUrl || "N/A"; // Default to "N/A" if no retry URL is provided
    this.additionalInfo = additionalInfo || {}; // Default to an empty object if no additional info is provided
    this.stack = (new Error()).stack; // Capture the stack trace

    // Log detailed information about the error for debugging
    this.logErrorDetails();
  }

  /**
   * Logs detailed information about the connection error.
   * This method is useful for debugging and tracking down connection issues.
   */
  logErrorDetails() {
    console.error(`[${this.name}] ${this.message}`);
    console.error(`Node URL: ${this.nodeUrl}`);
    console.error(`Status Code: ${this.statusCode}`);
    console.error(`Retry URL: ${this.retryUrl}`);
    if (Object.keys(this.additionalInfo).length > 0) {
      console.error("Additional Information:", this.additionalInfo);
    }
    console.error("Stack trace:", this.stack);
  }

  /**
   * Provides a formatted error message to be shown to the user.
   * This method can be useful for displaying user-friendly error messages on the frontend.
   * 
   * @returns {string} - A formatted string representing the error.
   */
  getFormattedErrorMessage() {
    return `${this.name}: ${this.message}. Please check your connection and try again.`;
  }

  /**
   * A helper method to handle retries for the connection.
   * Attempts to retry the connection using a different URL, if available.
   * 
   * @param {function} retryFunction - The function to attempt a retry (e.g., re-connecting to the Quantova node).
   * @returns {Promise} - Returns a promise that resolves if retrying was successful, or rejects if it failed.
   */
  async retryConnection(retryFunction) {
    if (this.retryUrl === "N/A") {
      throw new Error("No retry URL available.");
    }

    console.log(`Attempting to reconnect using: ${this.retryUrl}`);
    try {
      // Retry connection using the provided function (retryFunction)
      await retryFunction(this.retryUrl);
      console.log("Reconnection successful.");
      return true; // Successfully reconnected
    } catch (error) {
      console.error("Reconnection failed:", error.message);
      return false; // Failed to reconnect
    }
  }

  /**
   * A helper method to provide additional context about the error.
   * This could be used to add more information or metadata to the error for debugging purposes.
   * 
   * @returns {object} - An object containing additional context about the connection error.
   */
  getAdditionalContext() {
    return {
      nodeUrl: this.nodeUrl,
      statusCode: this.statusCode,
      retryUrl: this.retryUrl,
      additionalInfo: this.additionalInfo
    };
  }
}


module.exports = ConnectionError;

