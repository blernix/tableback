import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Options } from 'express-rate-limit';
import logger from '../utils/logger';

const stores = new Map<string, RedisStore | null>();

async function ensureRedisStore(prefix: string): Promise<RedisStore | undefined> {
  if (stores.has(prefix)) {
    const existing = stores.get(prefix);
    return existing ?? undefined;
  }

  if (!process.env.REDIS_URL) {
    stores.set(prefix, null);
    return undefined;
  }

  try {
    const { getRedisClient } = await import('../config/redis');
    const client = await getRedisClient();
    if (!client) {
      stores.set(prefix, null);
      return undefined;
    }

    const store = new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args),
      prefix: `ratelimit:${prefix}:`,
    });

    stores.set(prefix, store);
    logger.info(`Redis rate limiter active for '${prefix}'`);
    return store;
  } catch {
    stores.set(prefix, null);
    logger.warn(`Redis unavailable for '${prefix}', using in-memory fallback`);
    return undefined;
  }
}

export function createLimiter(
  prefix: string,
  options: Partial<Options> & Pick<Options, 'windowMs' | 'max'>
): RateLimitRequestHandler {
  const limiter = rateLimit({
    ...options,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
  } as Options);

  ensureRedisStore(prefix).then((store) => {
    if (store) {
      (limiter as any).store = store;
    }
  });

  return limiter;
}
