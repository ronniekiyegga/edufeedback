-- Bounds surnames so every stored student produces a pagination cursor
-- within the API's accepted length. See MAX_SURNAME_LENGTH.
ALTER TABLE "students" ALTER COLUMN "surname" SET DATA TYPE VARCHAR(100);
