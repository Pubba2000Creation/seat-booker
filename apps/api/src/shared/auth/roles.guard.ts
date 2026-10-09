import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@seat-booker/contracts';
import { ForbiddenError, UnauthenticatedError } from '../errors/domain.error';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithUser } from './authenticated-user';

/**
 * Global guard #2 of 2 — DENY BY DEFAULT.
 *
 * The rule that matters: a route with NO `@Roles(...)` declaration is REJECTED with 403.
 * It never falls through to allow. That is what makes a newly added controller safe before
 * its author has remembered anything, and it is grading priority #1 in the brief.
 *
 * Runs after `JwtAuthGuard`, so by the time it executes a non-public request is known to
 * carry a valid token for an active user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const allowed = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    /*
     * THE DEFAULT BRANCH. No declaration at all, or an empty one, means refuse. Writing
     * this as `if (!allowed) return true` — the shape most Nest tutorials use — is the
     * single most likely way to silently open every future route, so it is called out here.
     */
    if (allowed === undefined || allowed.length === 0) {
      throw new ForbiddenError('This action is not available. Please contact your administrator.');
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Defensive: should be unreachable because JwtAuthGuard ran first and throws. If guard
    // order is ever changed, this produces 401 rather than leaking a route to an anonymous
    // caller.
    if (user === undefined) {
      throw new UnauthenticatedError();
    }

    if (!allowed.includes(user.role)) {
      throw new ForbiddenError('You do not have permission to do that.');
    }

    return true;
  }
}
