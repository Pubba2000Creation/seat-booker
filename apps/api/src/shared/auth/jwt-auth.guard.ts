import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { isRole } from '@seat-booker/contracts';
import type { Request } from 'express';
import { USER_REPOSITORY, type UserRepository } from '../../modules/auth/domain/user.repository';
import { InvalidTokenError } from '../../modules/auth/domain/auth.errors';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedUser, JwtPayload, RequestWithUser } from './authenticated-user';

/**
 * Global guard #1 of 2. Registered BEFORE `RolesGuard` so an unauthenticated request gets
 * 401 rather than 403 — the permission-matrix test depends on that distinction, and a 403
 * for a missing token would wrongly tell the caller the route exists and they are known.
 *
 * Every failure throws `InvalidTokenError` (code `UNAUTHENTICATED`, 401) with one message,
 * so a caller cannot tell a malformed token from an expired one from a deactivated account.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only `POST /api/auth/login` opts out.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();

    const token = this.extractBearerToken(request);
    if (token === null) throw new InvalidTokenError('You need to sign in to do that.');

    const payload = await this.verify(token);

    /*
     * THE PER-REQUEST DATABASE READ — deliberate, not an oversight.
     *
     * JWTs cannot be revoked, so a deactivated user's outstanding token would keep working
     * until it expired (up to 8h with the default JWT_EXPIRES_IN). REQUIREMENTS §13
     * requires that token to stop working on the very NEXT request, so the guard re-reads
     * the row and `findActiveById` filters on `is_active` in SQL.
     *
     * Trade-off accepted: one indexed primary-key lookup per authenticated request. At ~15
     * staff this is free, and the alternative (a token denylist or refresh-token rotation)
     * is far more machinery for the same guarantee. Note it in DESIGN.md under Trade-offs.
     */
    const user = await this.users.findActiveById(payload.sub);
    if (user === null) throw new InvalidTokenError();

    /*
     * The identity attached to the request comes from the DATABASE ROW, not the token. If
     * an admin changed this user's role after the token was issued, the new role takes
     * effect immediately — and a tampered `role` claim is irrelevant because it is never
     * read past this point. A role is never taken from a request body or header.
     */
    const authenticated: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email.value,
      role: user.role,
    };
    request.user = authenticated;

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return null;

    const [scheme, value, ...rest] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer') return null;
    if (value === undefined || value.length === 0 || rest.length > 0) return null;

    return value;
  }

  private async verify(token: string): Promise<JwtPayload> {
    let decoded: unknown;
    try {
      // The generic is constrained to `object` by @nestjs/jwt; we immediately treat the
      // result as unknown and validate every claim below rather than trusting the shape.
      decoded = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      // Swallowed on purpose: the library's message distinguishes "jwt expired" from
      // "invalid signature", and neither belongs in a response. Nothing is lost — an
      // invalid token is not a server-side incident worth logging at error level.
      throw new InvalidTokenError();
    }

    // Validate the decoded payload rather than trusting a cast. A token signed with our
    // secret but carrying an unexpected shape is still a token we must refuse.
    if (typeof decoded !== 'object' || decoded === null) throw new InvalidTokenError();
    const claims = decoded as Record<string, unknown>;

    const sub = claims['sub'];
    const role = claims['role'];
    const iat = claims['iat'];
    const exp = claims['exp'];

    if (typeof sub !== 'string' || sub.length === 0) throw new InvalidTokenError();
    if (!isRole(role)) throw new InvalidTokenError();
    if (typeof iat !== 'number' || typeof exp !== 'number') throw new InvalidTokenError();

    return { sub, role, iat, exp };
  }
}
