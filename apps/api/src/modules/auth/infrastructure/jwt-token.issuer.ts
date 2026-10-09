import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@seat-booker/contracts';
import type { TokenIssuer } from '../domain/user.repository';

/**
 * `@nestjs/jwt` implementation of the token port.
 *
 * The signed payload is exactly `{ sub, role }` plus the `iat`/`exp` the library adds —
 * nothing more. In particular `isActive` is absent: it would go stale the moment an admin
 * deactivated the user, and tokens are not revocable. Active status is resolved from the
 * database on every request instead (see `JwtAuthGuard`).
 */
@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  async issue(userId: string, role: Role): Promise<string> {
    return this.jwt.signAsync({ sub: userId, role });
  }
}
