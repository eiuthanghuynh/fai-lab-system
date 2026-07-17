/*
  Warnings:

  - You are about to drop the column `file_name` on the `lab_work_order_images` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lab_work_order_images" DROP COLUMN "file_name",
ADD COLUMN     "image_category" VARCHAR(50);
