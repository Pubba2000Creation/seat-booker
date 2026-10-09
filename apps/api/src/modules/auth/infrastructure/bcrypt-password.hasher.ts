import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from '../../../shared/config/app-config.service';
import type { PasswordHasher } from '../domain/user.repository';

/**
 * bcrypt implementation of the hashing port. Cost comes from `BCRYPT_ROUNDS` (10 in dev)
 * so it can be lowered for the test suite without touching code.
 */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly config: AppConfigService) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.config.bcryptRounds);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    // bcrypt.compare rejects if `hash` is not a valid bcrypt string. A corrupt stored hash
    // is an authentication failure, not a 500 — and must not be distinguishable from a
    // wrong password.
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }
}
