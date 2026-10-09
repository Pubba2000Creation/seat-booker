import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './shared/config/app-config.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Config is validated during module construction, so reaching this line already proves
  // the environment is sound.
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties with no DTO decorator ...
      whitelist: true,
      // ... and reject the request outright if any were sent, rather than silently
      // ignoring them. A client sending `role` to a route that does not accept it should
      // find out, not have it quietly dropped.
      forbidNonWhitelisted: true,
      // Runs the DTO @Transform hooks (email trim + lower-case) and coerces query params.
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: [...config.corsOrigins],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // No cookies are used — the token travels in the Authorization header — so credentials
    // stay off and the origin list can remain strict.
    credentials: false,
  });

  // Lets the DatabaseModule close its connection pool on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  await app.listen(config.port);

  logger.log(`API listening on http://localhost:${config.port}/api`);
  logger.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
  logger.log(`Centre timezone: ${config.centreTimezone} (all timestamps stored UTC)`);
}

void bootstrap().catch((error: unknown) => {
  // Config validation failures land here. Print the message and exit non-zero rather than
  // leaving a half-started process — a misconfigured API must not look healthy.
  new Logger('Bootstrap').error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
