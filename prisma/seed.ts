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

  // O e-mail de login da psicóloga pode ser trocado pela tela de Perfil (PATCH /api/perfil), sem
  // passar pelo seed. Por isso o seed NUNCA usa esse e-mail para decidir "criar vs. atualizar":
  // ele só atualiza o hash de uma psicóloga que já tenha exatamente esse e-mail hoje, e só cria
  // uma psicóloga do zero quando não existe NENHUMA ainda.
  const usuarioComEsseEmail = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
    select: { id: true, papel: true },
  });

  if (usuarioComEsseEmail) {
    if (usuarioComEsseEmail.papel !== Papel.psicologa) {
      // PSICOLOGA_EMAIL aponta para uma conta de paciente — nunca converte o papel de alguém.
      console.warn(
        "Psicóloga: PSICOLOGA_EMAIL pertence a um usuário que não é psicóloga — nada foi alterado."
      );
      return;
    }

    await prisma.usuario.update({
      where: { id: usuarioComEsseEmail.id },
      data: { senhaHash },
    });
    console.log("Psicóloga: usuário atualizado.");
    return;
  }

  const existeAlgumaPsicologa = await prisma.usuario.findFirst({
    where: { papel: Papel.psicologa },
    select: { id: true },
  });

  if (existeAlgumaPsicologa) {
    // Já existe psicóloga, mas com outro e-mail — provavelmente ela trocou o login pelo Perfil.
    // O seed não cria uma segunda conta nem mexe na existente.
    console.warn(
      "Psicóloga: já existe psicóloga cadastrada; o e-mail de login é alterado pelo Perfil — nada foi criado."
    );
    return;
  }

  await prisma.usuario.create({
    data: { email: emailNormalizado, senhaHash, papel: Papel.psicologa },
  });
  console.log("Psicóloga: usuário criado.");
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
