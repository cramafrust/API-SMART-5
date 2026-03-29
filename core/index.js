/**
 * core/ — API SMART 5 Core
 *
 * Import centralizat:
 *   const { config, logger, notifications, patterns, seasons } = require('./core');
 */

module.exports = {
    config: require('./config'),
    logger: require('./logger'),
    notifications: require('./notifications'),
    patterns: require('./patterns'),
    seasons: require('./seasons'),
    anomaly: require('./anomaly'),
};
