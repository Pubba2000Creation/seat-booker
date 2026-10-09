import type { ActorSummary } from './registration.contract';

/** Audit actions, written inside the same transaction as the change they describe. */
export type AuditAction =
  | 'USER_CREATED'
  | 'ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'PASSWORD_RESET'
  | 'WORKSHOP_CREATED'
  | 'WORKSHOP_UPDATED'
  | 'REGISTRATION_CREATED'
  | 'REGISTRATION_CANCELLED'
  | 'REGISTRATION_PROMOTED';

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'USER_CREATED',
  'ROLE_CHANGED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'PASSWORD_RESET',
  'WORKSHOP_CREATED',
  'WORKSHOP_UPDATED',
  'REGISTRATION_CREATED',
  'REGISTRATION_CANCELLED',
  'REGISTRATION_PROMOTED',
] as const;

export type AuditEntityType = 'USER' | 'WORKSHOP' | 'REGISTRATION';

export interface AuditLogResponse {
  readonly id: string;
  readonly actor: ActorSummary | null;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** Never contains `passwordHash`. */
  readonly before: Record<string, unknown> | null;
  /** Never contains `passwordHash`. */
  readonly after: Record<string, unknown> | null;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
}

export interface AuditLogFilters {
  readonly entityType?: AuditEntityType;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly action?: AuditAction;
  readonly page?: number;
  readonly pageSize?: number;
}
