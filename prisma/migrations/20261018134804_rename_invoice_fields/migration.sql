/*
  Warnings:

  - You are about to drop the column `Status` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `cliendId` on the `Invoice` table. All the data in the column will be lost.
  - Added the required column `clientId` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_cliendId_fkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "Status",
DROP COLUMN "cliendId",
ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
