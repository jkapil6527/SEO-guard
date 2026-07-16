import { CrawlAggregatesRepository, CrawlChangesRepository, CrawlsRepository, SchemaEntitiesRepository } from '@seo-guardian/db';
import type { Paginated } from '@seo-guardian/shared';
import { SchemaChangeQueryDto, SchemaEntityQueryDto } from './schema.dto';
/** Schema.org read APIs: entities, coverage, rich results, history and changes. */
export declare class SchemaController {
    private readonly schema;
    private readonly changes;
    private readonly aggregates;
    private readonly crawls;
    constructor(schema: SchemaEntitiesRepository, changes: CrawlChangesRepository, aggregates: CrawlAggregatesRepository, crawls: CrawlsRepository);
    entities(crawlId: string, query: SchemaEntityQueryDto): Promise<Paginated<unknown>>;
    coverage(crawlId: string): Promise<{
        coverage: {
            totalEntities: number;
            pagesWithSchema: number;
            richEligible: number;
        };
        typeFrequency: {
            schemaType: string;
            count: number;
        }[];
        statusCounts: {
            status: string;
            count: number;
        }[];
        aggregate: {} | null;
    }>;
    richResults(crawlId: string): Promise<{
        profile: string;
        status: string;
        count: number;
    }[]>;
    pageSchema(crawlId: string, pageId: string): Promise<{
        data: import("@seo-guardian/db").SchemaEntityRow[];
    }>;
    changesList(crawlId: string, query: SchemaChangeQueryDto): Promise<Paginated<unknown>>;
    changesSummary(crawlId: string): Promise<{
        changeType: string;
        count: number;
    }[]>;
    history(websiteId: string): Promise<{
        data: {
            crawlId: string;
            date: Date;
            schema: {} | null;
        }[];
    }>;
}
