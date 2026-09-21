/*
  Warnings:

  - You are about to drop the column `consulta_id` on the `pagamento` table. All the data in the column will be lost.
  - Added the required column `origem` to the `pagamento` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "origem_pagamento" AS ENUM ('manual', 'online');

-- CreateEnum
CREATE TYPE "gateway_pagamento" AS ENUM ('mercadopago', 'asaas');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "metodo_pagamento" ADD VALUE 'dinheiro';
ALTER TYPE "metodo_pagamento" ADD VALUE 'maquininha';

-- AlterEnum
ALTER TYPE "pagamento_status" ADD VALUE 'estornado';

-- DropForeignKey
ALTER TABLE "pagamento" DROP CONSTRAINT "pagamento_consulta_id_fkey";

-- DropIndex
DROP INDEX "pagamento_consulta_id_key";

-- AlterTable
ALTER TABLE "configuracao" ADD COLUMN     "gateway_padrao" "gateway_pagamento" NOT NULL DEFAULT 'mercadopago';

-- AlterTable
ALTER TABLE "consulta" ADD COLUMN     "pagamento_id" TEXT,
ADD COLUMN     "valor" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "pagamento" DROP COLUMN "consulta_id",
ADD COLUMN     "estornado_em" TIMESTAMPTZ(3),
ADD COLUMN     "origem" "origem_pagamento" NOT NULL,
ADD COLUMN     "recebido_em" DATE;

-- CreateIndex
CREATE INDEX "consulta_pagamento_id_idx" ON "consulta"("pagamento_id");

-- CreateIndex
CREATE INDEX "pagamento_status_criado_em_idx" ON "pagamento"("status", "criado_em");

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
