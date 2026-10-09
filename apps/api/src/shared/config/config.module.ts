import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { APP_CONFIG, AppConfigService } from './app-config.service';
import { loadAppConfig, type AppConfig } from './env.schema';

/**
 * Global so every module can inject `AppConfigService` without re-importing. `loadAppConfig`
 * throws during provider construction, which Nest surfaces as a boot failure — the app
 * cannot start misconfigured.
 */
@Global()
@Module({
  imports: [
    // `.env` is loaded relative to the process cwd, which for `pnpm --filter @seat-booker/api`
    // is always `apps/api`. Real environment variables win over the file.
    NestConfigModule.forRoot({ envFilePath: '.env', ignoreEnvFile: false, cache: true }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadAppConfig(process.env),
    },
    AppConfigService,
  ],
  exports: [AppConfigService, APP_CONFIG],
})
export class AppConfigModule {}
