-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisation_id" UUID NOT NULL,
    "institution_student_ref" TEXT NOT NULL,
    "first_name" TEXT,
    "surname" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrolments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organisation_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "academic_year_start" INTEGER NOT NULL,
    "year_group" INTEGER NOT NULL,
    "class_group" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "students_organisation_id_surname_id_idx" ON "students"("organisation_id", "surname", "id");

-- CreateIndex
CREATE UNIQUE INDEX "students_organisation_id_institution_student_ref_key" ON "students"("organisation_id", "institution_student_ref");

-- CreateIndex
CREATE UNIQUE INDEX "students_organisation_id_id_key" ON "students"("organisation_id", "id");

-- CreateIndex
CREATE INDEX "student_enrolments_organisation_id_academic_year_start_year_idx" ON "student_enrolments"("organisation_id", "academic_year_start", "year_group");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrolments_organisation_id_student_id_academic_year_key" ON "student_enrolments"("organisation_id", "student_id", "academic_year_start");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "student_enrolments" ADD CONSTRAINT "student_enrolments_organisation_id_student_id_fkey" FOREIGN KEY ("organisation_id", "student_id") REFERENCES "students"("organisation_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE organisations
  ADD CONSTRAINT organisations_name_not_blank
  CHECK (length(btrim(name)) > 0);

ALTER TABLE students
  ADD CONSTRAINT students_reference_not_blank
  CHECK (length(btrim(institution_student_ref)) > 0),
  ADD CONSTRAINT students_surname_not_blank
  CHECK (length(btrim(surname)) > 0),
  ADD CONSTRAINT students_first_name_not_blank
  CHECK (first_name IS NULL OR length(btrim(first_name)) > 0);

ALTER TABLE student_enrolments
  ADD CONSTRAINT student_enrolments_academic_year_valid
  CHECK (academic_year_start BETWEEN 1 AND 9998),
  ADD CONSTRAINT student_enrolments_year_group_positive
  CHECK (year_group > 0);
