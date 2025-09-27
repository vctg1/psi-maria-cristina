import Image from "next/image";
import Link from "next/link";


export default function Home() {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#ffffff', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
        padding: '1rem 0',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <nav style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0 2rem'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
            Psicóloga Maria Cristina
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <Link href="/agendamento" style={{ 
              padding: '0.75rem 1.5rem', 
              backgroundColor: '#3498db', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '5px',
              fontWeight: '500'
            }}>
              Agendar Consulta
            </Link>
            <Link href="/area-restrita" style={{ 
              padding: '0.75rem 1.5rem', 
              backgroundColor: '#27ae60', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '5px',
              fontWeight: '500'
            }}>
              Área Restrita
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{ 
        backgroundColor: '#ecf0f1', 
        padding: '4rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            color: '#2c3e50', 
            marginBottom: '1rem',
            fontWeight: '700'
          }}>
            Psicóloga Maria Cristina
          </h1>
          <p style={{ 
            fontSize: '1.5rem', 
            color: '#7f8c8d', 
            marginBottom: '2rem',
            maxWidth: '800px',
            margin: '0 auto 2rem auto'
          }}>
            Atendimento psicológico online para crianças, adolescentes e adultos
          </p>
          <Link href="/agendamento" style={{ 
            display: 'inline-block',
            padding: '1rem 2rem', 
            backgroundColor: '#e74c3c', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '8px',
            fontSize: '1.2rem',
            fontWeight: '600'
          }}>
            Agende Sua Consulta Online
          </Link>
        </div>
      </section>

      {/* About Section */}
      <section style={{ padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem', alignItems: 'center' }}>
            <div>
              <Image
                src="/CristinaLivro.jpeg"
                alt="Psicóloga Maria Cristina"
                width={400}
                height={500}
                style={{ borderRadius: '10px', width: '100%', height: 'auto' }}
              />
            </div>
            <div>
              <h2 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '1.5rem' }}>
                Sobre a Psicóloga
              </h2>
              <p style={{ fontSize: '1.1rem', color: '#555', lineHeight: '1.8', marginBottom: '1.5rem' }}>
                Psicóloga clínica com mais de 10 anos de experiência no atendimento de crianças, 
                adolescentes e adultos. Especialista em terapia cognitivo-comportamental e psicoterapia familiar.
              </p>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Especialidades:</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {[
                    'Terapia Cognitivo-Comportamental',
                    'Psicoterapia Infantil',
                    'Psicoterapia do Adolescente',
                    'Terapia Familiar',
                    'Transtornos de Ansiedade',
                    'Depressão',
                    'Dificuldades de Aprendizagem'
                  ].map(especialidade => (
                    <li key={especialidade} style={{ 
                      padding: '0.5rem 0', 
                      borderBottom: '1px solid #ecf0f1',
                      color: '#555'
                    }}>
                      ✓ {especialidade}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section style={{ backgroundColor: '#f8f9fa', padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '3rem' }}>
            Como Funciona
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                backgroundColor: '#3498db', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'white'
              }}>
                1
              </div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Agendamento Online</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                Escolha o dia e horário disponível que melhor se adequa à sua rotina.
              </p>
            </div>
            
            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                backgroundColor: '#27ae60', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'white'
              }}>
                2
              </div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Confirmação</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                Receba por email a confirmação do agendamento e dados para pagamento.
              </p>
            </div>
            
            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                backgroundColor: '#e74c3c', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'white'
              }}>
                3
              </div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Consulta Online</h3>
              <p style={{ color: '#666', lineHeight: '1.6' }}>
                Acesse sua área restrita e participe da consulta via Google Meet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section style={{ padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '2rem' }}>
            Contato
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Email</h3>
              <p style={{ color: '#666' }}>contato@psimariacristina.com</p>
            </div>
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Telefone</h3>
              <p style={{ color: '#666' }}>(11) 99999-9999</p>
            </div>
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '1rem' }}>Valor da Consulta</h3>
              <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: '600' }}>R$ 150,00</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        backgroundColor: '#2c3e50', 
        color: 'white', 
        padding: '2rem', 
        textAlign: 'center' 
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ margin: 0, fontSize: '1rem' }}>
            © 2024 Psicóloga Maria Cristina - Todos os direitos reservados
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
            Atendimento online • Crianças, Adolescentes e Adultos
          </p>
        </div>
      </footer>
    </div>
  );
}
