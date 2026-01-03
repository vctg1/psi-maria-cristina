'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import React from "react";
import Button from 'react-bootstrap/Button'

export default function Home() {
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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ height: isScrolled ? '6rem' : '0'}}></div>
      <header style={{ 
        backgroundColor: '#ffffff', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
        padding: isMobile ? '0.8rem 0' : '0',
        position: isScrolled ? 'fixed' : 'sticky',
        top: 0,
        width: '100%',
        zIndex: 1000
      }}>
        <nav style={{ 
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '0 1rem' : '0 2rem',
          flexDirection: (isMobile && !isScrolled) ? 'column' : 'row',
          gap: isMobile ? '1rem' : '0'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Link href="/">
            <Image
              src="/maria-cristina-logo.png"
              alt="Psicóloga Maria Cristina"
              width={isMobile ? 120 : isTablet ? 140 : 160}
              height={isScrolled ? (isMobile ? 40 : 53) : (isMobile ? 120 : isTablet ? 140 : 160)}
              style={{ 
                objectFit: 'contain',
                maxWidth: '100%',
                transition: 'height 0.2s ease-in-out'
              }}
              priority
            />
            </Link>
          </div>
          <div style={{ 
            display: 'flex',
            gap: isMobile ? '0.5rem' : '2rem',
            flexDirection: isMobile ? 'column' : 'row',
            width: isMobile ? '100%' : 'auto'
          }}>
            <Link href="/agendamento">
            <Button variant="primary" size="lg" style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: '600' }}  >
              Agendar Consulta
            </Button>
            </Link>
            {/* <Link href="/area-restrita" style={{ 
              padding: isMobile ? '0.6rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: '#27ae60',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px',
              fontWeight: '500',
              textAlign: 'center',
              fontSize: isMobile ? '0.9rem' : '1rem'
            }}>
              Área Restrita
            </Link> */}
          </div>
        </nav>
      </header>

      {/* About Section */}
      <section style={{ padding: isMobile ? '2rem 1rem' : '1rem'}}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '1fr 2fr', 
            gap: isMobile ? '2rem' : isTablet ? '2.5rem' : '3rem', 
            alignItems: 'center' 
          }}>
            <div>
              <Image
                src="/CristinaLivro.jpeg"
                alt="Psicóloga Maria Cristina"
                width={400}
                height={500}
                style={{ borderRadius: '10px', width: '100%', height: 'auto', maxWidth: (isMobile || isTablet) ? '400px' : '100%', margin: isMobile ? '0 auto' : '0' }}
              />
            </div>
            <div>
              <h2 style={{ 
                fontSize: isMobile ? '1.8rem' : isTablet ? '2.2rem' : '2.5rem', 
                color: '#2c3e50', 
              }}>
                Sobre a Psicóloga
              </h2>
              <p style={{ 
                fontSize: isMobile ? '1rem' : isTablet ? '1.05rem' : '1.1rem', 
                color: '#555', 
                lineHeight: '1.8', 
                marginBottom: '1.5rem'
              }}>
                Psicóloga clínica com experiência no atendimento de crianças, 
                adolescentes e adultos. Terapia cognitivo-comportamental e psicoterapia familiar.
              </p>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ 
                  color: '#2c3e50', 
                  marginBottom: '1rem',
                  fontSize: isMobile ? '1.2rem' : '1.3rem',
                  textAlign: 'left'
                }}>
                  Especialidades:
                </h3>
                <ul style={{ 
                  listStyle: 'none', 
                  padding: 0,
                  maxWidth: isMobile ? '300px' : '100%',
                  margin: '0'
                }}>
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
                      color: '#555',
                      fontSize: isMobile ? '0.9rem' : '1rem'
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
      <section style={{ backgroundColor: '#f8f9fa', padding: isMobile ? '2rem 1rem' : isTablet ? '3rem 1.5rem' : '4rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.8rem' : isTablet ? '2.2rem' : '2.5rem', 
            color: '#2c3e50', 
            marginBottom: isMobile ? '2rem' : '3rem' 
          }}>
            Como Funciona
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', 
            gap: isMobile ? '1.5rem' : '2rem' 
          }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: isMobile ? '1.5rem' : '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: isMobile ? '50px' : '60px', 
                height: isMobile ? '50px' : '60px', 
                backgroundColor: '#3498db', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem',
                color: 'white'
              }}>
                1
              </div>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Agendamento Online
              </h3>
              <p style={{ 
                color: '#666', 
                lineHeight: '1.6',
                fontSize: isMobile ? '0.9rem' : '1rem'
              }}>
                Escolha o dia e horário disponível que melhor se adequa à sua rotina.
              </p>
              <i className="bi bi-calendar-check" style={{ fontSize: isMobile ? '4rem' : '5rem', color: '#3498db', marginTop: '1rem' }}></i>
            </div>
            
            <div style={{ 
              backgroundColor: 'white', 
              padding: isMobile ? '1.5rem' : '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: isMobile ? '50px' : '60px', 
                height: isMobile ? '50px' : '60px', 
                backgroundColor: '#27ae60', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem',
                color: 'white'
              }}>
                2
              </div>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Confirmação
              </h3>
              <p style={{ 
                color: '#666', 
                lineHeight: '1.6',
                fontSize: isMobile ? '0.9rem' : '1rem'
              }}>
                Receba a confirmação do agendamento no whatsapp.
              </p>
              <i className="bi bi-chat-dots" style={{ fontSize: isMobile ? '4rem' : '5rem', color: '#27ae60', marginTop: '1rem' }}></i>
            </div>
            
            <div style={{ 
              backgroundColor: 'white', 
              padding: isMobile ? '1.5rem' : '2rem', 
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              gridColumn: isMobile ? '1' : isTablet ? 'span 2' : 'span 1'
              }}>
              <div style={{ 
                width: isMobile ? '50px' : '60px', 
                height: isMobile ? '50px' : '60px', 
                backgroundColor: '#e74c3c', 
                borderRadius: '50%', 
                margin: '0 auto 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem',
                color: 'white'
              }}>
                3
              </div>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Consulta Online / Presencial
              </h3>
              <p style={{ 
                color: '#666', 
                lineHeight: '1.6',
                fontSize: isMobile ? '0.9rem' : '1rem'
              }}>
                Participe da consulta no horário agendado via Google Meet.<br /> OU <br />Compareça ao consultório para atendimento presencial.
              </p>
            <Link href="/agendamento">
              <Button variant="outline-danger" size="lg" style={{ marginTop: '1rem', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: '600' }}  >
                <i className="bi bi-calendar-plus" style={{ marginRight: '0.5rem' }}></i>
                Agendar Consulta
              </Button>
            </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      {/* <section style={{ padding: isMobile ? '2rem 1rem' : isTablet ? '3rem 1.5rem' : '4rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: isMobile ? '1.8rem' : isTablet ? '2.2rem' : '2.5rem', 
            color: '#2c3e50', 
            marginBottom: '2rem' 
          }}>
            Contato
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', 
            gap: isMobile ? '1.5rem' : '2rem' 
          }}>
            <div style={{ 
              padding: isMobile ? '1rem' : '1.5rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px'
            }}>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Email
              </h3>
              <p style={{ 
                color: '#666',
                fontSize: isMobile ? '0.9rem' : '1rem',
                wordBreak: 'break-word'
              }}>
                mariacriscassia02@gmail.com
              </p>
            </div>
            <div style={{ 
              padding: isMobile ? '1rem' : '1.5rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px'
            }}>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Telefone
              </h3>
              <p style={{ 
                color: '#666',
                fontSize: isMobile ? '0.9rem' : '1rem'
              }}>
                (61) 99539-1540
              </p>
            </div>
            <div style={{ 
              padding: isMobile ? '1rem' : '1.5rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px',
              gridColumn: isMobile ? '1' : isTablet ? 'span 2' : '3'
            }}>
              <h3 style={{ 
                color: '#2c3e50', 
                marginBottom: '1rem',
                fontSize: isMobile ? '1.1rem' : '1.2rem'
              }}>
                Valor da Consulta
              </h3>
              <p style={{ 
                color: '#85BB65', 
                fontSize: isMobile ? '1.1rem' : '1.2rem', 
                fontWeight: '600' 
              }}>
                R$ 150,00
              </p>
            </div>
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer style={{ 
        backgroundColor: '#2c3e50', 
        color: 'white', 
        padding: isMobile ? '1.5rem 1rem' : '2rem', 
        textAlign: 'center' 
      }}>
          {/* CONTATO E ENDEREÇO BOOTSTRAP COM PREVIEW map GOOGLE MAPS https://maps.app.goo.gl/QPZNEDAxiE5qVB7x6 */}
        <address>
          <ul className="list-unstyled">
            <li>Telefone: <a href="tel:+5561995391540" style={{ color: 'white', textDecoration: 'underline' }}>(61) 99539-1540</a></li>
            <li>Email: <a href="mailto:mariacriscassia02@gmail.com" style={{ color: 'white', textDecoration: 'underline' }}>mariacriscassia02@gmail.com</a></li>
            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d61528.48265927053!2d-47.644439255551625!3d-15.455889216215418!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a6ff8c53ef657%3A0x6bacb765fe50147d!2sPlanaltina%2C%20GO!5e0!3m2!1spt-BR!2sbr!4v1767480094006!5m2!1spt-BR!2sbr"
              width={isMobile ? "250" : "400"}
              height={isMobile ? "150" : "200"}
              style={{ border: 0, marginTop: '1rem' }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </ul>
        </address>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ 
            margin: 0, 
            fontSize: isMobile ? '0.9rem' : '1rem',
            lineHeight: '1.4'
          }}>
            © {new Date().getFullYear()} Psicóloga Maria Cristina - Todos os direitos reservados
          </p>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            fontSize: isMobile ? '0.8rem' : '0.9rem', 
            opacity: 0.8,
            lineHeight: '1.4'
          }}>
            Atendimento online • Crianças, Adolescentes e Adultos
          </p>
        </div>
      </footer>
    </div>
  );
}
