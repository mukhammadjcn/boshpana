ALTER TABLE "User"
ALTER COLUMN "languageCode" SET DEFAULT 'uz';

UPDATE "User"
SET "languageCode" = 'uz'
WHERE "languageCode" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "languageCode" SET NOT NULL;

ALTER TABLE "User"
DROP COLUMN IF EXISTS "hasCustomLanguage";
