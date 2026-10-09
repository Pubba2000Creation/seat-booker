/**
 * Roles are union literals, not TS enums, so the frontend can type against them
 * without a runtime import. The API's Drizzle `pgEnum` mirrors these values.
 */
export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export const ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'STAFF'] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
