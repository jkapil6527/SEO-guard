import { Inject, Injectable } from '@nestjs/common';
import { crawlKeys } from '@seo-guardian/shared';
import type { CrawlProgressEvent } from '@seo-guardian/shared';
import { Redis } from 'ioredis';
import { REDIS } from './redis.provider';

const TTL_SECONDS = 3 * 24 * 3600;

export interface CrawlCounters {
  total: number;
  crawled: number;
  unchanged: number;
  failed: number;
  startedAtMs: number;
  currentUrl: string;
}

/**
 * Live crawl state in Redis: atomic counters, dedupe sets, pause/cancel flags,
 * and progress publication. Counters are the fast path (workers increment on
 * every page); PostgreSQL is flushed periodically by the finalizer/orchestrator.
 */
@Injectable()
export class CrawlStateService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async init(crawlId: string, total: number, config: Record<string, string>): Promise<void> {
    const keys = crawlKeys(crawlId);
    const pipeline = this.redis.multi();
    pipeline.hset(keys.counters, {
      total,
      crawled: 0,
      unchanged: 0,
      failed: 0,
      startedAtMs: Date.now(),
      currentUrl: '',
    });
    pipeline.expire(keys.counters, TTL_SECONDS);
    if (Object.keys(config).length > 0) {
      pipeline.hset(keys.config, config);
      pipeline.expire(keys.config, TTL_SECONDS);
    }
    await pipeline.exec();
  }

  async addToTotal(crawlId: string, delta: number): Promise<void> {
    const keys = crawlKeys(crawlId);
    await this.redis.hincrby(keys.counters, 'total', delta);
  }

  async getConfig(crawlId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(crawlKeys(crawlId).config);
  }

  /** Marks progress on one page and returns fresh counters for publication. */
  async recordPage(
    crawlId: string,
    outcome: 'crawled' | 'unchanged' | 'failed',
    currentUrl: string,
  ): Promise<CrawlCounters> {
    const keys = crawlKeys(crawlId);
    const pipeline = this.redis.multi();
    pipeline.hincrby(keys.counters, outcome, 1);
    pipeline.hset(keys.counters, 'currentUrl', currentUrl);
    pipeline.hgetall(keys.counters);
    const res = await pipeline.exec();
    const raw = (res?.[2]?.[1] ?? {}) as Record<string, string>;
    return this.parseCounters(raw);
  }

  async getCounters(crawlId: string): Promise<CrawlCounters> {
    const raw = await this.redis.hgetall(crawlKeys(crawlId).counters);
    return this.parseCounters(raw);
  }

  /** True once every page has reached a terminal outcome. */
  isComplete(c: CrawlCounters): boolean {
    return c.total > 0 && c.crawled + c.unchanged + c.failed >= c.total;
  }

  /** Discovery dedupe: returns true if the url hash was newly added. */
  async markSeen(crawlId: string, urlHashHex: string): Promise<boolean> {
    const keys = crawlKeys(crawlId);
    const added = await this.redis.sadd(keys.seen, urlHashHex);
    if (added === 1) await this.redis.expire(keys.seen, TTL_SECONDS);
    return added === 1;
  }

  async markLinkTargetsNew(crawlId: string, urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];
    const keys = crawlKeys(crawlId);
    const pipeline = this.redis.multi();
    urls.forEach((u) => pipeline.sadd(keys.linkTargets, u));
    pipeline.expire(keys.linkTargets, TTL_SECONDS);
    const res = await pipeline.exec();
    return urls.filter((_, i) => res?.[i]?.[1] === 1);
  }

  /** Outstanding link-check batches; finalize waits until this reaches zero. */
  async incrLinkBatches(crawlId: string, delta: number): Promise<void> {
    const key = `${crawlKeys(crawlId).counters}:linkbatches`;
    await this.redis.incrby(key, delta);
    await this.redis.expire(key, TTL_SECONDS);
  }

  async decrLinkBatches(crawlId: string): Promise<number> {
    const key = `${crawlKeys(crawlId).counters}:linkbatches`;
    return this.redis.decr(key);
  }

  async getLinkBatches(crawlId: string): Promise<number> {
    const key = `${crawlKeys(crawlId).counters}:linkbatches`;
    const v = await this.redis.get(key);
    return v ? Number(v) : 0;
  }

  async requestCancel(crawlId: string): Promise<void> {
    await this.redis.set(crawlKeys(crawlId).cancelled, '1', 'EX', TTL_SECONDS);
  }

  isCancelled(crawlId: string): Promise<boolean> {
    return this.redis.exists(crawlKeys(crawlId).cancelled).then((n) => n === 1);
  }

  async setPaused(crawlId: string, paused: boolean): Promise<void> {
    const key = crawlKeys(crawlId).paused;
    if (paused) await this.redis.set(key, '1', 'EX', TTL_SECONDS);
    else await this.redis.del(key);
  }

  isPaused(crawlId: string): Promise<boolean> {
    return this.redis.exists(crawlKeys(crawlId).paused).then((n) => n === 1);
  }

  async publish(event: CrawlProgressEvent): Promise<void> {
    await this.redis.publish(crawlKeys(event.crawlId).channel, JSON.stringify(event));
  }

  async cleanup(crawlId: string): Promise<void> {
    const keys = crawlKeys(crawlId);
    await this.redis.del(keys.seen, keys.linkTargets, keys.config);
    // counters + flags kept briefly (their own TTL) so a late SSE client can read final state.
  }

  buildProgress(crawlId: string, status: string, c: CrawlCounters): CrawlProgressEvent {
    const done = c.crawled + c.unchanged + c.failed;
    const percent = c.total > 0 ? Math.min(100, Math.round((done / c.total) * 100)) : 0;
    let etaMs: number | undefined;
    const elapsed = Date.now() - c.startedAtMs;
    if (done > 0 && done < c.total && elapsed > 0) {
      etaMs = Math.round((elapsed / done) * (c.total - done));
    }
    return {
      crawlId,
      status,
      total: c.total,
      crawled: c.crawled,
      unchanged: c.unchanged,
      failed: c.failed,
      queued: Math.max(0, c.total - done),
      percent,
      currentUrl: c.currentUrl || undefined,
      etaMs,
    };
  }

  private parseCounters(raw: Record<string, string>): CrawlCounters {
    return {
      total: Number(raw.total ?? 0),
      crawled: Number(raw.crawled ?? 0),
      unchanged: Number(raw.unchanged ?? 0),
      failed: Number(raw.failed ?? 0),
      startedAtMs: Number(raw.startedAtMs ?? Date.now()),
      currentUrl: raw.currentUrl ?? '',
    };
  }
}
