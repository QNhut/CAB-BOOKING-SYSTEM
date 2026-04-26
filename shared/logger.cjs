function createLogger(service) {
  function format(level, msg, meta) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service_name: service,
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

module.exports = { createLogger };
