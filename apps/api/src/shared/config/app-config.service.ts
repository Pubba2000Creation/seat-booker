import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from './env.schema';

export const APP_CONFIG = Symbol('AppConfig');

/**
 * Typed accessor over the validated config object. Feature code injects this rather than
 * Nest's `ConfigService`, so no caller ever has to handle a `string | undefined` or repeat
 * a `Number(...)` cast — the parsing happened once at boot.
 */
@Injectable()
export class AppConfigService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get nodeEnv(): AppConfig['nodeEnv'] {
    return this.config.nodeEnv;
  }

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get jwtSecret(): string {
    return this.config.jwtSecret;
  }

  get jwtExpiresIn(): string {
    return this.config.jwtExpiresIn;
  }

  get jwtExpiresInSeconds(): number {
    return this.config.jwtExpiresInSeconds;
  }

  get port(): number {
    return this.config.port;
  }

  get corsOrigins(): readonly string[] {
    return this.config.corsOrigins;
  }

  get bcryptRounds(): number {
    return this.config.bcryptRounds;
  }

  get centreTimezone(): string {
    return this.config.centreTimezone;
  }

  get isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }
}
