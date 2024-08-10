const { createLogger, format, transports } = require('winston');
const { combine, timestamp, json, colorize, simple, printf, splat } = format;

const consoleloggerLevel = process.env.WINSTON_LOGGER_LEVEL || "info";

// Custom format for console logs with colorization and pretty printing
const consoleFormat = combine(
    colorize(),
    splat(),
    simple(),
    printf(({ level, message, timestamp }) => {
        if (typeof message === 'object') {
            message = JSON.stringify(message, null, 4);
        }
        return `${timestamp} ${level}: ${message}`;
    })
);

// Custom timestamp format for all log entries
const customTimestamp = timestamp({
    format: 'YYYY-MM-DD HH:mm'
});

// Create a logger instance
const logger = createLogger({
    level: consoleloggerLevel, // Minimum log level
    format: combine(
        customTimestamp,  // Apply the custom timestamp format
    ),
    transports: [
        // Console transport for displaying logs in the console
        new transports.Console({
            level: consoleloggerLevel,
            format: consoleFormat
        }),
        // File transport for logging to a file (combined logs)
        new transports.File({
            filename: 'logs/combinedlogs.log',
            format: combine(
                customTimestamp,
                json()  // Format logs as JSON
            )
        }),
        // File transport for logging error level logs to a file
        new transports.File({
            filename: 'logs/app-error.log',
            level: 'error',
            format: combine(
                customTimestamp,
                json()
            )
        }),
        // File transport for logging info level logs to a file
        new transports.File({
            filename: 'logs/app-info.log',
            level: 'info',
            format: combine(
                customTimestamp,
                json()
            )
        }),
    ]
});

module.exports = logger;
