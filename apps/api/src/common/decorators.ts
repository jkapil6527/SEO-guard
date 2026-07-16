import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ProjectRole } from '@seo-guardian/shared';
import { SYSTEM_USER } from './auth-user';
import type { AuthUser } from './auth-user';

/**
 * Authentication has been removed. The role/access decorators below are retained
 * as inert metadata markers so controllers still document intent and compile
 * unchanged, but no guard reads them — every endpoint is public.
 */
export type ProjectScopeEntity = 'project' | 'website' | 'source' | 'schedule' | 'crawl';

export const Public = () => SetMetadata('isPublic', true);
export const SuperAdminOnly = () => SetMetadata('superAdminOnly', true);
export const RequireProjectRole = (role: ProjectRole, entity: ProjectScopeEntity, param: string) =>
  SetMetadata('projectRole', { role, entity, param });

/** Always resolves to the fixed system actor (auth removed). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): AuthUser => SYSTEM_USER,
);
