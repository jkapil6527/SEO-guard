import type { ProjectRole } from '@seo-guardian/shared';
/**
 * Authentication has been removed. The role/access decorators below are retained
 * as inert metadata markers so controllers still document intent and compile
 * unchanged, but no guard reads them — every endpoint is public.
 */
export type ProjectScopeEntity = 'project' | 'website' | 'source' | 'schedule' | 'crawl';
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const SuperAdminOnly: () => import("@nestjs/common").CustomDecorator<string>;
export declare const RequireProjectRole: (role: ProjectRole, entity: ProjectScopeEntity, param: string) => import("@nestjs/common").CustomDecorator<string>;
/** Always resolves to the fixed system actor (auth removed). */
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
