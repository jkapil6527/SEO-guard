import { ProjectRole } from './enums';

/**
 * Role hierarchy for project-scoped authorization. A required role is satisfied
 * by any role with an equal or higher rank. Super admins bypass this entirely.
 */
const ROLE_RANK: Record<ProjectRole, number> = {
  [ProjectRole.Admin]: 40,
  [ProjectRole.SeoManager]: 30,
  [ProjectRole.Developer]: 20,
  [ProjectRole.Viewer]: 10,
};

export function roleSatisfies(actual: ProjectRole, required: ProjectRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export const ALL_PROJECT_ROLES: readonly ProjectRole[] = [
  ProjectRole.Admin,
  ProjectRole.SeoManager,
  ProjectRole.Developer,
  ProjectRole.Viewer,
];
