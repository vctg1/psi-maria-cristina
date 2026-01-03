'use client';

import { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import Table from 'react-bootstrap/Table';

interface CalendarioAgendamentoProps {
  onDateSelect: (date: string) => void;
  selectedDate: string;
  onTimeSelect?: (time: string) => void;
}

interface HorarioDisponivel {
  id: string;
  hora: string;
  data?: string;
  tipo: 'unico' | 'recorrente';
  diaSemana?: number;
  ativo: boolean;
}

export default function CalendarioAgendamento({ 
  onDateSelect, 
  selectedDate, 
  onTimeSelect 
}: CalendarioAgendamentoProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [datasComHorarios, setDatasComHorarios] = useState<string[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioDisponivel[]>([]);
  const [horariosPorData, setHorariosPorData] = useState<{ [data: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [screenSize, setScreenSize] = useState('desktop');

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth <= 768) {
        setScreenSize('mobile');
      } else if (window.innerWidth <= 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const isMobile = screenSize === 'mobile';
  const isTablet = screenSize === 'tablet';

  // Carregar dados de disponibilidade para o mês atual
  useEffect(() => {
    // Debounce para evitar múltiplas requisições
    const timeoutId = setTimeout(() => {
      carregarDisponibilidadeMes();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentMonth]);

  const carregarDisponibilidadeMes = async () => {
    try {
      setLoading(true);
      const ano = currentMonth.getFullYear();
      const mes = currentMonth.getMonth(); // 0-11
      
      // Usar o novo endpoint otimizado que retorna todas as disponibilidades do mês
      const response = await fetch(`/api/disponibilidade?ano=${ano}&mes=${mes}`);
      
      if (response.ok) {
        const data = await response.json();
        // Extrair apenas as datas que têm horários disponíveis
        const datasDisponiveis = Object.keys(data.disponibilidades || {});
        setDatasComHorarios(datasDisponiveis);
        
        // Salvar os horários para cada data para uso posterior
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
  };

  const carregarHorariosData = async (data: string) => {
    try {
      // Primeiro, tentar usar os horários já carregados em cache
      if (horariosPorData[data]) {
        const horariosFormatados = horariosPorData[data].map((horario, index) => ({
          id: `${data}-${index}`,
          hora: horario,
          data: data,
          tipo: 'recorrente' as const,
          ativo: true
        }));
        setHorariosDisponiveis(horariosFormatados);
        return;
      }
      
      // Se não estiver em cache, fazer requisição individual (fallback)
      const response = await fetch(`/api/horarios?data=${data}&disponiveis=true`);
      if (response.ok) {
        const horarios = await response.json();
        setHorariosDisponiveis(horarios);
      }
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
    }
  };

  const gerarDatasDoMes = (mes: Date) => {
    const datas = [];
    const ano = mes.getFullYear();
    const mesAtual = mes.getMonth();
    const hoje = new Date();
    
    // Primeiro dia do mês
    const primeiroDia = new Date(ano, mesAtual, 1);
    // Último dia do mês
    const ultimoDia = new Date(ano, mesAtual + 1, 0);

    for (let dia = primeiroDia.getDate(); dia <= ultimoDia.getDate(); dia++) {
      const data = new Date(ano, mesAtual, dia);
      
      // Só incluir datas futuras e que não sejam domingo
      if (data >= hoje && data.getDay() !== 0) {
        datas.push(data.toISOString().split('T')[0]);
      }
    }

    return datas;
  };

  const gerarCalendario = () => {
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
    
    const calendario = [];
    
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

  const handleDateClick = async (item: any) => {
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
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '12px', 
      padding: isMobile ? '1rem' : '1.5rem',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Cabeçalho do calendário */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: isMobile ? '1rem' : '1.5rem'
      }}>
        <Button
          onClick={mesAnterior}
          style={{
            fontSize: isMobile ? '16px' : '18px',
            width: isMobile ? '32px' : '36px',
          }}
          variant='outline-light'
          disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
        >
          ‹
        </Button>
        
        <h3 style={{ 
          margin: 0, 
          color: '#2c3e50',
          fontSize: isMobile ? '1rem' : isTablet ? '1.1rem' : '1.2rem',
          fontWeight: '600',
          textAlign: 'center',
          flex: 1
        }}>
          {meses[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <Button
          onClick={proximoMes}
          style={{
            fontSize: isMobile ? '16px' : '18px',
            width: isMobile ? '32px' : '36px',
          }}
          variant='outline-light'
          disabled={currentMonth.getFullYear() >= new Date().getFullYear() + 1 && currentMonth.getMonth() >= 11}
        >
          ›
        </Button>
      </div>

      {/* <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '1px',
        marginBottom: '1rem'
      }}>
        {(isMobile ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']).map((dia, index) => (
          <div key={index} style={{
            padding: isMobile ? '10px' : '10px',
            textAlign: 'center',
            fontSize: isMobile ? '10px' : '12px',
            minWidth: isMobile ? '50px' : '60px',
            fontWeight: '600',
            color: '#666',
            backgroundColor: '#f8f9fa'
          }}>
            {dia}
          </div>
        ))}
      </div>

      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#666'
        }}>
          Carregando disponibilidade...
        </div>
      )}

      {!loading && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          gap: isMobile ? '2px' : '1px',
          overflowX: 'auto'
        }}>
          {calendario.map((item, index) => (
            <Button
              key={index}
              onClick={() => handleDateClick(item)}
              variant={
                item.data === selectedDate ? 'primary' :
                item.disponivel && item.mesAtual ? 'outline-primary' :
                'light'
              }
              disabled={!item.disponivel || !item.mesAtual || item.passado}
              style={{
                cursor: 
                  item.disponivel && item.mesAtual && !item.passado ? 'pointer' : 'not-allowed',
                fontSize: isMobile ? '10px' : '14px',
                fontWeight: selectedDate === item.data ? '600' : '400',
                minHeight: isMobile ? '30px' : '40px',
                minWidth: isMobile ? '50px' : '60px',
                opacity: !item.mesAtual ? 0.3 : 1
              }}
            >
              {item.dia}
            </Button>
          ))}
        </div>
      )} */}
      <div style={{ overflowX: 'auto' }}>
        {loading ? 
          <div style={{ textAlign: 'center', padding: isMobile ? '1rem' : '1.5rem', color: '#666' }}>
            Carregando disponibilidade...
          </div>:
          <Table bordered hover responsive style={{ width: '100%', overflowX: 'auto' }}>
              <thead>
                <tr>
                  {(isMobile ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']).map((dia, index) => (
                    <th key={index} >
                      {dia}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(calendario.length / 7) }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {calendario.slice(rowIndex * 7, rowIndex * 7 + 7).map((item, index) => (
                      <td key={index}>
                        <Button variant={item.data === selectedDate ? 'primary' : item.disponivel && item.mesAtual ? 'outline-primary' : 'light'}
                          onClick={() => handleDateClick(item)}
                          disabled={!item.disponivel || !item.mesAtual || item.passado}
                          style={{
                            cursor: item.disponivel && item.mesAtual && !item.passado ? 'pointer' : 'not-allowed',
                            fontSize: isMobile ? '10px' : '14px',
                            fontWeight: selectedDate === item.data ? '600' : '400',
                            width: '100%',
                            opacity: !item.mesAtual ? 0.3 : 1
                          }}
                        >
                          {item.dia}
                        </Button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            }
        </div>

      {/* Horários disponíveis para a data selecionada */}
      {selectedDate && horariosDisponiveis.length > 0 && (
        <div style={{ 
          marginTop: isMobile ? '1rem' : '1.5rem', 
          padding: isMobile ? '0.8rem' : '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            margin: '0 0 1rem 0', 
            color: '#2c3e50',
            fontSize: isMobile ? '0.9rem' : '1rem'
          }}>
            Horários para {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}:
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(80px, 1fr))' : 'repeat(auto-fill, minmax(100px, 1fr))', 
            gap: isMobile ? '6px' : '8px' 
          }}>
            {horariosDisponiveis.map(horario => (
              <Button
                key={horario.id}
                onClick={() => onTimeSelect && onTimeSelect(horario.hora)}
                variant="light"
                style={{
                  fontSize: isMobile ? '12px' : '14px',
                }}
              >
                {horario.hora}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={{ 
        marginTop: '1rem', 
        padding: '0.75rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: 'white', 
              border: '1px solid #e0e0e0',
              borderRadius: '2px'
            }}></div>
            <span style={{ color: '#666' }}>Disponível</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#f0f0f0', 
              borderRadius: '2px'
            }}></div>
            <span style={{ color: '#666' }}>Indisponível</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #3498db',
              borderRadius: '2px'
            }}></div>
            <span style={{ color: '#666' }}>Selecionado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
