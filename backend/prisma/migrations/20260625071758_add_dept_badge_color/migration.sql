-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "badge_color" VARCHAR(20) NOT NULL DEFAULT '#63e079';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" VARCHAR(100);
