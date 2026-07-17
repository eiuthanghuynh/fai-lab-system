-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('Normal', 'Urgent');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('Draft', 'Backlog', 'Assigned', 'Ongoing', 'Closed');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "employee_id" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100),
    "email" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_logout_at" TIMESTAMP(3),
    "remember_token" VARCHAR(255),
    "reset_password_token" VARCHAR(255),
    "reset_password_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "badge_color" VARCHAR(20) NOT NULL DEFAULT '#63e079',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

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
CREATE TABLE "fai_requests" (
    "id" SERIAL NOT NULL,
    "test_no" VARCHAR(50),
    "requestor_id" INTEGER NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "part_no" VARCHAR(100) NOT NULL,
    "revision" VARCHAR(50),
    "part_name" VARCHAR(255),
    "tracking_no" VARCHAR(100),
    "commodity_part" INTEGER,
    "supplier_id" INTEGER,
    "part_type" VARCHAR(100),
    "reason_for_submission" VARCHAR(255),
    "receive_date" TIMESTAMP(3),
    "sample_qty" INTEGER NOT NULL DEFAULT 1,
    "submission_time" INTEGER NOT NULL DEFAULT 1,
    "priority" "PriorityLevel",
    "priority_reason" TEXT,
    "week_no" INTEGER,
    "complete_date" TIMESTAMP(3),
    "failure_details" TEXT,
    "improvement_plan" TEXT,
    "inspector_id" INTEGER,
    "fai_failure_mode" INTEGER,
    "remark" TEXT,
    "estimated_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'Draft',
    "result" VARCHAR(50),
    "person_in_charge" VARCHAR(255),
    "address" VARCHAR(255),
    "idempotency_key" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "submission_contents" JSONB,
    "form_data" JSONB NOT NULL,

    CONSTRAINT "fai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(255),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_tests" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_requests" (
    "id" SERIAL NOT NULL,
    "test_no" VARCHAR(50),
    "model_no" VARCHAR(100) NOT NULL,
    "model_description" VARCHAR(255),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "product_sn" VARCHAR(255),
    "project_name" VARCHAR(255),
    "revision" VARCHAR(50),
    "stage" VARCHAR(100),
    "priority" "PriorityLevel",
    "priority_reason" TEXT,
    "week_no" INTEGER,
    "request_date" TIMESTAMP(3) NOT NULL,
    "estimated_date" TIMESTAMP(3),
    "complete_date" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'Draft',
    "requestor_id" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "sample_received_date" TIMESTAMP(3),
    "sample_return_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "idempotency_key" VARCHAR(255),
    "inspector_id" INTEGER,

    CONSTRAINT "lab_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_work_orders" (
    "id" SERIAL NOT NULL,
    "work_order_no" VARCHAR(50) NOT NULL,
    "lab_request_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "product_sn" VARCHAR(255),
    "item_test_id" INTEGER NOT NULL,
    "procedure_condition" TEXT,
    "test_specification" TEXT,
    "remark" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Backlog',
    "test_result" VARCHAR(50),
    "failure_details" TEXT,
    "improvement_plan" TEXT,
    "technician_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lab_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_work_order_images" (
    "id" SERIAL NOT NULL,
    "lab_work_order_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_work_order_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fai_lab_reports" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "report_data" JSONB NOT NULL,
    "pdf_url" TEXT,
    "created_by" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fai_lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_logs" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "approver_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "comment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fai_requests_test_no_key" ON "fai_requests"("test_no");

-- CreateIndex
CREATE UNIQUE INDEX "fai_requests_idempotency_key_key" ON "fai_requests"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "item_tests_name_key" ON "item_tests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lab_requests_test_no_key" ON "lab_requests"("test_no");

-- CreateIndex
CREATE UNIQUE INDEX "lab_requests_idempotency_key_key" ON "lab_requests"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "lab_work_orders_work_order_no_key" ON "lab_work_orders"("work_order_no");

-- CreateIndex
CREATE UNIQUE INDEX "fai_failure_modes_issue_key" ON "fai_failure_modes"("issue");

-- CreateIndex
CREATE UNIQUE INDEX "commodity_parts_name_key" ON "commodity_parts"("name");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_requestor_id_fkey" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_fai_failure_mode_fkey" FOREIGN KEY ("fai_failure_mode") REFERENCES "fai_failure_modes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_commodity_part_fkey" FOREIGN KEY ("commodity_part") REFERENCES "commodity_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_requests" ADD CONSTRAINT "fai_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_requestor_id_fkey" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_work_orders" ADD CONSTRAINT "lab_work_orders_lab_request_id_fkey" FOREIGN KEY ("lab_request_id") REFERENCES "lab_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_work_orders" ADD CONSTRAINT "lab_work_orders_item_test_id_fkey" FOREIGN KEY ("item_test_id") REFERENCES "item_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_work_orders" ADD CONSTRAINT "lab_work_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_work_order_images" ADD CONSTRAINT "lab_work_order_images_lab_work_order_id_fkey" FOREIGN KEY ("lab_work_order_id") REFERENCES "lab_work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fai_lab_reports" ADD CONSTRAINT "fai_lab_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
