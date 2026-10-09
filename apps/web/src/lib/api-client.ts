import { API_BASE_URL } from './config';
import { ApiRequestError, isApiError, networkError, unparseableResponseError } from './api-error';
import { readToken } from './token-storage';

/**
 * The one place an HTTP request is made.
 *
 * Responsibilities, deliberately few:
 * - attach the bearer token
 * - serialise the body and query string
 * - turn every non-2xx into an `ApiRequestError` carrying the envelope's `code`
 *
 * It does NOT decide what a failure means. A 401 is reported, not acted on — the auth
 * context owns logging the user out, because only it can also clear React state. Keeping
 * that decision out of here is what stops two layers fighting over the session.
 */

type QueryValue = string | number | boolean | undefined | null;

export type QueryParams = Readonly<Record<string, QueryValue>>;

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly query?: QueryParams;
  /** Lets TanStack Query cancel an in-flight request when a component unmounts. */
  readonly signal?: AbortSignal;
  /**
   * Overrides the stored token. Used by login, which must authenticate the follow-up
   * request with the token it was just handed rather than one not yet persisted.
   */
  readonly token?: string;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      // Undefined, null and empty-string params are dropped rather than sent blank: the
      // API's ValidationPipe runs with `forbidNonWhitelisted`, and an empty `status=`
      // would be a 400 rather than "no filter".
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseErrorBody(response: Response): Promise<ApiRequestError> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return unparseableResponseError(response.status);
  }

  // Only a well-formed envelope is trusted. Anything else (an HTML error page that
  // happened to parse, a bare string) falls back to a generic sentence.
  if (isApiError(parsed)) {
    return new ApiRequestError(parsed);
  }

  return unparseableResponseError(response.status);
}

export async function request<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { method = 'GET', body, query, signal, token } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  const bearer = token ?? readToken();
  if (bearer !== null) {
    headers['Authorization'] = `Bearer ${bearer}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (error: unknown) {
    // An aborted request is not a failure to report — rethrow so TanStack Query can
    // recognise it as a cancellation instead of rendering an error state.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw networkError();
  }

  if (!response.ok) {
    throw await parseErrorBody(response);
  }

  // 204, or any empty body: the caller's TResponse is `void` in that case.
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined as TResponse;
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    // A 2xx with an unparseable body is a server bug; surface it as a generic failure
    // rather than crashing the render with a JSON exception.
    throw unparseableResponseError(response.status);
  }
}
