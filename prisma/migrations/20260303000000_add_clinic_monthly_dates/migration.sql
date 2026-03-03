-- CreateTable
CREATE TABLE "ClinicMonthlyDate" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "nursesNeeded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClinicMonthlyDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMonthlyDate_clinicId_date_key" ON "ClinicMonthlyDate"("clinicId", "date");

-- AddForeignKey
ALTER TABLE "ClinicMonthlyDate" ADD CONSTRAINT "ClinicMonthlyDate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
