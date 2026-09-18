-- CreateEnum
CREATE TYPE "papel" AS ENUM ('psicologa', 'paciente');

-- CreateEnum
CREATE TYPE "finalidade_token" AS ENUM ('primeiro_acesso', 'redefinicao_senha');

-- CreateEnum
CREATE TYPE "origem_cadastro" AS ENUM ('psicologa', 'autocadastro');

-- CreateEnum
CREATE TYPE "dia_semana" AS ENUM ('segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo');

-- CreateEnum
CREATE TYPE "consulta_status" AS ENUM ('agendada', 'confirmada', 'realizada', 'cancelada', 'nao_compareceu');

-- CreateEnum
CREATE TYPE "ator_consulta" AS ENUM ('paciente', 'psicologa');

-- CreateEnum
CREATE TYPE "modalidade" AS ENUM ('presencial', 'online');

-- CreateEnum
CREATE TYPE "pagamento_status" AS ENUM ('pendente', 'pago', 'falhou', 'expirado');

-- CreateEnum
CREATE TYPE "metodo_pagamento" AS ENUM ('pix', 'boleto', 'cartao', 'outro');

-- CreateEnum
CREATE TYPE "origem_evento" AS ENUM ('webhook', 'reconciliacao', 'manual');

-- CreateEnum
CREATE TYPE "tipo_notificacao" AS ENUM ('novo_agendamento', 'cancelamento', 'pagamento_recebido');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT,
    "papel" "papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_acesso" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "finalidade" "finalidade_token" NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "cpf" TEXT,
    "responsavel" TEXT,
    "telefone_responsavel" TEXT,
    "origem_cadastro" "origem_cadastro" NOT NULL,
    "observacoes_cadastro" TEXT,
    "avatar_url" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_atendimento" (
    "id" TEXT NOT NULL,
    "dia_semana" "dia_semana" NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "horario_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excecao_disponibilidade" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "hora" VARCHAR(5),
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excecao_disponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consulta" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "status" "consulta_status" NOT NULL DEFAULT 'agendada',
    "modalidade" "modalidade",
    "motivo" TEXT,
    "observacoes" TEXT,
    "relatorio" TEXT,
    "criada_por" "ator_consulta" NOT NULL,
    "confirmada_em" TIMESTAMPTZ(3),
    "encerrada_em" TIMESTAMPTZ(3),
    "cancelada_em" TIMESTAMPTZ(3),
    "cancelada_por" "ator_consulta",
    "motivo_cancelamento" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento" (
    "id" TEXT NOT NULL,
    "consulta_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "pagamento_status" NOT NULL DEFAULT 'pendente',
    "metodo" "metodo_pagamento",
    "mp_preference_id" TEXT,
    "link_cobranca" TEXT,
    "mp_payment_id" TEXT,
    "mp_status" TEXT,
    "mp_status_detail" TEXT,
    "expira_em" TIMESTAMPTZ(3),
    "pago_em" TIMESTAMPTZ(3),
    "ultima_reconciliacao_em" TIMESTAMPTZ(3),
    "gerado_por_id" TEXT,
    "observacao" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_pagamento" (
    "id" TEXT NOT NULL,
    "pagamento_id" TEXT,
    "origem" "origem_evento" NOT NULL,
    "mp_notification_id" TEXT,
    "mp_payment_id" TEXT,
    "status_anterior" "pagamento_status",
    "status_novo" "pagamento_status",
    "payload" JSONB,
    "recebido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "valor_padrao_sessao" DECIMAL(10,2) NOT NULL DEFAULT 200,
    "duracao_sessao_min" INTEGER NOT NULL DEFAULT 50,
    "antecedencia_cancelamento_horas" INTEGER NOT NULL DEFAULT 24,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao" (
    "id" TEXT NOT NULL,
    "tipo" "tipo_notificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "consulta_id" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "token_acesso_token_hash_key" ON "token_acesso"("token_hash");

-- CreateIndex
CREATE INDEX "token_acesso_usuario_id_finalidade_idx" ON "token_acesso"("usuario_id", "finalidade");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_usuario_id_key" ON "paciente"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cpf_key" ON "paciente"("cpf");

-- CreateIndex
CREATE INDEX "horario_atendimento_dia_semana_ativo_idx" ON "horario_atendimento"("dia_semana", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "horario_atendimento_dia_semana_hora_key" ON "horario_atendimento"("dia_semana", "hora");

-- CreateIndex
CREATE INDEX "excecao_disponibilidade_data_idx" ON "excecao_disponibilidade"("data");

-- CreateIndex
CREATE UNIQUE INDEX "excecao_disponibilidade_data_hora_key" ON "excecao_disponibilidade"("data", "hora");

-- CreateIndex
CREATE INDEX "consulta_paciente_id_inicio_idx" ON "consulta"("paciente_id", "inicio");

-- CreateIndex
CREATE INDEX "consulta_inicio_status_idx" ON "consulta"("inicio", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_consulta_id_key" ON "pagamento"("consulta_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_mp_preference_id_key" ON "pagamento"("mp_preference_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_mp_payment_id_key" ON "pagamento"("mp_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "evento_pagamento_mp_notification_id_key" ON "evento_pagamento"("mp_notification_id");

-- CreateIndex
CREATE INDEX "evento_pagamento_mp_payment_id_idx" ON "evento_pagamento"("mp_payment_id");

-- CreateIndex
CREATE INDEX "notificacao_lida_criada_em_idx" ON "notificacao"("lida", "criada_em");

-- AddForeignKey
ALTER TABLE "token_acesso" ADD CONSTRAINT "token_acesso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consulta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_gerado_por_id_fkey" FOREIGN KEY ("gerado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_pagamento" ADD CONSTRAINT "evento_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consulta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
