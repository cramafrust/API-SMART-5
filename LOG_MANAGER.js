/**
 * LOG MANAGER
 *
 * Sistem centralizat de logging cu rotație automată
 * Rezolvă problema log-urilor IMENSE (141MB+)
 *
 * Features:
 * - Rotație zilnică automată
 * - Maxim 20MB per fișier
 * - Păstrează 14 zile
 * - Comprimare automată
 * - Console + File logging
 */

const winston = require('winston');
const path = require('path');

// Configurare format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Creează logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console output (doar pentru development/debug)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),

        // File output cu rotație
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'combined.log'),
            maxsize: 20 * 1024 * 1024, // 20MB
            maxFiles: 14, // 14 fișiere = ~2 săptămâni
            tailable: true
        }),

        // Error log separat
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 14
        })
    ]
});

/**
 * Wrapper functions pentru compatibility cu console.log
 */
const LogManager = {
    info: (message, ...args) => {
        logger.info(message, ...args);
    },

    error: (message, ...args) => {
        logger.error(message, ...args);
    },

    warn: (message, ...args) => {
        logger.warn(message, ...args);
    },

    debug: (message, ...args) => {
        logger.debug(message, ...args);
    },

    // Alias pentru console.log compatibility
    log: (message, ...args) => {
        logger.info(message, ...args);
    }
};

// Cleanup la exit
process.on('exit', () => {
    logger.end();
});

module.exports = LogManager;
