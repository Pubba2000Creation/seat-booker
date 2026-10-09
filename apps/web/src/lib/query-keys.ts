import type {
  RegistrationFilters,
  RegistrationStatusFilter,
  UserFilters,
  WorkshopFilters,
} from '@seat-booker/contracts';

/**
 * Every query key in the app is built here.
 *
 * Centralising them is what makes invalidation after register/cancel reliable: a mutation
 * declares exactly which keys it invalidates, and a typo cannot silently create a key that
 * nothing ever refetches. The prefixes are arranged so `['workshops']` invalidates every
 * filtered list at once while `['workshop', id]` stays precise.
 */
export const queryKeys = {
  currentUser: ['auth', 'me'] as const,

  /** Every workshop list, regardless of filters — the invalidation target. */
  workshops: ['workshops'] as const,
  workshopList: (filters: WorkshopFilters) => ['workshops', filters] as const,
  workshop: (id: string) => ['workshop', id] as const,

  /** Every registration list for one workshop, across status tabs. */
  workshopRegistrations: (workshopId: string) => ['registrations', workshopId] as const,
  workshopRegistrationList: (workshopId: string, status: RegistrationStatusFilter) =>
    ['registrations', workshopId, status] as const,

  /** Every global history search, regardless of filters — the invalidation target. */
  registrationSearchAll: ['registrations', 'search'] as const,
  registrationSearch: (filters: RegistrationFilters) =>
    ['registrations', 'search', filters] as const,

  users: ['users'] as const,
  userList: (filters: UserFilters) => ['users', filters] as const,
} as const;
