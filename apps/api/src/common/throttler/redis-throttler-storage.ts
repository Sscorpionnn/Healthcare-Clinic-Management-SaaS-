import type { ThrottlerStorage } from "@nestjs/throttler";
import type { Redis } from "ioredis";

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const KEY_PREFIX = "throttle:";
const BLOCK_PREFIX = "throttle:blocked:";

/**
 * Redis-backed rate-limit counter so limits are shared across API
 * instances rather than per-process — see docs/threat-model.md T4/T13.
 * Manually instantiated in ThrottlerModule's factory (not a DI-managed
 * provider), so it takes a plain `Redis` client rather than using `@Inject`.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `${KEY_PREFIX}${throttlerName}:${key}`;
    const blockKey = `${BLOCK_PREFIX}${throttlerName}:${key}`;

    const blockTtl = await this.redis.pttl(blockKey);
    if (blockTtl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtl / 1000),
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }
    const pttl = await this.redis.pttl(hitKey);
    const timeToExpire = Math.ceil(Math.max(pttl, 0) / 1000);

    if (totalHits > limit) {
      await this.redis.set(blockKey, "1", "PX", blockDuration, "NX");
      const blockedTtl = await this.redis.pttl(blockKey);
      return {
        totalHits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(Math.max(blockedTtl, 0) / 1000),
      };
    }

    return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
  }
}
