import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as bcrypt from 'bcrypt';
import { getDatabaseUrl } from './env';
import { registrations, users, workshops } from './schema';
import type { Role } from '@seat-booker/contracts';

/**
 * Development seed. Idempotent: every row is keyed on a natural identifier (user email,
 * workshop code, workshop + attendee email) and upserted, so running this repeatedly
 * neither duplicates rows nor drifts the capacity counter.
 *
 * Workshop dates are computed relative to the moment of seeding, so the demo data is
 * always "this week" no matter when a reviewer runs it.
 *
 * IMPORTANT — `active_count`:
 * This script is the one place outside the register/cancel transactions that writes
 * `active_count`, and it does so only because it also authors the registration rows
 * themselves. The value written is a literal derived from the seed definition below, and
 * is re-derived from the actual ACTIVE rows at the end (`reconcileActiveCounts`) rather
 * than being read-modify-written. A mismatch here would make every capacity test lie.
 */

const BCRYPT_ROUNDS = Number(process.env['BCRYPT_ROUNDS'] ?? 10);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface SeedUser {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: Role;
}

const SEED_USERS: readonly SeedUser[] = [
  { name: 'Centre Admin', email: 'admin@centre.dev', password: 'Admin123!', role: 'ADMIN' },
  {
    name: 'Priya Manager',
    email: 'manager@centre.dev',
    password: 'Manager123!',
    role: 'MANAGER',
  },
  { name: 'Sunil Staff', email: 'staff@centre.dev', password: 'Staff123!', role: 'STAFF' },
];

type SeedLocation = 'COLOMBO' | 'KALUTARA' | 'GALLE';
type SeedStatus = 'DRAFT' | 'OPEN' | 'CANCELLED' | 'COMPLETED';

interface SeedAttendee {
  readonly name: string;
  readonly email: string;
  /** CANCELLED rows exist so the History tab is never empty. */
  readonly cancelled?: boolean;
  readonly cancelReason?: string;
}

interface SeedWorkshop {
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  /** Days from the seed moment. Negative is in the past. */
  readonly startsInDays: number;
  readonly startHour: number;
  readonly durationHours: number;
  readonly capacity: number;
  readonly status: SeedStatus;
  readonly location: SeedLocation;
  readonly description: string;
  readonly attendees: readonly SeedAttendee[];
}

/**
 * The demo set required by REQUIREMENTS.md §10. Attendee counts are chosen so that each
 * workshop lands in a specific, demonstrable capacity state.
 */
