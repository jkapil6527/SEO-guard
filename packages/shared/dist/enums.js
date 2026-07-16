"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.IssueSeverity = exports.CrawlStatus = exports.CrawlScope = exports.CrawlMode = exports.UrlSourceType = exports.ProjectRole = void 0;
var ProjectRole;
(function (ProjectRole) {
    ProjectRole["Admin"] = "admin";
    ProjectRole["SeoManager"] = "seo_manager";
    ProjectRole["Developer"] = "developer";
    ProjectRole["Viewer"] = "viewer";
})(ProjectRole || (exports.ProjectRole = ProjectRole = {}));
var UrlSourceType;
(function (UrlSourceType) {
    UrlSourceType["Manual"] = "manual";
    UrlSourceType["Csv"] = "csv";
    UrlSourceType["Sitemap"] = "sitemap";
    UrlSourceType["Discovery"] = "discovery";
})(UrlSourceType || (exports.UrlSourceType = UrlSourceType = {}));
var CrawlMode;
(function (CrawlMode) {
    CrawlMode["Full"] = "full";
    CrawlMode["Incremental"] = "incremental";
})(CrawlMode || (exports.CrawlMode = CrawlMode = {}));
/**
 * How much of the website a crawl covers. Orthogonal to CrawlMode, which only
 * decides how much is re-fetched: a Page crawl visits exactly one URL and never
 * follows links, whatever its mode.
 */
var CrawlScope;
(function (CrawlScope) {
    /** Every active source of the website, merged. */
    CrawlScope["Site"] = "site";
    /** Exactly one URL; links are verified but never followed. */
    CrawlScope["Page"] = "page";
    /** One sitemap group (category) — the URLs of that sitemap and nothing else. */
    CrawlScope["Group"] = "group";
})(CrawlScope || (exports.CrawlScope = CrawlScope = {}));
var CrawlStatus;
(function (CrawlStatus) {
    CrawlStatus["Queued"] = "queued";
    CrawlStatus["Resolving"] = "resolving";
    CrawlStatus["Running"] = "running";
    CrawlStatus["Paused"] = "paused";
    CrawlStatus["Finalizing"] = "finalizing";
    CrawlStatus["Completed"] = "completed";
    CrawlStatus["Failed"] = "failed";
    CrawlStatus["Cancelled"] = "cancelled";
})(CrawlStatus || (exports.CrawlStatus = CrawlStatus = {}));
var IssueSeverity;
(function (IssueSeverity) {
    IssueSeverity["Critical"] = "critical";
    IssueSeverity["High"] = "high";
    IssueSeverity["Medium"] = "medium";
    IssueSeverity["Low"] = "low";
    IssueSeverity["Info"] = "info";
})(IssueSeverity || (exports.IssueSeverity = IssueSeverity = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["Create"] = "create";
    AuditAction["Update"] = "update";
    AuditAction["Delete"] = "delete";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
//# sourceMappingURL=enums.js.map