// src/errors/invalidArgError.js

/**
 * Custom error class to handle errors related to invalid arguments passed to functions or methods.
 * This class extends the built-in Error class to provide more context and detailed information
 * when invalid arguments are passed in an Quantova application.
 *
 * @class InvalidArgumentError
 * @extends {Error}
 * @param {string} message - The error message explaining what went wrong with the argument.
 * @param {string} [functionName] - The name of the function or method where the error occurred (optional).
 * @param {any} [invalidValue] - The invalid value that caused the error (optional).
 * @param {string} [expectedType] - The expected type of the argument (optional).
 * @param {object} [additionalInfo] - Any additional context or information related to the error (optional).
 */
class InvalidArgumentError extends Error {
  /**
   * Creates an instance of the InvalidArgumentError class.
   * @param {string} message - The error message describing the invalid argument.
   * @param {string} [functionName] - The function name where the invalid argument was passed (optional).
   * @param {any} [invalidValue] - The invalid value that caused the error (optional).
   * @param {string} [expectedType] - The expected argument type (optional).
   * @param {object} [additionalInfo] - Additional details about the error (optional).
   */
  constructor(message, functionName = null, invalidValue = null, expectedType = null, additionalInfo = null) {
    super(message); // Call the parent class constructor (Error)
    this.name = "InvalidArgumentError"; // Set the error name to "InvalidArgumentError"
    this.message = message || "An invalid argument was passed to the function.";
    this.functionName = functionName || "Unknown Function"; // Default to "Unknown Function" if not provided
    this.invalidValue = invalidValue || "Unknown Value"; // Default to "Unknown Value" if not provided
    this.expectedType = expectedType || "Unknown Type"; // Default to "Unknown Type" if not provided
    this.additionalInfo = additionalInfo || {}; // Default to an empty object if no additional info is provided
    this.stack = (new Error()).stack; // Capture the stack trace

    // Log detailed information about the error
    this.logErrorDetails();
  }

  /**
   * Logs detailed information about the invalid argument error.
   * This method is useful for debugging and tracking down the issue.
   */
  logErrorDetails() {
    console.error(`[${this.name}] ${this.message}`);
    console.error(`Function Name: ${this.functionName}`);
    console.error(`Invalid Value: ${this.invalidValue}`);
    console.error(`Expected Type: ${this.expectedType}`);
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
    return `${this.name}: ${this.message}. Please provide a valid argument of type ${this.expectedType}.`;
  }

  /**
   * A helper method to provide additional context about the error.
   * This could be used to add more information or metadata to the error for debugging purposes.
   * 
   * @returns {object} - An object containing additional context about the invalid argument error.
   */
  getAdditionalContext() {
    return {
      functionName: this.functionName,
      invalidValue: this.invalidValue,
      expectedType: this.expectedType,
      additionalInfo: this.additionalInfo
    };
  }
}


module.exports = InvalidArgumentError;

