import type { AuthUser } from '../common/auth-user';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Set by ProjectRoleGuard after resolving the resource's owning project. */
      projectId?: string;
    }
  }
}

export {};
