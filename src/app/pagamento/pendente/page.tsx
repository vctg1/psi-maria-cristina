'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import type { CobrancaOnlineDto } from '@/types/pagamento';
import { formatarMoeda } from '@/components/area-restrita/financeiro/formatos';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'neutro' }
  | { fase: 'pronto'; cobranca: CobrancaOnlineDto };

const CONTEUDO_POR_STATUS: Record<
  CobrancaOnlineDto['status'],
  { titulo: string; icone: string; classe: string }
> = {
  pago: { titulo: 'Pagamento confirmado', icone: 'bi-check-circle', classe: 'text-success' },
  pendente: { titulo: 'Pagamento em processamento', icone: 'bi-hourglass-split', classe: 'text-warning' },
  falhou: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
  expirado: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
  estornado: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
};

export default function PagamentoPendentePage() {
  return (
    <Suspense fallback={null}>
      <PagamentoPendenteConteudo />
    </Suspense>
  );
}

function PagamentoPendenteConteudo() {
  const searchParams = useSearchParams();
  const pagamentoId = searchParams.get('p');
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  useEffect(() => {
    if (!pagamentoId) {
      setEstado({ fase: 'neutro' });
      return;
    }
    fetch(`/api/pagamentos/${pagamentoId}/cobranca`)
      .then(async (response) => {
        if (!response.ok) {
          setEstado({ fase: 'neutro' });
          return;
        }
        const dados = (await response.json()) as CobrancaOnlineDto;
        setEstado({ fase: 'pronto', cobranca: dados });
      })
      .catch(() => setEstado({ fase: 'neutro' }));
  }, [pagamentoId]);

  return (
    <div className="pmc-auth">
      <Card className="pmc-auth-card pmc-acima">
        <Card.Body className="text-center">
          {estado.fase === 'carregando' && (
            <div className="py-4">
              <Spinner animation="border" role="status" />
            </div>
          )}

          {estado.fase === 'neutro' && (
            <>
              <div className="pmc-icone mx-auto mb-3">
                <i className="bi bi-info-circle" />
              </div>
              <h1 className="h4 mb-2">Não encontramos essa cobrança</h1>
              <p className="pmc-texto-2 mb-4">Verifique o link recebido ou acesse sua área para conferir suas consultas.</p>
              <Link href="/area-paciente">
                <Button variant="primary" id="botao-ir-para-area">
                  Ir para minha área
                </Button>
              </Link>
            </>
          )}

          {estado.fase === 'pronto' && (
            <>
              <div className="pmc-icone mx-auto mb-3">
                <i className={`bi ${CONTEUDO_POR_STATUS[estado.cobranca.status].icone} ${CONTEUDO_POR_STATUS[estado.cobranca.status].classe}`} />
              </div>
              <h1 className="h4 mb-2">{CONTEUDO_POR_STATUS[estado.cobranca.status].titulo}</h1>
              <p className="pmc-texto-2 mb-4">{formatarMoeda(estado.cobranca.valor)}</p>
              <div className="d-flex flex-column gap-2 align-items-center">
                <Link href="/area-paciente">
                  <Button variant="primary" id="botao-ir-para-area">
                    Ir para minha área
                  </Button>
                </Link>
                {estado.cobranca.status !== 'pago' && estado.cobranca.linkCheckout && (
                  <a
                    id="botao-tentar-novamente"
                    className="btn btn-outline-secondary"
                    href={estado.cobranca.linkCheckout}
                  >
                    Tentar novamente
                  </a>
                )}
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
