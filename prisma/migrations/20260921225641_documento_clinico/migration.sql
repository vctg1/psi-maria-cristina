-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "nome_arquivo" VARCHAR(64) NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "visivel_para_paciente" BOOLEAN NOT NULL DEFAULT false,
    "enviado_por_id" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_nome_arquivo_key" ON "documento"("nome_arquivo");

-- CreateIndex
CREATE INDEX "documento_paciente_id_criado_em_idx" ON "documento"("paciente_id", "criado_em");

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
