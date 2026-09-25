-- DropIndex
DROP INDEX "evento_pagamento_mp_notification_id_key";

-- DropIndex
DROP INDEX "evento_pagamento_mp_payment_id_idx";

-- DropIndex
DROP INDEX "pagamento_mp_payment_id_key";

-- DropIndex
DROP INDEX "pagamento_mp_preference_id_key";

-- AlterTable
ALTER TABLE "evento_pagamento" DROP COLUMN "mp_notification_id",
DROP COLUMN "mp_payment_id",
ADD COLUMN     "gateway" "gateway_pagamento",
ADD COLUMN     "notificacao_externa_id" TEXT,
ADD COLUMN     "pagamento_externo_id" TEXT;

-- AlterTable
ALTER TABLE "pagamento" DROP COLUMN "link_cobranca",
DROP COLUMN "mp_payment_id",
DROP COLUMN "mp_preference_id",
DROP COLUMN "mp_status",
DROP COLUMN "mp_status_detail",
ADD COLUMN     "gateway" "gateway_pagamento",
ADD COLUMN     "link_checkout" TEXT,
ADD COLUMN     "pagamento_externo_id" TEXT,
ADD COLUMN     "referencia_externa" TEXT,
ADD COLUMN     "status_externo" TEXT,
ADD COLUMN     "status_externo_detalhe" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "evento_pagamento_notificacao_externa_id_key" ON "evento_pagamento"("notificacao_externa_id");

-- CreateIndex
CREATE INDEX "evento_pagamento_pagamento_externo_id_idx" ON "evento_pagamento"("pagamento_externo_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_referencia_externa_key" ON "pagamento"("referencia_externa");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_pagamento_externo_id_key" ON "pagamento"("pagamento_externo_id");

-- CreateIndex
CREATE INDEX "pagamento_status_ultima_reconciliacao_em_idx" ON "pagamento"("status", "ultima_reconciliacao_em");