const SEED_WORKSHOPS: readonly SeedWorkshop[] = [
  // --- 3 x OPEN with plenty of seats -------------------------------------------------
  {
    code: 'POT-BEGIN-01',
    title: 'Pottery for Beginners',
    instructor: 'Anoma Silva',
    startsInDays: 2,
    startHour: 9,
    durationHours: 3,
    capacity: 20,
    status: 'OPEN',
    location: 'COLOMBO',
    description: 'Hand-building and glazing basics. Clay and tools provided.',
    attendees: [
      { name: 'Nimal Perera', email: 'nimal.perera@example.com' },
      { name: 'Kamala Fernando', email: 'kamala.fernando@example.com' },
      { name: 'Ruwan Jayasuriya', email: 'ruwan.jayasuriya@example.com' },
      // A cancelled row, so History has something to show from the start.
      {
        name: 'Dilani Gunawardena',
        email: 'dilani.gunawardena@example.com',
        cancelled: true,
        cancelReason: 'Attendee called to cancel — work travel.',
      },
    ],
  },
  {
    code: 'WOOD-CARVE-02',
    title: 'Traditional Wood Carving',
    instructor: 'Mahesh Bandara',
    startsInDays: 3,
    startHour: 14,
    durationHours: 4,
    capacity: 15,
    status: 'OPEN',
    location: 'KALUTARA',
    description: 'Relief carving techniques on local jak wood.',
    attendees: [
      { name: 'Saman Wickrama', email: 'saman.wickrama@example.com' },
      { name: 'Ayesha Nawaz', email: 'ayesha.nawaz@example.com' },
    ],
  },
  {
    code: 'BATIK-INTRO-03',
    title: 'Batik Dyeing Workshop',
    instructor: 'Chamari Rajapaksa',
    startsInDays: 4,
    startHour: 10,
    durationHours: 3,
    capacity: 12,
    status: 'OPEN',
    location: 'GALLE',
    description: 'Wax-resist dyeing: design, wax, dye, finish.',
    attendees: [
      { name: 'Tharindu Alwis', email: 'tharindu.alwis@example.com' },
      {
        name: 'Nadeesha Kumari',
        email: 'nadeesha.kumari@example.com',
        cancelled: true,
        cancelReason: 'Double-booked with a family event.',
      },
    ],
  },

  // --- 1 x OPEN with EXACTLY 1 seat left (capacity 6, 5 active) ----------------------
  // This is the workshop a reviewer uses to demo the Saturday-morning race.
  {
    code: 'COOK-CURRY-04',
    title: 'Sri Lankan Curry Masterclass',
    instructor: 'Lakshmi Dias',
    startsInDays: 5,
    startHour: 11,
    durationHours: 3,
    capacity: 6,
    status: 'OPEN',
    location: 'COLOMBO',
    description: 'ONE SEAT LEFT — use this workshop to demonstrate the capacity race.',
    attendees: [
      { name: 'Hiran Senanayake', email: 'hiran.senanayake@example.com' },
      { name: 'Malini Rathnayake', email: 'malini.rathnayake@example.com' },
      { name: 'Jagath Ekanayake', email: 'jagath.ekanayake@example.com' },
      { name: 'Shanika Pathirana', email: 'shanika.pathirana@example.com' },
      { name: 'Buddhika Herath', email: 'buddhika.herath@example.com' },
    ],
  },

  // --- 1 x genuinely FULL (capacity 4, 4 active) -------------------------------------
  // "Full" is derived from activeCount === capacity, never stored as a status.
  {
    code: 'WEAVE-HAND-05',
    title: 'Handloom Weaving Intensive',
    instructor: 'Padma Wijesinghe',
    startsInDays: 6,
    startHour: 9,
    durationHours: 5,
    capacity: 4,
    status: 'OPEN',
    location: 'KALUTARA',
    description: 'FULL — every seat taken. Registering here must return WORKSHOP_FULL.',
    attendees: [
      { name: 'Chathura Gamage', email: 'chathura.gamage@example.com' },
      { name: 'Iresha Madushani', email: 'iresha.madushani@example.com' },
      { name: 'Pradeep Kulatunga', email: 'pradeep.kulatunga@example.com' },
      { name: 'Vishaka Amarasinghe', email: 'vishaka.amarasinghe@example.com' },
    ],
  },

  // --- 1 x DRAFT (not bookable) ------------------------------------------------------
  {
    code: 'MASK-DANCE-06',
    title: 'Mask Making & Kolam Dance',
    instructor: 'Ranjith Peris',
    startsInDays: 9,
    startHour: 15,
    durationHours: 3,
    capacity: 18,
    status: 'DRAFT',
    location: 'GALLE',
    description: 'DRAFT — still being planned. Registration must be refused.',
    attendees: [],
  },

  // --- 1 x CANCELLED, but it keeps its registrations ---------------------------------
  // Deliberate per the §13 edge case: existing registrations stay for the record,
  // new ones are refused.
  {
    code: 'DRUM-GETA-07',
    title: 'Geta Bera Drumming',
    instructor: 'Sarath Kumara',
    startsInDays: 7,
    startHour: 16,
    durationHours: 2,
    capacity: 10,
    status: 'CANCELLED',
    location: 'COLOMBO',
    description: 'CANCELLED — instructor unavailable. Keeps history, blocks new sign-ups.',
    attendees: [{ name: 'Gayan Thilakarathne', email: 'gayan.thilakarathne@example.com' }],
  },

  // --- 1 x past COMPLETED ------------------------------------------------------------
  {
    code: 'JEWEL-SILVER-08',
    title: 'Silver Jewellery Basics',
    instructor: 'Fathima Rizvi',
    startsInDays: -10,
    startHour: 10,
    durationHours: 4,
    capacity: 8,
    status: 'COMPLETED',
    location: 'GALLE',
    description: 'COMPLETED last week — appears in history, not bookable.',
    attendees: [
      { name: 'Asanka Bandaranayake', email: 'asanka.bandaranayake@example.com' },
      { name: 'Rashmi Liyanage', email: 'rashmi.liyanage@example.com' },
      {
        name: 'Oshadi Weerasinghe',
        email: 'oshadi.weerasinghe@example.com',
        cancelled: true,
        cancelReason: 'Fell ill the morning of the workshop.',
      },
    ],
  },
];

