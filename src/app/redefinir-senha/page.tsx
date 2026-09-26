'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import DefinirSenhaForm from '@/components/DefinirSenhaForm';
import { useAuth } from '@/contexts/AuthContext';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const { recarregar } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [prontoParaLer, setProntoParaLer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // StrictMode (dev) roda o efeito 2x: a 2a leitura ja ve a URL limpa — nunca sobrescrever um token ja lido com null.
    const t = new URLSearchParams(window.location.search).get('token');
    if (t) {
      setToken((prev) => prev ?? t);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setProntoParaLer(true);
  }, []);

  const handleSubmit = async (senha: string) => {
    if (!token) return;
    setEnviando(true);
    setErro(null);
    try {
      const response = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível concluir. Tente novamente.');
        return;
      }
      await recarregar();
      router.replace('/area-restrita');
    } catch {
      setErro('Não foi possível concluir. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pmc-auth">
      <div className="pmc-mancha pmc-mancha--salvia" style={{ top: '-8%', left: '-10%', width: '46%', aspectRatio: 1 }} aria-hidden="true" />
      <div className="pmc-mancha" style={{ bottom: '-10%', right: '-8%', width: '40%', aspectRatio: 1 }} aria-hidden="true" />
      <Card className="pmc-auth-card pmc-acima">
        <Card.Body>
          <Image
            src="/maria-cristina-logo.png?v=original-20260926"
            alt="Psicóloga Maria Cristina"
            width={72}
            height={72}
            className="pmc-auth-logo mb-3"
            style={{ objectFit: 'contain' }}
          />
          <div className="text-center">
            <span className="pmc-rotulo">Redefinir senha</span>
            <h1 className="h3 mt-2">Escolha uma nova senha.</h1>
            <p className="mb-4 pmc-texto-2">
              Defina uma nova senha para continuar acessando sua área.
            </p>
          </div>
          {erro && <Alert variant="danger">{erro}</Alert>}
          {prontoParaLer && !token ? (
            <Alert variant="warning" className="mb-0">
              Link inválido. Peça um novo link à psicóloga.
            </Alert>
          ) : (
            prontoParaLer && (
              <DefinirSenhaForm onSubmit={handleSubmit} enviando={enviando} rotulo="Redefinir senha" />
            )
          )}
          <div className="text-center mt-3">
            <Link href="/">
              <Button variant="link" size="sm">Voltar ao início</Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
