'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import type { CobrancaOnlineDto, CobrancaRetornoDto, PagamentoStatus } from '@/types/pagamento';
import { formatarMoeda } from '@/components/area-restrita/financeiro/formatos';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'neutro' }
  | { fase: 'pronto'; status: PagamentoStatus; valor: number | null; linkCheckout: string | null };

const CONTEUDO_POR_STATUS: Record<PagamentoStatus, { titulo: string; icone: string; classe: string }> = {
  pago: { titulo: 'Pagamento confirmado', icone: 'bi-check-circle', classe: 'text-success' },
  pendente: { titulo: 'Pagamento em processamento', icone: 'bi-hourglass-split', classe: 'text-warning' },
  falhou: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
  expirado: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
  estornado: { titulo: 'Não foi possível concluir', icone: 'bi-x-circle', classe: 'text-danger' },
  cancelado: { titulo: 'Esta cobrança foi cancelada', icone: 'bi-x-circle', classe: 'text-danger' },
};

const DICA_POR_STATUS: Partial<Record<PagamentoStatus, string>> = {
  pago: 'Obrigada! A confirmação também aparece na sua área.',
  pendente: 'Assim que o pagamento for aprovado, ele aparece na sua área.',
  cancelado: 'Se precisar pagar esta consulta, peça um novo link à psicóloga.',
};

/** Conteúdo das páginas /pagamento/{sucesso,pendente,falha}. Logada, a paciente vê o valor (rota
 *  autenticada); sem login — caso comum de quem paga pelo link do WhatsApp — cai na rota pública,
 *  que devolve só o status. O status exibido vem sempre do servidor, nunca da query do gateway. */
export default function RetornoPagamento() {
  const searchParams = useSearchParams();
  const pagamentoId = searchParams.get('p');
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });

  useEffect(() => {
    if (!pagamentoId) {
      setEstado({ fase: 'neutro' });
      return;
    }
    const id = encodeURIComponent(pagamentoId);
    (async () => {
      try {
        const autenticada = await fetch(`/api/pagamentos/${id}/cobranca`);
        if (autenticada.ok) {
          const dados = (await autenticada.json()) as CobrancaOnlineDto;
          setEstado({ fase: 'pronto', status: dados.status, valor: dados.valor, linkCheckout: dados.linkCheckout });
          return;
        }
        const publica = await fetch(`/api/pagamentos/${id}/retorno`);
        if (!publica.ok) {
          setEstado({ fase: 'neutro' });
          return;
        }
        const dados = (await publica.json()) as CobrancaRetornoDto;
        setEstado({ fase: 'pronto', status: dados.status, valor: null, linkCheckout: dados.linkCheckout });
      } catch {
        setEstado({ fase: 'neutro' });
      }
    })();
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
                <i className={`bi ${CONTEUDO_POR_STATUS[estado.status].icone} ${CONTEUDO_POR_STATUS[estado.status].classe}`} />
              </div>
              <h1 className="h4 mb-2">{CONTEUDO_POR_STATUS[estado.status].titulo}</h1>
              {estado.valor !== null && <p className="pmc-texto-2 mb-2">{formatarMoeda(estado.valor)}</p>}
              {DICA_POR_STATUS[estado.status] && <p className="pmc-texto-2 mb-4">{DICA_POR_STATUS[estado.status]}</p>}
              <div className="d-flex flex-column gap-2 align-items-center">
                <Link href="/area-paciente">
                  <Button variant="primary" id="botao-ir-para-area">
                    Ir para minha área
                  </Button>
                </Link>
                {estado.status !== 'pago' && estado.linkCheckout && (
                  <a id="botao-tentar-novamente" className="btn btn-outline-secondary" href={estado.linkCheckout}>
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
