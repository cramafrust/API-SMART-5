/**
 * core/logger.js — Logging centralizat
 *
 * Drop-in replacement pentru LOG_MANAGER.js
 * Folosește config centralizat pentru path-uri.
 *
 * USAGE:
 *   const logger = require('./core/logger');
 *   logger.info('mesaj');
 *   logger.error('eroare');
 *   logger.warn('avertisment');
 */

const winston = require('winston');
const config = require('./config');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        if (stack) return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: require('path').join(config.paths.logs, 'combined.log'),
            maxsize: 20 * 1024 * 1024,
            maxFiles: 14,
            tailable: true
        }),
        new winston.transports.File({
            filename: require('path').join(config.paths.logs, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 14
        })
    ]
});

module.exports = {
    info: (msg, ...args) => logger.info(msg, ...args),
    error: (msg, ...args) => logger.error(msg, ...args),
    warn: (msg, ...args) => logger.warn(msg, ...args),
    debug: (msg, ...args) => logger.debug(msg, ...args),
    log: (msg, ...args) => logger.info(msg, ...args),
};
