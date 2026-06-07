const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 60;
const MAX_TRACKED_KEYS = 5000;

function defaultKeyGenerator(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function cleanupExpiredEntries(store, now) {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }

  if (store.size <= MAX_TRACKED_KEYS) {
    return;
  }

  const keysToRemove = store.size - MAX_TRACKED_KEYS;
  let removed = 0;

  for (const key of store.keys()) {
    store.delete(key);
    removed += 1;

    if (removed >= keysToRemove) {
      break;
    }
  }
}

function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) || DEFAULT_WINDOW_MS;
  const max = Number(options.max) || DEFAULT_MAX;
  const keyPrefix = options.keyPrefix || "global";
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const message = options.message || "Muitas requisicoes. Tente novamente em alguns minutos.";
  const store = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    cleanupExpiredEntries(store, now);

    const rawKey = keyGenerator(req);
    const key = `${keyPrefix}:${String(rawKey || "unknown")}`;
    const current = store.get(key);
    const entry =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + windowMs
          };

    entry.count += 1;
    store.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil(entry.resetAt / 1000);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        ok: false,
        code: "RATE_LIMITED",
        message
      });
      return;
    }

    next();
  };
}

module.exports = {
  createRateLimiter
};
