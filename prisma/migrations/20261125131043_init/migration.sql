-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FIELD_USER', 'FIELD_MANAGER', 'TEAM_MANAGER', 'HQ_USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'en');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('IN_CREATION', 'IN_VALIDATION', 'VALIDATED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlanAction" AS ENUM ('CREATED', 'SUBMITTED', 'VALIDATED', 'RETURNED', 'UPDATED_BY_MANAGER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('HCP', 'PHARMACY');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EVT_ATT', 'AEMAIL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "crmId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "team" TEXT,
    "primaryRegion" TEXT,
    "primaryTerritory" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginSuccess" BOOLEAN,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "crmId" TEXT,
    "name" TEXT NOT NULL,
    "territory" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'IN_CREATION',
    "ownerId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "PlanAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "goalCall" INTEGER NOT NULL DEFAULT 0,
    "goalEvtAtt" INTEGER NOT NULL DEFAULT 0,
    "goalAemail" INTEGER NOT NULL DEFAULT 0,
    "calculatedGoalCall" INTEGER,
    "calculatedGoalEvtAtt" INTEGER,
    "calculatedGoalAemail" INTEGER,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "crmId" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProduct" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "goalCall" INTEGER NOT NULL DEFAULT 0,
    "goalAemail" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TargetProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "crmId" TEXT,
    "type" "AccountType" NOT NULL,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "workplace" TEXT,
    "brickCode" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "postalCode" TEXT,
    "city" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountQualif" (
    "id" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "AccountQualif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brick" (
    "code" TEXT NOT NULL,
    "territory" TEXT NOT NULL,

    CONSTRAINT "Brick_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "KpiDefinition" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,

    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BrickKpi" (
    "brickCode" TEXT NOT NULL,
    "kpiKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BrickKpi_pkey" PRIMARY KEY ("brickCode","kpiKey")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "crmId" TEXT,
    "type" "ActivityType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_crmId_key" ON "User"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cycle_code_key" ON "Cycle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_crmId_key" ON "Plan"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_ownerId_cycleId_key" ON "Plan"("ownerId", "cycleId");

-- CreateIndex
CREATE INDEX "PlanEvent_planId_idx" ON "PlanEvent"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Target_planId_accountId_key" ON "Target"("planId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_crmId_key" ON "Product"("crmId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TargetProduct_targetId_productId_key" ON "TargetProduct"("targetId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_crmId_key" ON "Account"("crmId");

-- CreateIndex
CREATE INDEX "Account_brickCode_idx" ON "Account"("brickCode");

-- CreateIndex
CREATE UNIQUE INDEX "AccountQualif_team_accountId_label_key" ON "AccountQualif"("team", "accountId", "label");

-- CreateIndex
CREATE INDEX "Brick_territory_idx" ON "Brick"("territory");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_crmId_key" ON "Activity"("crmId");

-- CreateIndex
CREATE INDEX "Activity_accountId_date_idx" ON "Activity"("accountId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduct" ADD CONSTRAINT "TargetProduct_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduct" ADD CONSTRAINT "TargetProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_brickCode_fkey" FOREIGN KEY ("brickCode") REFERENCES "Brick"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountQualif" ADD CONSTRAINT "AccountQualif_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrickKpi" ADD CONSTRAINT "BrickKpi_brickCode_fkey" FOREIGN KEY ("brickCode") REFERENCES "Brick"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrickKpi" ADD CONSTRAINT "BrickKpi_kpiKey_fkey" FOREIGN KEY ("kpiKey") REFERENCES "KpiDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
