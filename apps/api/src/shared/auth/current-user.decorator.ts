import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { UnauthenticatedError } from '../errors/domain.error';
import type { AuthenticatedUser, RequestWithUser } from './authenticated-user';

/**
 * Injects the request-scoped identity that `JwtAuthGuard` resolved. Throws rather than
 * returning `undefined` if it is missing, which keeps controller signatures free of
 * `AuthenticatedUser | undefined` and avoids a non-null assertion. In practice it can only
 * be missing if someone uses `@CurrentUser()` on a `@Public()` route.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (user === undefined) {
      throw new UnauthenticatedError();
    }
    return user;
  },
);
