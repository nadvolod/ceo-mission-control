/**
 * Synthetic UUID used by unit tests that don't touch the real DB.
 * Kept in its own module so importing this constant doesn't pull in
 * the @/lib/users and @/lib/db modules (which open Neon connections).
 */
export const UNIT_TEST_OWNER_ID = '00000000-0000-0000-0000-000000000001';
