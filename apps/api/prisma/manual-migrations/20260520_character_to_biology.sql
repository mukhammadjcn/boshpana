-- Variant 3 migration: CHARACTER decki olib tashlanadi, BIOLOGY decki qo'shiladi.
--   * 12 ta yosh kartani HEALTH dan BIOLOGY ga ko'chirish (id 'h_age_%')
--   * Barcha mavjud CHARACTER kartalar FACT ga qo'shiladi
--   * BunkerPlayerAttribute.character ustuni biology ga rename qilinadi
--   * BunkerCardType enum-dan CHARACTER value-si olib tashlanadi
--
-- IDempotent: bir necha marta ishlatsa ham xavfsiz.

BEGIN;

-- 1) Enum-ga BIOLOGY value-sini qo'shish (agar yo'q bo'lsa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BIOLOGY'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BunkerCardType')
  ) THEN
    ALTER TYPE "BunkerCardType" ADD VALUE 'BIOLOGY';
  END IF;
END $$;

COMMIT;

-- Enum yangilanishi alohida transaction'da bo'lishi shart, shundan keyin foydalanish mumkin.

BEGIN;

-- 2) Mening kiritgan 12 ta yosh kartani HEALTH dan BIOLOGY ga ko'chirish
UPDATE "BunkerCard"
SET type = 'BIOLOGY'
WHERE type = 'HEALTH'
  AND id IN (
    'h_age_06boy','h_age_09orph','h_age_12pre','h_age_15girl','h_age_17boy',
    'h_age_twins7','h_age_preg8','h_age_65ret','h_age_75gpa','h_age_85old',
    'h_age_90gma','h_age_100eld'
  );

-- 3) Barcha CHARACTER kartani FACT ga ko'chirish
--    Unique constraint (type, text) bo'lgani uchun, FACT'da bir xil matn bo'lsa skip qilamiz.
UPDATE "BunkerCard" c
SET type = 'FACT'
WHERE c.type = 'CHARACTER'
  AND NOT EXISTS (
    SELECT 1 FROM "BunkerCard" c2
    WHERE c2.type = 'FACT' AND c2.text = c.text
  );

-- Konfliktda qolgan (FACT'da allaqachon mavjud) CHARACTER kartalarini o'chirish
DELETE FROM "BunkerCard" WHERE type = 'CHARACTER';

-- 4) BunkerPlayerAttribute.character ustuni nomini biology ga o'zgartirish
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BunkerPlayerAttribute' AND column_name = 'character'
  ) THEN
    ALTER TABLE "BunkerPlayerAttribute" RENAME COLUMN "character" TO "biology";
  END IF;
END $$;

-- 5) revealed[] arrayidagi 'CHARACTER' ni 'BIOLOGY' ga o'zgartirish (aktiv o'yinlar uchun)
UPDATE "BunkerPlayerAttribute"
SET revealed = array_replace(revealed, 'CHARACTER'::"BunkerCardType", 'BIOLOGY'::"BunkerCardType")
WHERE 'CHARACTER' = ANY(revealed::text[]);

-- BunkerGame.revealed va Room.lastRevealedCardType ham xuddi shunday
UPDATE "BunkerGame"
SET "lastRevealedCardType" = 'BIOLOGY'
WHERE "lastRevealedCardType" = 'CHARACTER';

COMMIT;

-- 6) Enum-dan CHARACTER value-sini olib tashlash.
--    Postgres enum value-ni to'g'ridan-to'g'ri o'chirish imkonini bermaydi —
--    yangi enum yaratib, ustunlarni unga ko'chirish kerak.
BEGIN;

CREATE TYPE "BunkerCardType_new" AS ENUM ('PROFESSION', 'HEALTH', 'BIOLOGY', 'SKILL', 'BAGGAGE', 'FACT');

ALTER TABLE "BunkerCard"
  ALTER COLUMN type TYPE "BunkerCardType_new" USING type::text::"BunkerCardType_new";

ALTER TABLE "BunkerGame"
  ALTER COLUMN "lastRevealedCardType" TYPE "BunkerCardType_new"
  USING "lastRevealedCardType"::text::"BunkerCardType_new";

-- revealed ustunining default qiymati eski enumga bog'langan, oldin uni olib tashlash kerak
ALTER TABLE "BunkerPlayerAttribute" ALTER COLUMN revealed DROP DEFAULT;

ALTER TABLE "BunkerPlayerAttribute"
  ALTER COLUMN revealed TYPE "BunkerCardType_new"[]
  USING revealed::text[]::"BunkerCardType_new"[];

DROP TYPE "BunkerCardType";
ALTER TYPE "BunkerCardType_new" RENAME TO "BunkerCardType";

-- Defaultni qayta o'rnatish
ALTER TABLE "BunkerPlayerAttribute"
  ALTER COLUMN revealed SET DEFAULT ARRAY[]::"BunkerCardType"[];

COMMIT;

-- Tasdiq
SELECT type, COUNT(*) FROM "BunkerCard" GROUP BY type ORDER BY type;
