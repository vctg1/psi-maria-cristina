-- AlterTable
ALTER TABLE "consulta" ADD COLUMN     "confirmacao_solicitada_em" TIMESTAMPTZ(3),
ADD COLUMN     "token_confirmacao_id" TEXT;

-- CreateTable
CREATE TABLE "perfil_psicologa" (
    "usuario_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "telefone" VARCHAR(20),
    "crp" VARCHAR(20),
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "perfil_psicologa_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "token_confirmacao" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_confirmacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limite_taxa" (
    "chave" TEXT NOT NULL,
    "janela_inicio" TIMESTAMPTZ(3) NOT NULL,
    "contagem" INTEGER NOT NULL,

    CONSTRAINT "limite_taxa_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_confirmacao_token_hash_key" ON "token_confirmacao"("token_hash");

-- CreateIndex
CREATE INDEX "consulta_token_confirmacao_id_idx" ON "consulta"("token_confirmacao_id");

-- AddForeignKey
ALTER TABLE "perfil_psicologa" ADD CONSTRAINT "perfil_psicologa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_token_confirmacao_id_fkey" FOREIGN KEY ("token_confirmacao_id") REFERENCES "token_confirmacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