/** Monday 00:00 of the seeding week, so relative offsets land predictably. */
function startOfSeedDay(now: Date): Date {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  return base;
}

function workshopTimes(seedDay: Date, w: SeedWorkshop): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(seedDay.getTime() + w.startsInDays * DAY_MS + w.startHour * HOUR_MS);
  const endsAt = new Date(startsAt.getTime() + w.durationHours * HOUR_MS);
  return { startsAt, endsAt };
}

type Database = ReturnType<typeof drizzle>;

async function seedUsers(db: Database): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();

  for (const seedUser of SEED_USERS) {
    const email = seedUser.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(seedUser.password, BCRYPT_ROUNDS);

    // Idempotent on lower(email), matching the users_email_lower_unique index.
    // Re-seeding refreshes the demo password rather than inserting a second row.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    const found = existing[0];
    if (found) {
      await db
        .update(users)
        .set({
          name: seedUser.name,
          passwordHash,
          role: seedUser.role,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, found.id));
      byEmail.set(email, found.id);
      continue;
    }

    const inserted = await db
      .insert(users)
      .values({ name: seedUser.name, email, passwordHash, role: seedUser.role })
      .returning({ id: users.id });

    const row = inserted[0];
    if (!row) throw new Error(`Failed to insert seed user ${email}`);
    byEmail.set(email, row.id);
  }

  return byEmail;
}

async function seedWorkshops(db: Database, managerId: string, staffId: string): Promise<void> {
  const seedDay = startOfSeedDay(new Date());

  for (const seed of SEED_WORKSHOPS) {
    const { startsAt, endsAt } = workshopTimes(seedDay, seed);

    // The ACTIVE count this workshop must end up with, derived from the definition.
    const activeCount = seed.attendees.filter((a) => a.cancelled !== true).length;
    if (activeCount > seed.capacity) {
      throw new Error(
        `Seed definition for ${seed.code} has ${activeCount} active attendees ` +
          `but capacity ${seed.capacity}.`,
      );
    }

    // Idempotent on the unique workshop code.
    const existing = await db
      .select({ id: workshops.id })
      .from(workshops)
      .where(eq(workshops.code, seed.code))
      .limit(1);

    let workshopId: string;
    const found = existing[0];

    if (found) {
      workshopId = found.id;
      await db
        .update(workshops)
        .set({
          title: seed.title,
          instructor: seed.instructor,
          startsAt,
          endsAt,
          capacity: seed.capacity,
          status: seed.status,
          location: seed.location,
          description: seed.description,
          updatedBy: managerId,
          updatedAt: new Date(),
        })
        .where(eq(workshops.id, workshopId));
    } else {
      const inserted = await db
        .insert(workshops)
        .values({
          code: seed.code,
          title: seed.title,
          instructor: seed.instructor,
          startsAt,
          endsAt,
          capacity: seed.capacity,
          status: seed.status,
          location: seed.location,
          description: seed.description,
          // Counter starts at 0 and is set from the real rows by reconcileActiveCounts.
          activeCount: 0,
          createdBy: managerId,
          updatedBy: managerId,
        })
        .returning({ id: workshops.id });

      const row = inserted[0];
      if (!row) throw new Error(`Failed to insert seed workshop ${seed.code}`);
      workshopId = row.id;
    }

    await seedRegistrations(db, workshopId, seed, startsAt, staffId, managerId);
  }
}

