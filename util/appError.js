class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;

        // Marking this as a custom error
        this.isOperational = true;

        // Captures the stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
