"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SitemapGroupsModule = void 0;
const common_1 = require("@nestjs/common");
const crawls_module_1 = require("../crawls/crawls.module");
const sitemap_groups_controller_1 = require("./sitemap-groups.controller");
const sitemap_groups_service_1 = require("./sitemap-groups.service");
let SitemapGroupsModule = class SitemapGroupsModule {
};
exports.SitemapGroupsModule = SitemapGroupsModule;
exports.SitemapGroupsModule = SitemapGroupsModule = __decorate([
    (0, common_1.Module)({
        imports: [crawls_module_1.CrawlsModule],
        controllers: [sitemap_groups_controller_1.SitemapGroupsController],
        providers: [sitemap_groups_service_1.SitemapGroupsService],
        exports: [sitemap_groups_service_1.SitemapGroupsService],
    })
], SitemapGroupsModule);
//# sourceMappingURL=sitemap-groups.module.js.map