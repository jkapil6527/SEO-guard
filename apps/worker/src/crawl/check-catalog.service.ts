import { Injectable, Logger } from '@nestjs/common';
import { Database } from '@seo-guardian/db';
import { CATALOG_CHECKS } from '@seo-guardian/seo-engine';

/**
 * Seeds the `checks` catalog table from the single-source seo-engine catalog
 * (per-page + cross-page + runtime checks), so every check_id written to
 * page_issues has catalog metadata. Idempotent upsert; runs on worker boot.
 */
@Injectable()
export class CheckCatalogService {
  private readonly logger = new Logger(CheckCatalogService.name);

  constructor(private readonly db: Database) {}

  async seed(): Promise<number> {
    for (const c of CATALOG_CHECKS) {
      await this.db.query(
        `INSERT INTO checks (id, category, default_severity, default_weight, title, description,
                             seo_impact, business_impact, suggested_fix, doc_url, is_active)
         VALUES ($1,$2,$3::issue_severity,$4,$5,$6,$7,$8,$9,$10,true)
         ON CONFLICT (id) DO UPDATE SET
           category = EXCLUDED.category,
           default_severity = EXCLUDED.default_severity,
           default_weight = EXCLUDED.default_weight,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           seo_impact = EXCLUDED.seo_impact,
           business_impact = EXCLUDED.business_impact,
           suggested_fix = EXCLUDED.suggested_fix,
           doc_url = EXCLUDED.doc_url`,
        [
          c.id,
          c.category,
          c.defaultSeverity,
          c.weight,
          c.name,
          c.description,
          c.technicalExplanation,
          c.businessImpact,
          c.suggestedFix,
          c.docUrl ?? null,
        ],
      );
    }
    this.logger.log(`seeded ${CATALOG_CHECKS.length} checks into the catalog`);
    return CATALOG_CHECKS.length;
  }
}
