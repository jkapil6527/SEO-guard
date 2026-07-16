import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { crawlKeys } from '@seo-guardian/shared';
import type { CrawlProgressEvent } from '@seo-guardian/shared';
import { Redis } from 'ioredis';
import { Observable } from 'rxjs';
import { CRAWL_REDIS, CRAWL_REDIS_SUB } from './redis.provider';

/**
 * API-side live crawl state: reads counters/flags the workers maintain in
 * Redis, sets pause/cancel flags, and bridges the crawl's pub/sub channel to
 * an SSE stream.
 */
@Injectable()
export class CrawlProgressService implements OnModuleDestroy {
  private readonly logger = new Logger(CrawlProgressService.name);

  constructor(
    @Inject(CRAWL_REDIS) private readonly redis: Redis,
    @Inject(CRAWL_REDIS_SUB) private readonly subscriber: Redis,
  ) {}

  async requestCancel(crawlId: string): Promise<void> {
    await this.redis.set(crawlKeys(crawlId).cancelled, '1', 'EX', 3 * 24 * 3600);
  }

  async setPaused(crawlId: string, paused: boolean): Promise<void> {
    const key = crawlKeys(crawlId).paused;
    if (paused) await this.redis.set(key, '1', 'EX', 3 * 24 * 3600);
    else await this.redis.del(key);
  }

  async snapshot(crawlId: string): Promise<CrawlProgressEvent | null> {
    const raw = await this.redis.hgetall(crawlKeys(crawlId).counters);
    if (!raw || Object.keys(raw).length === 0) return null;
    return this.build(crawlId, raw);
  }

  /** SSE stream: emits the current snapshot then every published update. */
  stream(crawlId: string): Observable<CrawlProgressEvent> {
    return new Observable<CrawlProgressEvent>((observer) => {
      const channel = crawlKeys(crawlId).channel;
      const sub = this.subscriber.duplicate();

      void this.snapshot(crawlId).then((snap) => {
        if (snap) observer.next(snap);
      });

      const onMessage = (ch: string, message: string): void => {
        if (ch !== channel) return;
        try {
          const event = JSON.parse(message) as CrawlProgressEvent;
          observer.next(event);
          if (event.finishedAt) observer.complete();
        } catch (err) {
          this.logger.warn({ err }, 'bad progress message');
        }
      };

      sub.on('message', onMessage);
      void sub.subscribe(channel).catch((err) => observer.error(err));

      return () => {
        sub.off('message', onMessage);
        void sub.quit().catch(() => undefined);
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
  }

  private build(crawlId: string, raw: Record<string, string>): CrawlProgressEvent {
    const total = Number(raw.total ?? 0);
    const crawled = Number(raw.crawled ?? 0);
    const unchanged = Number(raw.unchanged ?? 0);
    const failed = Number(raw.failed ?? 0);
    const done = crawled + unchanged + failed;
    const startedAtMs = Number(raw.startedAtMs ?? Date.now());
    const elapsed = Date.now() - startedAtMs;
    const etaMs =
      done > 0 && done < total && elapsed > 0
        ? Math.round((elapsed / done) * (total - done))
        : undefined;
    return {
      crawlId,
      status: 'running',
      total,
      crawled,
      unchanged,
      failed,
      queued: Math.max(0, total - done),
      percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      currentUrl: raw.currentUrl || undefined,
      etaMs,
    };
  }
}
