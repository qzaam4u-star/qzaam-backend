-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('vendor', 'admin');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'vendor';
COMMIT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activationTime" TIMESTAMP(3),
ADD COLUMN     "customerAction" TEXT,
ADD COLUMN     "customerDelayMinutes" INTEGER,
ADD COLUMN     "customerDelayUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deliveryTime" TEXT DEFAULT 'ASAP',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "finalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "handoverCompletedAt" TIMESTAMP(3),
ADD COLUMN     "handoverCompletedByVendor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isActivated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "pickupConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "pickupConfirmedByCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "reviewGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledDate" TEXT,
ADD COLUMN     "scheduledSlot" TEXT,
ADD COLUMN     "scheduledTime" TIMESTAMP(3),
ADD COLUMN     "slotDateTime" TIMESTAMP(3),
ADD COLUMN     "tokenIndex" INTEGER,
ADD COLUMN     "tokenNumber" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "closingTime" TEXT DEFAULT '21:00',
ADD COLUMN     "maxOrdersPerSlot" INTEGER DEFAULT 5,
ADD COLUMN     "openingTime" TEXT DEFAULT '09:00',
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "profileImage" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "slotDuration" INTEGER DEFAULT 30,
ADD COLUMN     "slotEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "storeDescription" TEXT,
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "vendorTokenIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorType" TEXT NOT NULL DEFAULT 'food',
ALTER COLUMN "role" SET DEFAULT 'vendor';

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "category" TEXT NOT NULL DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "services" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slotTime" TIMESTAMP(3) NOT NULL,
    "slotEndTime" TIMESTAMP(3),
    "totalDuration" INTEGER,
    "tokenNumber" TEXT,
    "tokenIndex" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'placed',
    "paymentMethod" TEXT NOT NULL DEFAULT 'razorpay',
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "customerAction" TEXT,
    "hasArrived" BOOLEAN NOT NULL DEFAULT false,
    "serviceStartTime" TIMESTAMP(3),
    "serviceEndTime" TIMESTAMP(3),
    "stylistId" TEXT,
    "stylistPreference" TEXT NOT NULL DEFAULT 'specific',
    "type" TEXT NOT NULL DEFAULT 'salon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewGiven" BOOLEAN NOT NULL DEFAULT false,
    "customerDelayMinutes" INTEGER,
    "customerDelayUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stylist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "Stylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referralCode" TEXT,
    "referredBy" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "userId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerCode" TEXT NOT NULL,
    "referredUser" TEXT NOT NULL,
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorReferral" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "referredByPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_customerId_key" ON "Wallet"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "Stylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stylist" ADD CONSTRAINT "Stylist_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
