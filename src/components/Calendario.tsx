'use client';

import { useState } from 'react';

interface CalendarioProps {
  consultasData: string[];
  disponibilidadesData: string[];
  onDateSelect: (date: string) => void;
  selectedDate?: string;
}

export default function Calendario({ consultasData, disponibilidadesData, onDateSelect, selectedDate }: CalendarioProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }

    return days;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={prevMonth} style={{ padding: '8px 12px', border: 'none', backgroundColor: '#f0f0f0', borderRadius: '4px', cursor: 'pointer' }}>
          ←
        </button>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button onClick={nextMonth} style={{ padding: '8px 12px', border: 'none', backgroundColor: '#f0f0f0', borderRadius: '4px', cursor: 'pointer' }}>
          →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '10px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} style={{ padding: '8px', textAlign: 'center', fontWeight: '600', fontSize: '14px', color: '#666' }}>
            {day}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days.map((day, index) => {
          const dateStr = formatDate(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = formatDate(day) === formatDate(new Date());
          const hasConsulta = consultasData.includes(dateStr);
          const hasDisponibilidade = disponibilidadesData.includes(dateStr);
          const isSelected = selectedDate === dateStr;

          return (
            <div
              key={index}
              onClick={() => isCurrentMonth && onDateSelect(dateStr)}
              style={{
                padding: '8px',
                textAlign: 'center',
                cursor: isCurrentMonth ? 'pointer' : 'default',
                backgroundColor: isSelected ? '#007bff' : isToday ? '#f0f8ff' : 'transparent',
                color: isSelected ? 'white' : !isCurrentMonth ? '#ccc' : isToday ? '#007bff' : '#333',
                borderRadius: '4px',
                position: 'relative',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px'
              }}
            >
              {day.getDate()}
              {isCurrentMonth && (hasConsulta || hasDisponibilidade) && (
                <div style={{ position: 'absolute', bottom: '2px', right: '2px', display: 'flex', gap: '2px' }}>
                  {hasConsulta && (
                    <div style={{ width: '6px', height: '6px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
                  )}
                  {hasDisponibilidade && (
                    <div style={{ width: '6px', height: '6px', backgroundColor: '#28a745', borderRadius: '50%' }}></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#007bff', borderRadius: '50%' }}></div>
            <span>Consultas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#28a745', borderRadius: '50%' }}></div>
            <span>Disponível</span>
          </div>
        </div>
      </div>
    </div>
  );
}