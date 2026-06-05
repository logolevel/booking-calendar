-- Guarantee at the database level that two events on the same court (resourceId)
-- can never overlap in time. This makes booking races impossible: even if two
-- concurrent transactions both pass the application-level overlap check, the
-- second INSERT is rejected by Postgres with an exclusion violation (SQLSTATE
-- 23P01), which the API maps to a 409 Conflict.

-- Required to combine an equality predicate on an integer column with a range
-- GiST index inside the same exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Half-open interval [startsAt, endsAt) so events that merely touch (one ends
-- exactly when the next starts) are NOT considered overlapping — this mirrors
-- the strict `<`/`>` comparison used by the application overlap check.
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  );
