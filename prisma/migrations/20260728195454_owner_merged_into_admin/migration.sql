-- El club pasa de 4 roles a 3: OWNER y ADMIN se fusionan en ADMIN, que ahora
-- concentra TODOS los permisos del club. El caso que motivó el cambio es el
-- club de una persona, donde separar "dueño" de "administración" solo agregaba
-- vocabulario sin agregar capacidades (ver docs/PRODUCT_SPEC.md).
--
-- El backfill va ANTES del cambio de tipo y en la misma transacción: el
-- USING ("role"::text::"MembershipRole_new") de abajo falla si queda alguna
-- fila en OWNER, porque ese valor ya no existe en el tipo nuevo.
BEGIN;

UPDATE "TeamMembership" SET "role" = 'ADMIN' WHERE "role" = 'OWNER';

CREATE TYPE "MembershipRole_new" AS ENUM ('ADMIN', 'COACH', 'ATHLETE');
ALTER TABLE "TeamMembership" ALTER COLUMN "role" TYPE "MembershipRole_new" USING ("role"::text::"MembershipRole_new");
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
ALTER TYPE "MembershipRole_new" RENAME TO "MembershipRole";
DROP TYPE "public"."MembershipRole_old";

COMMIT;
