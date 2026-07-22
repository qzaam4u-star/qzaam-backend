-- CreateTable
CREATE TABLE "VendorImages" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorImages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VendorImages" ADD CONSTRAINT "VendorImages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
