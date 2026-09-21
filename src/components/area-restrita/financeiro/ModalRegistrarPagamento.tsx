'use client';

import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import { METODOS_MANUAIS, METODO_LABEL, type MetodoManual, type PagamentoDto } from '@/types/pagamento';
import { formatarData, formatarHora, hojeLocalISO } from '@/components/area-restrita/agenda/formatos';
import { formatarMoeda } from './formatos';
import { useNotificacao } from '@/components/NotificacaoProvider';

export type ConsultaParaCobranca = { id: string; inicio: string; pacienteNome: string; valor: number };

type ModalRegistrarPagamentoProps = {
  consultas: ConsultaParaCobranca[];
  show: boolean;
  onHide: () => void;
  onRegistrado: (pagamento: PagamentoDto) => void;
};

export default function ModalRegistrarPagamento({
  consultas,
  show,
  onHide,
  onRegistrado,
}: ModalRegistrarPagamentoProps) {
  const { mostrarNotificacao } = useNotificacao();
  const somaValores = consultas.reduce((soma, c) => soma + c.valor, 0);

  const [metodo, setMetodo] = useState<MetodoManual>('pix');
  const [valor, setValor] = useState('0');
  const [recebidoEm, setRecebidoEm] = useState(hojeLocalISO());
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCodigo, setErroCodigo] = useState<string | undefined>(undefined);
  const [campos, setCampos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!show) return;
    setMetodo('pix');
    setValor(somaValores.toFixed(2));
    setRecebidoEm(hojeLocalISO());
    setObservacao('');
    setErro(null);
    setErroCodigo(undefined);
    setCampos({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    setErroCodigo(undefined);
    setCampos({});
    try {
      const response = await fetch('/api/pagamentos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultaIds: consultas.map((c) => c.id),
          metodo,
          valor: Number(valor),
          recebidoEm,
          observacao: observacao.trim() || undefined,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível registrar o pagamento.');
        setErroCodigo(dados?.codigo);
        setCampos(dados?.campos ?? {});
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Pagamento registrado' });
      onRegistrado(dados as PagamentoDto);
    } catch {
      setErro('Não foi possível registrar o pagamento.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered id="modal-registrar-pagamento">
      <Modal.Header closeButton>
        <Modal.Title>Registrar pagamento</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <Alert variant="danger">
            {erro}
            {erroCodigo === 'JA_PAGA' && (
              <div className="mt-1">Alguma consulta já foi paga. Atualize a lista.</div>
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

        <Form.Group className="mb-3" controlId="pagamentoMetodo">
          <Form.Label>Método</Form.Label>
          <Form.Select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoManual)}
            isInvalid={!!campos.metodo}
          >
            {METODOS_MANUAIS.map((m) => (
              <option key={m} value={m}>
                {METODO_LABEL[m]}
              </option>
            ))}
          </Form.Select>
          {campos.metodo && <Form.Control.Feedback type="invalid">{campos.metodo}</Form.Control.Feedback>}
        </Form.Group>

        <Form.Group className="mb-1" controlId="pagamentoValor">
          <Form.Label>Valor</Form.Label>
          <Form.Control
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            isInvalid={!!campos.valor}
          />
          {campos.valor && <Form.Control.Feedback type="invalid">{campos.valor}</Form.Control.Feedback>}
        </Form.Group>
        <p className="pmc-texto-2 small mb-3">Altere para registrar desconto ou valor de pacote.</p>

        <Form.Group className="mb-3" controlId="pagamentoRecebidoEm">
          <Form.Label>Data do recebimento</Form.Label>
          <Form.Control
            type="date"
            value={recebidoEm}
            max={hojeLocalISO()}
            onChange={(e) => setRecebidoEm(e.target.value)}
            isInvalid={!!campos.recebidoEm}
          />
          {campos.recebidoEm && <Form.Control.Feedback type="invalid">{campos.recebidoEm}</Form.Control.Feedback>}
        </Form.Group>

        <Form.Group className="mb-2" controlId="pagamentoObservacao">
          <Form.Label>Observação (opcional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={500}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          id="botao-confirmar-pagamento"
          variant="primary"
          disabled={enviando || consultas.length === 0}
          onClick={confirmar}
        >
          {enviando ? 'Registrando...' : 'Confirmar pagamento'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
