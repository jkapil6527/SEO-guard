export declare enum ProjectRole {
    Admin = "admin",
    SeoManager = "seo_manager",
    Developer = "developer",
    Viewer = "viewer"
}
export declare enum UrlSourceType {
    Manual = "manual",
    Csv = "csv",
    Sitemap = "sitemap",
    Discovery = "discovery"
}
export declare enum CrawlMode {
    Full = "full",
    Incremental = "incremental"
}
/**
 * How much of the website a crawl covers. Orthogonal to CrawlMode, which only
 * decides how much is re-fetched: a Page crawl visits exactly one URL and never
 * follows links, whatever its mode.
 */
export declare enum CrawlScope {
    /** Every active source of the website, merged. */
    Site = "site",
    /** Exactly one URL; links are verified but never followed. */
    Page = "page",
    /** One sitemap group (category) — the URLs of that sitemap and nothing else. */
    Group = "group"
}
export declare enum CrawlStatus {
    Queued = "queued",
    Resolving = "resolving",
    Running = "running",
    Paused = "paused",
    Finalizing = "finalizing",
    Completed = "completed",
    Failed = "failed",
    Cancelled = "cancelled"
}
export declare enum IssueSeverity {
    Critical = "critical",
    High = "high",
    Medium = "medium",
    Low = "low",
    Info = "info"
}
export declare enum AuditAction {
    Create = "create",
    Update = "update",
    Delete = "delete"
}
