/**
 * Seed idempotente (pode rodar N vezes sem duplicar).
 *
 * a) Migra src/data/horarios-disponiveis.json (registros tipo:"recorrente")
 *    para HorarioAtendimento, via upsert por @@unique([diaSemana, hora]).
 * b) Cria/atualiza a psicóloga a partir de PSICOLOGA_EMAIL / PSICOLOGA_SENHA_HASH
 *    (env). Se qualquer uma faltar, pula com aviso — nunca gera hash padrão.
 * c) Garante a linha única de Configuracao (id = 1) com os defaults da proposta.
 *
 * NÃO migra pacientes.json nem consultas.json (dados fictícios/legado — fora de escopo).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, DiaSemana, Papel } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface HorarioLegado {
  id: string;
  hora: string;
  tipo: string;
  diaSemana: number;
  ativo: boolean;
  criadoEm: string;
}

const DIA_SEMANA_POR_NUMERO: Record<number, DiaSemana> = {
  1: DiaSemana.segunda,
  2: DiaSemana.terca,
  3: DiaSemana.quarta,
  4: DiaSemana.quinta,
  5: DiaSemana.sexta,
  6: DiaSemana.sabado,
  7: DiaSemana.domingo,
};

function mapDiaSemana(numero: number): DiaSemana {
  const dia = DIA_SEMANA_POR_NUMERO[numero];
  if (!dia) {
    throw new Error(`diaSemana inválido em horarios-disponiveis.json: ${numero}`);
  }
  return dia;
}

async function seedHorarios() {
  const caminho = join(process.cwd(), "src/data/horarios-disponiveis.json");
  const registros: HorarioLegado[] = JSON.parse(readFileSync(caminho, "utf-8"));

  let inseridosOuAtualizados = 0;
  let ignorados = 0;

  for (const registro of registros) {
    if (registro.tipo !== "recorrente") {
      ignorados += 1;
      continue;
    }

    const diaSemana = mapDiaSemana(registro.diaSemana);

    await prisma.horarioAtendimento.upsert({
      where: { diaSemana_hora: { diaSemana, hora: registro.hora } },
      create: { diaSemana, hora: registro.hora, ativo: registro.ativo },
      update: { ativo: registro.ativo },
    });

    inseridosOuAtualizados += 1;
  }

  console.log(
    `HorarioAtendimento: ${inseridosOuAtualizados} inserido(s)/atualizado(s), ${ignorados} ignorado(s) (tipo != recorrente).`
  );
}

async function seedPsicologa() {
  const email = process.env.PSICOLOGA_EMAIL;
  const senhaHash = process.env.PSICOLOGA_SENHA_HASH;

  if (!email || !senhaHash) {
    console.warn(
      "Psicóloga: PSICOLOGA_EMAIL e/ou PSICOLOGA_SENHA_HASH ausentes no ambiente — pulando criação/atualização."
    );
    return;
  }

  const emailNormalizado = email.trim().toLowerCase();

  const existia = await prisma.usuario.findUnique({ where: { email: emailNormalizado } });

  await prisma.usuario.upsert({
    where: { email: emailNormalizado },
    create: { email: emailNormalizado, senhaHash, papel: Papel.psicologa },
    update: { senhaHash, papel: Papel.psicologa },
  });

  console.log(`Psicóloga: usuário ${existia ? "atualizado" : "criado"}.`);
}

async function seedConfiguracao() {
  await prisma.configuracao.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      valorPadraoSessao: 200,
      duracaoSessaoMin: 50,
      antecedenciaCancelamentoHoras: 24,
    },
    update: {},
  });

  console.log("Configuracao: linha id=1 ok (defaults aplicados apenas na criação).");
}

async function main() {
  await seedHorarios();
  await seedPsicologa();
  await seedConfiguracao();
}

main()
  .catch((erro) => {
    const mensagem = erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido";
    console.error("Falha no seed:", mensagem);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
