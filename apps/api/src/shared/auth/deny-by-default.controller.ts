import { Controller, Get } from '@nestjs/common';

/**
 * PROOF FIXTURE — not a feature.
 *
 * `GET /api/_guard-probe/bare` carries NO `@Roles(...)` and NO `@Public()`. It exists so
 * the deny-by-default branch of `RolesGuard` can be exercised by a real request: a valid
 * token for any role must still get 403 here, and the handler body must never run.
 *
 * Phase 6's permission-matrix test asserts against this route, which is why it is kept
 * rather than deleted after the Phase 2 gate. It is registered only outside production
 * (see `AppModule`), so it cannot widen the real surface area.
 */
@Controller('_guard-probe')
export class DenyByDefaultProbeController {
  @Get('bare')
  bare(): { reached: true } {
    // Unreachable by design. If this body ever executes, deny-by-default is broken and the
    // response is the signal.
    return { reached: true };
  }
}
