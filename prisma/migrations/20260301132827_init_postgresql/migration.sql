-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'NURSE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ShiftPref" AS ENUM ('MORNING', 'AFTERNOON', 'ANYTIME');

-- CreateEnum
CREATE TYPE "Employment" AS ENUM ('FULL_TIME', 'PART_TIME', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "GenderPref" AS ENUM ('FEMALE_ONLY', 'FEMALE_PREFERRED', 'ANY');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('PURE_PROGRAM', 'CLINIC_ADDON');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'GENERATED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'OFF_DAY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "role" "Role" NOT NULL DEFAULT 'NURSE',
    "pinHash" TEXT NOT NULL,
    "pinPrefix" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurseProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "contractHours" DOUBLE PRECISION NOT NULL,
    "shiftPreference" "ShiftPref" NOT NULL DEFAULT 'ANYTIME',
    "canWorkFriday" BOOLEAN NOT NULL DEFAULT false,
    "canWorkSaturday" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "employmentType" "Employment" NOT NULL DEFAULT 'FULL_TIME',
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "managementHours" DOUBLE PRECISION,
    "recurringOffDays" "DayOfWeek"[],

    CONSTRAINT "NurseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "genderPref" "GenderPref" NOT NULL DEFAULT 'ANY',
    "canBeSecondary" BOOLEAN NOT NULL DEFAULT false,
    "secondaryHours" DOUBLE PRECISION,
    "secondaryNursesNeeded" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicDefaultConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "nursesNeeded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClinicDefaultConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicWeeklyConfig" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "nursesNeeded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClinicWeeklyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurseBlockedClinic" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,

    CONSTRAINT "NurseBlockedClinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssignment" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',

    CONSTRAINT "FixedAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" "ProgramType" NOT NULL,
    "linkedClinicCode" TEXT,
    "defaultHours" DOUBLE PRECISION,

    CONSTRAINT "PatientProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "patientCount" INTEGER,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,

    CONSTRAINT "ProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySchedule" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "qualityScore" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "primaryClinicId" TEXT,
    "secondaryClinicId" TEXT,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patientCallProgram" TEXT,
    "patientCallCount" INTEGER,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "isManagerSelf" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "modifiedBy" TEXT,
    "modifiedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPreference" (
    "id" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "shiftPreference" "ShiftPref",
    "preferredDaysOff" "DayOfWeek"[],
    "preferredDaysOn" "DayOfWeek"[],
    "preferredClinics" TEXT[],
    "avoidClinics" TEXT[],
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "isForAll" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetNurseIds" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCorrection" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "originalNurseId" TEXT NOT NULL,
    "originalClinicId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "correctedNurseId" TEXT,
    "correctedClinicId" TEXT,
    "correctionType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NurseProfile_userId_key" ON "NurseProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_code_key" ON "Clinic"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicDefaultConfig_clinicId_day_key" ON "ClinicDefaultConfig"("clinicId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicWeeklyConfig_clinicId_weekStart_day_key" ON "ClinicWeeklyConfig"("clinicId", "weekStart", "day");

-- CreateIndex
CREATE UNIQUE INDEX "NurseBlockedClinic_nurseId_clinicId_key" ON "NurseBlockedClinic"("nurseId", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssignment_nurseId_clinicId_day_weekStart_key" ON "FixedAssignment"("nurseId", "clinicId", "day", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySchedule_weekStart_key" ON "WeeklySchedule"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAssignment_scheduleId_nurseId_day_key" ON "ScheduleAssignment"("scheduleId", "nurseId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPreference_nurseId_weekStart_key" ON "WeeklyPreference"("nurseId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "NurseProfile" ADD CONSTRAINT "NurseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicDefaultConfig" ADD CONSTRAINT "ClinicDefaultConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicWeeklyConfig" ADD CONSTRAINT "ClinicWeeklyConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseBlockedClinic" ADD CONSTRAINT "NurseBlockedClinic_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseBlockedClinic" ADD CONSTRAINT "NurseBlockedClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssignment" ADD CONSTRAINT "FixedAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssignment" ADD CONSTRAINT "FixedAssignment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PatientProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WeeklySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_primaryClinicId_fkey" FOREIGN KEY ("primaryClinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_secondaryClinicId_fkey" FOREIGN KEY ("secondaryClinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPreference" ADD CONSTRAINT "WeeklyPreference_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
