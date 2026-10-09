/**
 * Email value object. Normalisation lives here so there is exactly ONE definition of what
 * "the same email" means, used by login, user creation, and attendee registration alike.
 *
 * The brief (§13) requires `A@X.com  ` and `a@x.com` to be treated as the same person, and
 * the schema's `users_email_lower_unique` index plus the registrations partial unique index
 * both depend on the stored value already being trimmed and lower-cased.
 *
 * Pure TS — no Nest, no Drizzle, no HTTP.
 */

/** Thrown on a malformed address. Validation at the edge means this is rarely reached. */
export class InvalidEmailError extends Error {
  constructor(message = 'Please enter a valid email address.') {
    super(message);
    this.name = 'InvalidEmailError';
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

const MAX_EMAIL_LENGTH = 254;

/**
 * Pragmatic address check: one `@`, a non-empty local part, a dotted domain, no spaces.
 * Deliberately not RFC 5322-complete — the goal is to catch typos, and a real address is
 * only ever proven by delivering to it.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class Email {
  private constructor(public readonly value: string) {}

  /** Trims, lower-cases, and validates. The only way to construct an `Email`. */
  static create(raw: string): Email {
    const normalised = raw.trim().toLowerCase();

    if (normalised.length === 0 || normalised.length > MAX_EMAIL_LENGTH) {
      throw new InvalidEmailError();
    }
    if (!EMAIL_PATTERN.test(normalised)) {
      throw new InvalidEmailError();
    }

    return new Email(normalised);
  }

  /**
   * Normalises without throwing. Used on the login path, where a malformed address must
   * produce the same generic "Email or password is incorrect." as a wrong password — a
   * different error for a malformed address would leak nothing useful, but keeping one
   * message for the whole login failure path is simpler to reason about.
   */
  static normalise(raw: string): string {
    return raw.trim().toLowerCase();
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
