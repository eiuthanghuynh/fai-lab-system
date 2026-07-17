/*
  Warnings:

  - You are about to drop the column `lab_work_order_id` on the `lab_work_order_images` table. All the data in the column will be lost.
  - You are about to drop the column `request_id` on the `report_attachments` table. All the data in the column will be lost.
  - You are about to drop the column `request_id` on the `request_attachments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "lab_work_order_images" DROP CONSTRAINT "lab_work_order_images_lab_work_order_id_fkey";

-- AlterTable
ALTER TABLE "lab_work_order_images" DROP COLUMN "lab_work_order_id",
ADD COLUMN     "bucket_name" VARCHAR(50) NOT NULL DEFAULT 'requests',
ADD COLUMN     "parent_id" INTEGER;

-- AlterTable
ALTER TABLE "report_attachments" DROP COLUMN "request_id",
ADD COLUMN     "bucket_name" VARCHAR(50) NOT NULL DEFAULT 'requests',
ADD COLUMN     "parent_id" INTEGER;

-- AlterTable
ALTER TABLE "request_attachments" DROP COLUMN "request_id",
ADD COLUMN     "bucket_name" VARCHAR(50) NOT NULL DEFAULT 'requests',
ADD COLUMN     "parent_id" INTEGER;

-- AddForeignKey
ALTER TABLE "lab_work_order_images" ADD CONSTRAINT "lab_work_order_images_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "lab_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
