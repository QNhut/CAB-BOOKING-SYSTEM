/**
 * Structured JSON logger – shared utility for all microservices.
 * Lightweight alternative to winston for services that don't need file transports.
 *
 * Usage (CommonJS):
 *   const { createLogger } = require('../shared/logger');
 *   const log = createLogger('my-service');
 *   log.info('Server started', { port: 8001 });
 *
 * Usage (ESM):
 *   import { createLogger } from '../shared/logger.js';
 */

function createLogger(service) {
  function format(level, msg, meta) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service,
      msg,
      ...meta,
    });
  }

  return {
    info(msg, meta = {}) {
      console.log(format("info", msg, meta));
    },
    warn(msg, meta = {}) {
      console.warn(format("warn", msg, meta));
    },
    error(msg, meta = {}) {
      console.error(format("error", msg, meta));
    },
    debug(msg, meta = {}) {
      if (process.env.LOG_LEVEL === "debug") {
        console.debug(format("debug", msg, meta));
      }
    },
  };
}

// Support both ESM and CommonJS
export { createLogger };
try { module.exports = { createLogger }; } catch {}
