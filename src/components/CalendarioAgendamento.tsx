'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import type { LivresDia, LivresMes } from '@/types/agenda';

interface CalendarioAgendamentoProps {
  onDateSelect: (date: string) => void;
  selectedDate: string;
  onTimeSelect?: (time: string) => void;
  selectedTime?: string;
}

interface DiaCalendario {
  data: string;
  dia: number;
  mesAtual: boolean;
  disponivel: boolean;
  passado: boolean;
  domingo?: boolean;
}

export default function CalendarioAgendamento({
  onDateSelect,
  selectedDate,
  onTimeSelect,
  selectedTime,
}: CalendarioAgendamentoProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [datasComHorarios, setDatasComHorarios] = useState<string[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [horariosPorData, setHorariosPorData] = useState<{ [data: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);

  const carregarDisponibilidadeMes = useCallback(async () => {
    try {
      setLoading(true);
      const ano = currentMonth.getFullYear();
      const mes = currentMonth.getMonth() + 1; // API espera 1-12

      const response = await fetch(`/api/disponibilidade?ano=${ano}&mes=${mes}`);

      if (response.ok) {
        const data: LivresMes = await response.json();
        const datasDisponiveis = Object.keys(data.disponibilidades || {});
        setDatasComHorarios(datasDisponiveis);
        setHorariosPorData(data.disponibilidades || {});
      } else {
        console.error('Erro na resposta da API:', response.status);
        setDatasComHorarios([]);
        setHorariosPorData({});
      }
    } catch (error) {
      console.error('Erro ao carregar disponibilidade:', error);
      setDatasComHorarios([]);
      setHorariosPorData({});
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  // Carregar dados de disponibilidade para o mês atual
  useEffect(() => {
    // Debounce para evitar múltiplas requisições
    const timeoutId = setTimeout(() => {
      carregarDisponibilidadeMes();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentMonth, carregarDisponibilidadeMes]);

  const carregarHorariosData = async (data: string) => {
    // Primeiro, tentar usar os horários já carregados em cache
    if (horariosPorData[data]) {
      setHorariosDisponiveis(horariosPorData[data]);
      return;
    }

    try {
      setLoadingHorarios(true);
      const response = await fetch(`/api/disponibilidade?data=${data}`);
      if (response.ok) {
        const resultado: LivresDia = await response.json();
        setHorariosDisponiveis(resultado.horarios || []);
      } else {
        setHorariosDisponiveis([]);
      }
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      setHorariosDisponiveis([]);
    } finally {
      setLoadingHorarios(false);
    }
  };

  const gerarCalendario = (): DiaCalendario[] => {
    const ano = currentMonth.getFullYear();
    const mes = currentMonth.getMonth();

    // Primeiro dia do mês
    const primeiroDia = new Date(ano, mes, 1);
    // Último dia do mês
    const ultimoDia = new Date(ano, mes + 1, 0);

    // Dia da semana do primeiro dia (0 = domingo, 1 = segunda, etc.)
    const primeiroDiaSemana = primeiroDia.getDay();

    // Calcular quantos dias do mês anterior mostrar
    const diasAnteriores = primeiroDiaSemana === 0 ? 6 : primeiroDiaSemana - 1;

    const calendario: DiaCalendario[] = [];

    // Adicionar dias do mês anterior (desabilitados)
    for (let i = diasAnteriores; i > 0; i--) {
      const data = new Date(ano, mes, -i + 1);
      calendario.push({
        data: data.toISOString().split('T')[0],
        dia: data.getDate(),
        mesAtual: false,
        disponivel: false,
        passado: true
      });
    }

    // Adicionar dias do mês atual
    const hoje = new Date();
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const data = new Date(ano, mes, dia);
      const dataString = data.toISOString().split('T')[0];
      const ehPassado = data < hoje;
      const ehDomingo = data.getDay() === 0;

      calendario.push({
        data: dataString,
        dia: dia,
        mesAtual: true,
        disponivel: !ehPassado && !ehDomingo && datasComHorarios.includes(dataString),
        passado: ehPassado,
        domingo: ehDomingo
      });
    }

    // Completar semana com dias do próximo mês (se necessário)
    const totalDias = calendario.length;
    const diasRestantes = totalDias % 7;
    if (diasRestantes !== 0) {
      const diasProximoMes = 7 - diasRestantes;
      for (let i = 1; i <= diasProximoMes; i++) {
        const data = new Date(ano, mes + 1, i);
        calendario.push({
          data: data.toISOString().split('T')[0],
          dia: i,
          mesAtual: false,
          disponivel: false,
          passado: false
        });
      }
    }

    return calendario;
  };

  const proximoMes = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const mesAnterior = () => {
    const hoje = new Date();
    const novoMes = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);

    // Não permitir ir para meses anteriores ao atual
    if (novoMes.getFullYear() > hoje.getFullYear() ||
        (novoMes.getFullYear() === hoje.getFullYear() && novoMes.getMonth() >= hoje.getMonth())) {
      setCurrentMonth(novoMes);
    }
  };

  const handleDateClick = async (item: DiaCalendario) => {
    if (item.disponivel && item.mesAtual) {
      onDateSelect(item.data);
      await carregarHorariosData(item.data);
    }
  };

  const calendario = gerarCalendario();
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div>
      {/* Cabeçalho do calendário */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Button
          onClick={mesAnterior}
          variant="link"
          className="fs-4"
          disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
          aria-label="Mês anterior"
        >
          ‹
        </Button>

        <h3 className="mb-0 text-center flex-grow-1">
          {meses[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>

        <Button
          onClick={proximoMes}
          variant="link"
          className="fs-4"
          disabled={currentMonth.getFullYear() >= new Date().getFullYear() + 1 && currentMonth.getMonth() >= 11}
          aria-label="Próximo mês"
        >
          ›
        </Button>
      </div>

      <div>
        {loading ? (
          <div className="d-flex flex-column align-items-center gap-2 py-4">
            <Spinner animation="border" variant="primary" size="sm" />
            <span className="text-secondary">Carregando disponibilidade...</span>
          </div>
        ) : (
          <Table borderless responsive className="text-center mb-0">
            <thead>
              <tr>
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
                  <th key={dia} className="pmc-rotulo">{dia}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(calendario.length / 7) }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {calendario.slice(rowIndex * 7, rowIndex * 7 + 7).map((item, index) => (
                    <td key={index} className="p-1">
                      <Button
                        size="sm"
                        variant={
                          item.data === selectedDate
                            ? 'primary'
                            : item.disponivel && item.mesAtual
                              ? 'outline-primary'
                              : 'outline-secondary'
                        }
                        onClick={() => handleDateClick(item)}
                        disabled={!item.disponivel || !item.mesAtual || item.passado}
                        className={`w-100 ${!item.mesAtual ? 'opacity-50' : ''}`}
                      >
                        {item.dia}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Horários disponíveis para a data selecionada */}
      {selectedDate && (
        <div className="mt-4 p-3 rounded-3 bg-light">
          <h4 className="mb-3">
            Horários para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}:
          </h4>

          {loadingHorarios ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" variant="primary" size="sm" />
              <span className="text-secondary">Carregando horários...</span>
            </div>
          ) : horariosDisponiveis.length > 0 ? (
            <div className="d-flex flex-wrap gap-2">
              {horariosDisponiveis.map((hora) => (
                <Button
                  key={hora}
                  onClick={() => onTimeSelect && onTimeSelect(hora)}
                  variant={hora === selectedTime ? 'primary' : 'outline-primary'}
                  size="sm"
                  className="rounded-pill"
                >
                  {hora}
                </Button>
              ))}
            </div>
          ) : (
            <span className="text-secondary">Nenhum horário livre nesta data.</span>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="d-flex flex-wrap gap-3 mt-3 pt-3 border-top">
        <div className="d-flex align-items-center gap-2">
          <span className="rounded-circle bg-primary" style={{ width: '10px', height: '10px' }} />
          <span className="text-secondary small">Disponível</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="rounded-circle bg-secondary" style={{ width: '10px', height: '10px' }} />
          <span className="text-secondary small">Indisponível</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="rounded-circle border border-primary" style={{ width: '10px', height: '10px' }} />
          <span className="text-secondary small">Selecionado</span>
        </div>
      </div>
    </div>
  );
}
