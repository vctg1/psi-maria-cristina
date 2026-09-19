// Tipos de contrato compartilhados entre cliente e servidor para /api/alertas.
// Sem imports de servidor (fs, prisma, bcrypt, server-only) — pode ser importado
// por Client Components.

export type AlertaCancelamento = {
  tipo: 'cancelamento';
  id: string; // notificacao.id
  titulo: string;
  mensagem: string;
  criadaEm: string;
  consulta: { id: string; inicio: string; pacienteNome: string; pacienteTelefone: string } | null;
};

export type AlertaLembrete = {
  tipo: 'lembrete';
  id: string; // consulta.id
  consulta: {
    id: string;
    inicio: string;
    modalidade: 'presencial' | 'online' | null;
    pacienteNome: string;
    pacienteTelefone: string;
    temLogin: boolean;
  };
};

export type Alerta = AlertaCancelamento | AlertaLembrete;

export type AlertasResposta = { alertas: Alerta[]; totais: { cancelamentos: number; lembretes: number } };
