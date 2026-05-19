-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "hasGst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;
