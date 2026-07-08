-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";

-- AlterTable
ALTER TABLE "fai_requests" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "commodity_part" INTEGER,
ADD COLUMN     "idempotency_key" VARCHAR(255),
ADD COLUMN     "part_type" VARCHAR(100),
ADD COLUMN     "reason_for_submission" VARCHAR(255),
ADD COLUMN     "submission_contents" JSONB,
ADD COLUMN     "supplier_name" VARCHAR(255),
DROP COLUMN "fai_failure_mode",
ADD COLUMN     "fai_failure_mode" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role_id",
ADD COLUMN     "employee_id" VARCHAR(100) NOT NULL,
ADD COLUMN     "last_logout_at" TIMESTAMP(3),
ADD COLUMN     "remember_token" VARCHAR(255),
ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" VARCHAR(255);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "fai_failure_modes" (
    "id" SERIAL NOT NULL,
    "issue" TEXT NOT NULL,

    CONSTRAINT "fai_failure_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodity_parts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "commodity_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fai_failure_modes_issue_key" ON "fai_failure_modes"("issue");

-- CreateIndex
CREATE UNIQUE INDEX "commodity_parts_name_key" ON "commodity_parts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fai_requests_idempotency_key_key" ON "fai_requests"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_fai_failure_mode_fkey" FOREIGN KEY ("fai_failure_mode") REFERENCES "fai_failure_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_commodity_part_fkey" FOREIGN KEY ("commodity_part") REFERENCES "commodity_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

