'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import LayoutPsicologa from '@/components/area-restrita/LayoutPsicologa';
import { GATEWAYS, GATEWAY_LABEL, type ConfiguracaoDto, type Gateway } from '@/types/pagamento';
import { useNotificacao } from '@/components/NotificacaoProvider';

export default function ConfiguracaoPage() {
  const { mostrarNotificacao } = useNotificacao();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const [valorPadraoSessao, setValorPadraoSessao] = useState('0');
  const [duracaoSessaoMin, setDuracaoSessaoMin] = useState('50');
  const [antecedenciaCancelamentoHoras, setAntecedenciaCancelamentoHoras] = useState('24');
  const [gatewayPadrao, setGatewayPadrao] = useState<Gateway>('mercadopago');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch('/api/configuracao');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar a configuração.');
        return;
      }
      const config = dados as ConfiguracaoDto;
      setValorPadraoSessao(config.valorPadraoSessao.toFixed(2));
      setDuracaoSessaoMin(String(config.duracaoSessaoMin));
      setAntecedenciaCancelamentoHoras(String(config.antecedenciaCancelamentoHoras));
      setGatewayPadrao(config.gatewayPadrao);
    } catch {
      setErro('Não foi possível carregar a configuração.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setCampos({});
    try {
      const response = await fetch('/api/configuracao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorPadraoSessao: Number(valorPadraoSessao),
          duracaoSessaoMin: Number(duracaoSessaoMin),
          antecedenciaCancelamentoHoras: Number(antecedenciaCancelamentoHoras),
          gatewayPadrao,
        }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível salvar a configuração.');
        setCampos(dados?.campos ?? {});
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Configuração salva' });
      const config = dados as ConfiguracaoDto;
      setValorPadraoSessao(config.valorPadraoSessao.toFixed(2));
      setDuracaoSessaoMin(String(config.duracaoSessaoMin));
      setAntecedenciaCancelamentoHoras(String(config.antecedenciaCancelamentoHoras));
      setGatewayPadrao(config.gatewayPadrao);
    } catch {
      setErro('Não foi possível salvar a configuração.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutPsicologa>
      <div className="mb-4">
        <span className="pmc-rotulo">Área da psicóloga</span>
        <h1 className="h3 mb-0 mt-1">Configuração</h1>
      </div>

      {carregando ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
        </div>
      ) : (
        <Card>
          <Card.Body>
            {erro && <Alert variant="danger">{erro}</Alert>}

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="configValorPadraoSessao">
                  <Form.Label>Valor padrão da sessão (R$)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorPadraoSessao}
                    onChange={(e) => setValorPadraoSessao(e.target.value)}
                    isInvalid={!!campos.valorPadraoSessao}
                  />
                  {campos.valorPadraoSessao && (
                    <Form.Control.Feedback type="invalid">{campos.valorPadraoSessao}</Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="configDuracaoSessaoMin">
                  <Form.Label>Duração da sessão (min)</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    min="1"
                    value={duracaoSessaoMin}
                    onChange={(e) => setDuracaoSessaoMin(e.target.value)}
                    isInvalid={!!campos.duracaoSessaoMin}
                  />
                  {campos.duracaoSessaoMin && (
                    <Form.Control.Feedback type="invalid">{campos.duracaoSessaoMin}</Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="configAntecedenciaCancelamento">
                  <Form.Label>Antecedência de cancelamento (h)</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    min="0"
                    value={antecedenciaCancelamentoHoras}
                    onChange={(e) => setAntecedenciaCancelamentoHoras(e.target.value)}
                    isInvalid={!!campos.antecedenciaCancelamentoHoras}
                  />
                  {campos.antecedenciaCancelamentoHoras && (
                    <Form.Control.Feedback type="invalid">{campos.antecedenciaCancelamentoHoras}</Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="configGatewayPadrao">
                  <Form.Label>Gateway padrão</Form.Label>
                  <Form.Select
                    value={gatewayPadrao}
                    onChange={(e) => setGatewayPadrao(e.target.value as Gateway)}
                    isInvalid={!!campos.gatewayPadrao}
                  >
                    {GATEWAYS.map((g) => (
                      <option key={g} value={g}>
                        {GATEWAY_LABEL[g]}
                      </option>
                    ))}
                  </Form.Select>
                  {campos.gatewayPadrao && (
                    <Form.Control.Feedback type="invalid">{campos.gatewayPadrao}</Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <div className="d-grid">
              <Button id="botao-salvar-configuracao" variant="primary" disabled={salvando} onClick={salvar}>
                {salvando ? 'Salvando...' : 'Salvar configuração'}
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </LayoutPsicologa>
  );
}
