'use strict';

/**
 * Logger simples — sem segredos no output.
 */

function maskKey(key) {
  if (!key || key.length < 12) return '[invalid]';
  return key.slice(0, 10) + '...' + key.slice(-4);
}

function log(prefix, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${prefix}]`, ...args);
}

function warn(prefix, ...args) {
  const ts = new Date().toISOString();
  console.warn(`[${ts}] [${prefix}] WARN:`, ...args);
}

function error(prefix, ...args) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${prefix}] ERROR:`, ...args);
}

module.exports = { maskKey, log, warn, error };