async function seedRegistrations(
  db: Database,
  workshopId: string,
  seed: SeedWorkshop,
  startsAt: Date,
  staffId: string,
  managerId: string,
): Promise<void> {
  for (const [offset, attendee] of seed.attendees.entries()) {
    const attendeeEmail = attendee.email.trim().toLowerCase();
    const isCancelled = attendee.cancelled === true;

    // Registered a few days before the workshop, staggered so ordering is stable.
    const registeredAt = new Date(startsAt.getTime() - (3 * DAY_MS - offset * HOUR_MS));
    const cancelledAt = isCancelled ? new Date(registeredAt.getTime() + 12 * HOUR_MS) : null;

    // Idempotency key: one row per (workshop, attendee email) in the seed set. The real
    // app allows several rows per email (re-registering after a cancellation), so this
    // is a seed-only simplification, not a schema rule.
    const existing = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(
        and(
          eq(registrations.workshopId, workshopId),
          eq(registrations.attendeeEmail, attendeeEmail),
        ),
      )
      .limit(1);

    const values = {
      attendeeName: attendee.name,
      status: isCancelled ? ('CANCELLED' as const) : ('ACTIVE' as const),
      registeredBy: staffId,
      registeredAt,
      cancelledBy: isCancelled ? managerId : null,
      cancelledAt,
      cancelReason: attendee.cancelReason ?? null,
    };

    const found = existing[0];
    if (found) {
      await db.update(registrations).set(values).where(eq(registrations.id, found.id));
    } else {
      await db.insert(registrations).values({ workshopId, attendeeEmail, ...values });
    }
  }
}

/**
 * Sets `active_count` from the authoritative ACTIVE row count for every workshop, in a
 * single statement. This is the seed's guarantee that the counter and the rows agree —
 * the check the capacity tests depend on.
 */
async function reconcileActiveCounts(db: Database): Promise<void> {
  await db.execute(sql`
    update workshops w
       set active_count = (
             select count(*) from registrations r
              where r.workshop_id = w.id and r.status = 'ACTIVE'
           ),
           updated_at = now()
     where w.active_count <> (
             select count(*) from registrations r
              where r.workshop_id = w.id and r.status = 'ACTIVE'
           )
  `);
}

/** Fails loudly if the counter and the ACTIVE rows ever disagree. */
async function assertCountersMatch(db: Database): Promise<void> {
  const mismatches = await db.execute(sql`
    select w.code,
           w.capacity,
           w.active_count,
           (select count(*) from registrations r
             where r.workshop_id = w.id and r.status = 'ACTIVE') as actual_active
      from workshops w
     where w.active_count <> (select count(*) from registrations r
                               where r.workshop_id = w.id and r.status = 'ACTIVE')
  `);

  if (mismatches.length > 0) {
    console.error('active_count mismatch detected:', mismatches);
    throw new Error(
      'Seed produced an active_count that disagrees with the ACTIVE registration rows.',
    );
  }
}

async function main(): Promise<void> {
  const client = postgres(getDatabaseUrl(), { max: 1 });

  try {
    const db = drizzle(client);

    console.log('Seeding users ...');
    const userIds = await seedUsers(db);

    const managerId = userIds.get('manager@centre.dev');
    const staffId = userIds.get('staff@centre.dev');
    if (managerId === undefined || staffId === undefined) {
      throw new Error('Seed users were not created as expected.');
    }

    console.log('Seeding workshops and registrations ...');
    await seedWorkshops(db, managerId, staffId);

    console.log('Reconciling active_count from ACTIVE rows ...');
    await reconcileActiveCounts(db);
    await assertCountersMatch(db);

    const summary = await db.execute(sql`
      select w.code,
             w.status,
             w.capacity,
             w.active_count,
             (w.capacity - w.active_count) as seats_available
        from workshops w
       order by w.starts_at
    `);

    console.log('\nSeeded workshops:');
    console.table(summary);
    console.log(
      '\nLogins:\n' +
        '  admin@centre.dev   / Admin123!   (ADMIN)\n' +
        '  manager@centre.dev / Manager123! (MANAGER)\n' +
        '  staff@centre.dev   / Staff123!   (STAFF)',
    );
    console.log('\nSeed complete.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
