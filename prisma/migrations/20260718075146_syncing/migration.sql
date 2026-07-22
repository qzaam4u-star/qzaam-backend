-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "appliedReferralCode" TEXT;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "adminResponse" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "appliedReferralCode" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "CustomerReferral" (
    "id" TEXT NOT NULL,
    "referrerCode" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "rewardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerReferral_referrerCode_idx" ON "CustomerReferral"("referrerCode");

-- CreateIndex
CREATE INDEX "CustomerReferral_referredId_idx" ON "CustomerReferral"("referredId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_customerId_vendorId_key" ON "Wishlist"("customerId", "vendorId");

-- CreateIndex
CREATE INDEX "Booking_appliedReferralCode_idx" ON "Booking"("appliedReferralCode");

-- CreateIndex
CREATE INDEX "Order_appliedReferralCode_idx" ON "Order"("appliedReferralCode");

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
