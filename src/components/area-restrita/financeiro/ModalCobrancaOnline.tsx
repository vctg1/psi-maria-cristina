'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import { GATEWAYS, GATEWAY_LABEL, type Gateway, type CobrancaOnlineDto } from '@/types/pagamento';
import type { ConfiguracaoDto } from '@/types/pagamento';
import { formatarData, formatarHora } from '@/components/area-restrita/agenda/formatos';
import { formatarMoeda } from './formatos';
import { useNotificacao } from '@/components/NotificacaoProvider';

export type ConsultaParaCobrancaOnline = {
  id: string;
  inicio: string;
  pacienteNome: string;
  valor: number;
  /** Quando disponível, habilita o botão "Enviar por WhatsApp". */
  pacienteTelefone?: string;
};

type ModalCobrancaOnlineProps = {
  consultas: ConsultaParaCobrancaOnline[];
  show: boolean;
  onHide: () => void;
  onGerada: (cobranca: CobrancaOnlineDto) => void;
};

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function telefoneComDdi(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

export default function ModalCobrancaOnline({ consultas, show, onHide, onGerada }: ModalCobrancaOnlineProps) {
  const { mostrarNotificacao } = useNotificacao();
  const somaValores = consultas.reduce((soma, c) => soma + c.valor, 0);
  const primeiroPaciente = consultas[0];

  const [gateway, setGateway] = useState<Gateway>('mercadopago');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | undefined>(undefined);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [cobrancaGerada, setCobrancaGerada] = useState<CobrancaOnlineDto | null>(null);

  useEffect(() => {
    if (!show) return;
    setErro(null);
    setErroCodigo(undefined);
    setCampos({});
    setCobrancaGerada(null);
    fetch('/api/configuracao')
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ConfiguracaoDto | null) => {
        if (dados?.gatewayPadrao) setGateway(dados.gatewayPadrao);
      })
      .catch(() => {});
  }, [show]);

  const gerar = async () => {
    setEnviando(true);
    setErro(null);
    setErroCodigo(undefined);
    setCampos({});
    try {
      const response = await fetch('/api/pagamentos/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultaIds: consultas.map((c) => c.id),
          gateway,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível gerar a cobrança.');
        setErroCodigo(dados?.codigo);
        setCampos(dados?.campos ?? {});
        return;
      }
      const cobranca = dados as CobrancaOnlineDto;
      setCobrancaGerada(cobranca);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Cobrança gerada' });
      onGerada(cobranca);
    } catch {
      setErro('Não foi possível gerar a cobrança.');
    } finally {
      setEnviando(false);
    }
  };

  const copiarLink = async () => {
    if (!cobrancaGerada?.linkCheckout) return;
    try {
      await navigator.clipboard.writeText(cobrancaGerada.linkCheckout);
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Link copiado' });
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível copiar o link' });
    }
  };

  const enviarWhatsapp = () => {
    if (!cobrancaGerada?.linkCheckout || !primeiroPaciente?.pacienteTelefone) return;
    const plural = consultas.length > 1 ? 'suas consultas' : 'sua consulta';
    const mensagem = `Olá, ${primeiroPaciente.pacienteNome}! Segue o link para o pagamento da(s) ${plural}: ${cobrancaGerada.linkCheckout}`;
    window.open(
      `https://wa.me/${telefoneComDdi(primeiroPaciente.pacienteTelefone)}?text=${encodeURIComponent(mensagem)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <Modal show={show} onHide={onHide} centered id="modal-cobranca-online">
      <Modal.Header closeButton>
        <Modal.Title>Gerar cobrança online</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <Alert variant="danger">
            {erro}
            {erroCodigo === 'JA_PAGA' && <div className="mt-1">Alguma consulta já foi paga. Atualize a lista.</div>}
            {erroCodigo === 'AGUARDANDO' && (
              <div className="mt-1">Já existe uma cobrança online aguardando pagamento para alguma consulta.</div>
            )}
          </Alert>
        )}

        <span className="pmc-rotulo d-block mb-2">Consultas</span>
        <Table responsive size="sm" className="pmc-tabela mb-2">
          <thead>
            <tr>
              <th>Data</th>
              <th>Paciente</th>
              <th className="text-end">Valor</th>
            </tr>
          </thead>
          <tbody>
            {consultas.map((c) => (
              <tr key={c.id}>
                <td>
                  {formatarData(c.inicio, { day: '2-digit', month: '2-digit' })} às {formatarHora(c.inicio)}
                </td>
                <td>{c.pacienteNome}</td>
                <td className="text-end">{formatarMoeda(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="pmc-texto-2 mb-4 text-end">
          <strong>Total: {formatarMoeda(somaValores)}</strong>
        </p>

        {!cobrancaGerada ? (
          <>
            <Form.Group className="mb-1" controlId="cobrancaOnlineGateway">
              <Form.Label>Gateway</Form.Label>
              <Form.Select
                id="select-gateway-cobranca-online"
                value={gateway}
                onChange={(e) => setGateway(e.target.value as Gateway)}
                isInvalid={!!campos.gateway}
              >
                {GATEWAYS.map((g) => (
                  <option key={g} value={g}>
                    {GATEWAY_LABEL[g]}
                  </option>
                ))}
              </Form.Select>
              {campos.gateway && <Form.Control.Feedback type="invalid">{campos.gateway}</Form.Control.Feedback>}
            </Form.Group>
            <Form.Text className="d-block pmc-texto-2 mb-3">
              O valor não é editável aqui. Para mudar o valor de uma consulta, ajuste-o no painel da consulta antes
              de gerar a cobrança.
            </Form.Text>
          </>
        ) : (
          <>
            <Form.Group className="mb-2" controlId="cobrancaOnlineLink">
              <Form.Label>Link de checkout</Form.Label>
              <Form.Control id="input-link-cobranca-online" readOnly value={cobrancaGerada.linkCheckout ?? ''} />
            </Form.Group>
            <div className="d-flex flex-wrap gap-2">
              <Button
                id="botao-copiar-link-cobranca-online"
                variant="outline-secondary"
                size="sm"
                onClick={copiarLink}
              >
                Copiar
              </Button>
              <Button
                id="botao-whatsapp-cobranca-online"
                variant="primary"
                size="sm"
                disabled={!primeiroPaciente?.pacienteTelefone}
                onClick={enviarWhatsapp}
              >
                <i className="bi bi-whatsapp me-2" />
                Enviar por WhatsApp
              </Button>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          {cobrancaGerada ? 'Fechar' : 'Cancelar'}
        </Button>
        {!cobrancaGerada && (
          <Button
            id="botao-gerar-cobranca-online"
            variant="primary"
            disabled={enviando || consultas.length === 0}
            onClick={gerar}
          >
            {enviando ? 'Gerando...' : 'Gerar link de cobrança'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
