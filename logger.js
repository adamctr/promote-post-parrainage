const { createLogger, format, transports } = require('winston');
const { combine, timestamp, json, colorize, simple, prettyPrint, printf, align, splat } = format;
const consoleloggerLevel = process.env.WINSTON_LOGGER_LEVEL || "info";

const prettyJson = format.printf(info => {
  if (typeof info.message === 'object') {
    info.message = JSON.stringify(info.message, null, 4)
  }
  return `${info.level}: ${info.message}`
})

// Create a logger instance
const logger = createLogger({
    level: consoleloggerLevel, // Minimum log level
    transports: [
        // Console transport for displaying logs in the console
        new transports.Console({
            level: consoleloggerLevel,
            format: format.combine(
              format.colorize(),
              format.prettyPrint(),
              format.splat(),
              format.simple(),
              prettyJson,
            )
        }),
        // File transport for logging to a file
        new transports.File({
            filename: 'combinedlogs.log',
            format: combine(
                timestamp(),   // Add timestamp to each log entry
                json()         // Format logs as JSON
            )
        }),
        new transports.File({
          filename: 'app-error.log',
          level: 'error',
          format: combine(
              timestamp(),   // Add timestamp to each log entry
              json()         // Format logs as JSON
          )
      }),
      new transports.File({
        filename: 'app-info.log',
        level: 'info',
        format: combine(
            timestamp(),   // Add timestamp to each log entry
            json()         // Format logs as JSON
        )
    }),
    ]
});

module.exports = logger;
