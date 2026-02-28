-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "role" TEXT NOT NULL DEFAULT 'NURSE',
    "pinHash" TEXT NOT NULL,
    "pinPrefix" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NurseProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "contractHours" REAL NOT NULL,
    "shiftPreference" TEXT NOT NULL DEFAULT 'ANYTIME',
    "canWorkFriday" BOOLEAN NOT NULL DEFAULT false,
    "canWorkSaturday" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "managementHours" REAL,
    "recurringOffDays" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "NurseProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "genderPref" TEXT NOT NULL DEFAULT 'ANY',
    "canBeSecondary" BOOLEAN NOT NULL DEFAULT false,
    "secondaryHours" REAL,
    "secondaryNursesNeeded" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "ClinicDefaultConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "nursesNeeded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ClinicDefaultConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicWeeklyConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "day" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "nursesNeeded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ClinicWeeklyConfig_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NurseBlockedClinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    CONSTRAINT "NurseBlockedClinic_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NurseBlockedClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixedAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
    CONSTRAINT "FixedAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FixedAssignment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "type" TEXT NOT NULL,
    "linkedClinicCode" TEXT,
    "defaultHours" REAL
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "day" TEXT NOT NULL,
    "patientCount" INTEGER,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    CONSTRAINT "ProgramAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PatientProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "qualityScore" REAL,
    "publishedAt" DATETIME,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "primaryClinicId" TEXT,
    "secondaryClinicId" TEXT,
    "shiftStart" TEXT,
    "shiftEnd" TEXT,
    "hours" REAL NOT NULL DEFAULT 0,
    "patientCallProgram" TEXT,
    "patientCallCount" INTEGER,
    "isOff" BOOLEAN NOT NULL DEFAULT false,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "isManagerSelf" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "modifiedBy" TEXT,
    "modifiedAt" DATETIME,
    CONSTRAINT "ScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WeeklySchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "NurseProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_primaryClinicId_fkey" FOREIGN KEY ("primaryClinicId") REFERENCES "Clinic" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleAssignment_secondaryClinicId_fkey" FOREIGN KEY ("secondaryClinicId") REFERENCES "Clinic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "TimeOffRequest_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nurseId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "shiftPreference" TEXT,
    "preferredDaysOff" TEXT NOT NULL DEFAULT '[]',
    "preferredDaysOn" TEXT NOT NULL DEFAULT '[]',
    "preferredClinics" TEXT NOT NULL DEFAULT '[]',
    "avoidClinics" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyPreference_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isForAll" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetNurseIds" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "originalNurseId" TEXT NOT NULL,
    "originalClinicId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "correctedNurseId" TEXT,
    "correctedClinicId" TEXT,
    "correctionType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
