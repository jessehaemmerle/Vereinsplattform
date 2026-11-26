-- Calendar feed tokens were cuid() (time-based, partly predictable); replace them with random UUIDs.
UPDATE "Club" SET "calendarToken" = gen_random_uuid()::text;
