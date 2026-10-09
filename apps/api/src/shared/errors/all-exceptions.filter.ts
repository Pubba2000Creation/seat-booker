import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ERROR_CODE_STATUS, isErrorCode } from '@seat-booker/contracts';
import type { ApiError, ApiErrorDetail, ErrorCode } from '@seat-booker/contracts';
import type { Request, Response } from 'express';
import { isDomainError } from './domain.error';
import { asPostgresError, mapPostgresError } from './postgres-error';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The ONLY place in the application that turns an error into an HTTP response. Every
 * failure leaves here as the `ApiError` envelope, which is why no use-case ever needs to
 * know an HTTP status code exists.
 *
 * Security rule enforced here: a stack trace, SQL fragment, or raw driver message never
 * reaches the client. Unrecognised errors become a generic 500 and are logged in full
 * server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const envelope = this.toEnvelope(exception, request);
    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown, request: Request): ApiError {
    // 1. Domain errors — the expected path. Status comes from the contract table, so the
    //    code/status pairing can never drift between layers.
    if (isDomainError(exception)) {
      return this.build(exception.code, exception.message, exception.details);
    }

    // 2. Nest HttpException — chiefly the global ValidationPipe, plus 404 for an unknown
    //    route and anything a third-party Nest component throws.
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    // 3. Postgres constraint violations that slipped past the application check.
    const pgError = asPostgresError(exception);
    if (pgError !== null) {
      const mapped = mapPostgresError(pgError);
      // The driver error is logged whether or not we recognised it — the SQLSTATE and
      // constraint name are what makes a production incident diagnosable.
      this.logUnexpected(exception, request, `postgres ${pgError.code} ${pgError.constraint_name}`);
      if (mapped !== null) {
        return this.build(mapped.code, mapped.message);
      }
      return this.build('INTERNAL_ERROR', GENERIC_MESSAGE);
    }

    // 4. Anything else. Generic message out, full detail to the log.
    this.logUnexpected(exception, request, 'unhandled');
    return this.build('INTERNAL_ERROR', GENERIC_MESSAGE);
  }

  private fromHttpException(exception: HttpException, request: Request): ApiError {
    const status = exception.getStatus();
    const payload: unknown = exception.getResponse();

    // A nested handler may already have produced a correct envelope (e.g. a sub-app or a
    // deliberately thrown HttpException carrying a contract code). Pass it through.
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      const code = record['code'];
      if (isErrorCode(code) && typeof record['message'] === 'string') {
        return this.build(code, record['message'], this.readDetails(record['details']));
      }
    }

    if (status === HttpStatus.BAD_REQUEST) {
      return this.build(
        'VALIDATION_ERROR',
        'Some of the information provided is not valid. Please check the highlighted fields.',
        this.extractValidationDetails(payload),
      );
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return this.build('UNAUTHENTICATED', 'You need to sign in to do that.');
    }

    if (status === HttpStatus.FORBIDDEN) {
      return this.build('FORBIDDEN', 'You do not have permission to do that.');
    }

    if (status === HttpStatus.NOT_FOUND) {
      return this.build('NOT_FOUND', 'That page or record could not be found.');
    }

    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return this.build('VALIDATION_ERROR', 'That request was too large.');
    }

    // Any other HttpException status (409, 429, 500 ...) — do not echo its message, which
    // may have been written by a library and is not guaranteed to be staff-readable.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logUnexpected(exception, request, `http ${status}`);
      return this.build('INTERNAL_ERROR', GENERIC_MESSAGE);
    }

    this.logUnexpected(exception, request, `http ${status}`);
    return { statusCode: status, code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE };
  }

  /**
   * The ValidationPipe's default payload is `{ message: string[] }` where each entry is a
   * sentence like `email must be an email`. We split the field name off the front so the
   * frontend can attach each message to the right form control.
   */
  private extractValidationDetails(payload: unknown): readonly ApiErrorDetail[] | undefined {
    if (typeof payload !== 'object' || payload === null) return undefined;
    const message = (payload as Record<string, unknown>)['message'];
    if (!Array.isArray(message)) return undefined;

    const details: ApiErrorDetail[] = [];
    for (const entry of message) {
      if (typeof entry !== 'string') continue;
      const firstSpace = entry.indexOf(' ');
      const field = firstSpace > 0 ? entry.slice(0, firstSpace) : entry;
      details.push({ field, message: entry });
    }
    return details.length > 0 ? details : undefined;
  }

  private readDetails(value: unknown): readonly ApiErrorDetail[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const details: ApiErrorDetail[] = [];
    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (typeof record['field'] === 'string' && typeof record['message'] === 'string') {
        details.push({ field: record['field'], message: record['message'] });
      }
    }
    return details.length > 0 ? details : undefined;
  }

  private build(code: ErrorCode, message: string, details?: readonly ApiErrorDetail[]): ApiError {
    const statusCode = ERROR_CODE_STATUS[code];
    return details === undefined
      ? { statusCode, code, message }
      : { statusCode, code, message, details };
  }

  private logUnexpected(exception: unknown, request: Request, kind: string): void {
    const where = `${request.method} ${request.url}`;
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`Unhandled error (${kind}) on ${where}: ${this.describe(exception)}`, stack);
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) return `${exception.name}: ${exception.message}`;
    if (typeof exception === 'string') return exception;
    return 'non-Error value thrown';
  }
}
