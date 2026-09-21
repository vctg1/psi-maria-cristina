'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { useNotificacao } from '@/components/NotificacaoProvider';
import { formatarTamanho } from './formatos';
import {
  DOCUMENTO_MIME_PERMITIDOS,
  DOCUMENTO_TITULO_MAX,
  type DocumentoDto,
} from '@/types/documento';

const TAMANHO_MAX_BYTES = 15 * 1024 * 1024;

type PainelDocumentosProps = {
  pacienteId: string;
};

function nomeSemExtensao(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 ? nome.slice(0, ponto) : nome;
}

function iconePorMime(mimeType: string): string {
  return mimeType === 'application/pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image';
}

export default function PainelDocumentos({ pacienteId }: PainelDocumentosProps) {
  const { mostrarNotificacao } = useNotificacao();

  const [documentos, setDocumentos] = useState<DocumentoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [visivelParaPaciente, setVisivelParaPaciente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<DocumentoDto | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/pacientes/${pacienteId}/documentos`);
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar os documentos.');
        return;
      }
      setDocumentos((dados?.documentos ?? []) as DocumentoDto[]);
    } catch {
      setErro('Não foi possível carregar os documentos.');
    } finally {
      setCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const validarArquivo = (file: File): string | null => {
    if (!DOCUMENTO_MIME_PERMITIDOS.includes(file.type as (typeof DOCUMENTO_MIME_PERMITIDOS)[number])) {
      return 'Tipo de arquivo não permitido. Envie PDF, PNG ou JPG.';
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return 'Arquivo maior que o limite de 15 MB.';
    }
    return null;
  };

  const escolherArquivo = (file: File) => {
    const mensagem = validarArquivo(file);
    if (mensagem) {
      setErroUpload(mensagem);
      setArquivo(null);
      return;
    }
    setErroUpload(null);
    setArquivo(file);
    if (!titulo.trim()) {
      setTitulo(nomeSemExtensao(file.name).slice(0, DOCUMENTO_TITULO_MAX));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) escolherArquivo(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) escolherArquivo(file);
  };

  const limparFormulario = () => {
    setArquivo(null);
    setTitulo('');
    setVisivelParaPaciente(false);
    setErroUpload(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const enviar = async () => {
    if (!arquivo || !titulo.trim()) return;
    setEnviando(true);
    setErroUpload(null);
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('titulo', titulo.trim());
      formData.append('pacienteId', pacienteId);
      formData.append('visivelParaPaciente', String(visivelParaPaciente));

      const response = await fetch('/api/documentos', {
        method: 'POST',
        body: formData,
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErroUpload(dados?.error ?? 'Não foi possível enviar o documento.');
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Documento enviado' });
      limparFormulario();
      carregar();
    } catch {
      setErroUpload('Não foi possível enviar o documento.');
    } finally {
      setEnviando(false);
    }
  };

  const alternarVisibilidade = async (documento: DocumentoDto) => {
    const novoValor = !documento.visivelParaPaciente;
    setDocumentos((prev) =>
      prev.map((doc) => (doc.id === documento.id ? { ...doc, visivelParaPaciente: novoValor } : doc))
    );
    try {
      const response = await fetch(`/api/documentos/${documento.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visivelParaPaciente: novoValor }),
      });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setDocumentos((prev) =>
          prev.map((doc) => (doc.id === documento.id ? { ...doc, visivelParaPaciente: documento.visivelParaPaciente } : doc))
        );
        mostrarNotificacao({ tipo: 'erro', titulo: dados?.error ?? 'Não foi possível atualizar a visibilidade.' });
      }
    } catch {
      setDocumentos((prev) =>
        prev.map((doc) => (doc.id === documento.id ? { ...doc, visivelParaPaciente: documento.visivelParaPaciente } : doc))
      );
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível atualizar a visibilidade.' });
    }
  };

  const excluir = async () => {
    if (!confirmandoExclusao) return;
    const documento = confirmandoExclusao;
    setExcluindoId(documento.id);
    try {
      const response = await fetch(`/api/documentos/${documento.id}`, { method: 'DELETE' });
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        mostrarNotificacao({ tipo: 'erro', titulo: dados?.error ?? 'Não foi possível excluir o documento.' });
        return;
      }
      mostrarNotificacao({ tipo: 'sucesso', titulo: 'Documento excluído' });
      setConfirmandoExclusao(null);
      carregar();
    } catch {
      mostrarNotificacao({ tipo: 'erro', titulo: 'Não foi possível excluir o documento.' });
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Body>
        <span className="pmc-rotulo d-block mb-3">Documentos clínicos</span>

        {erroUpload && <Alert variant="danger">{erroUpload}</Alert>}

        <div
          className={`pmc-dropzone mb-3${arrastando ? ' pmc-dropzone--ativa' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
        >
          <i className="bi bi-cloud-arrow-up pmc-dropzone__icone" />
          {arquivo ? (
            <p className="mb-0">
              <strong>{arquivo.name}</strong> · {formatarTamanho(arquivo.size)}
            </p>
          ) : (
            <p className="mb-0 pmc-texto-2">Arraste um arquivo aqui ou clique para escolher (PDF, PNG ou JPG, até 15 MB)</p>
          )}
          <Form.Control
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={handleInputChange}
            className="d-none"
          />
        </div>

        <Row className="align-items-end g-2 mb-3">
          <Col md={6}>
            <Form.Group controlId="documentoTitulo">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                value={titulo}
                maxLength={DOCUMENTO_TITULO_MAX}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Check
              type="checkbox"
              id="documentoVisivel"
              label="Visível ao paciente"
              checked={visivelParaPaciente}
              onChange={(e) => setVisivelParaPaciente(e.target.checked)}
            />
          </Col>
          <Col md={3}>
            <Button
              variant="primary"
              className="w-100"
              disabled={!arquivo || !titulo.trim() || enviando}
              onClick={enviar}
            >
              {enviando ? 'Enviando...' : 'Enviar'}
            </Button>
          </Col>
        </Row>

        {carregando ? (
          <div className="text-center py-4">
            <Spinner animation="border" role="status" />
          </div>
        ) : erro ? (
          <Alert variant="danger">{erro}</Alert>
        ) : documentos.length === 0 ? (
          <p className="pmc-texto-2 mb-0">Nenhum documento enviado para este paciente.</p>
        ) : (
          <Table responsive className="pmc-tabela">
            <thead>
              <tr>
                <th>Título</th>
                <th>Arquivo</th>
                <th>Enviado em</th>
                <th>Visível ao paciente</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((documento) => (
                <tr key={documento.id}>
                  <td>
                    <i className={`bi ${iconePorMime(documento.mimeType)} me-2`} />
                    {documento.titulo}
                  </td>
                  <td>
                    {documento.nomeOriginal} · {formatarTamanho(documento.tamanhoBytes)}
                  </td>
                  <td>{new Date(documento.criadoEm).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <Form.Check
                      type="switch"
                      id={`documento-visivel-${documento.id}`}
                      checked={documento.visivelParaPaciente}
                      onChange={() => alternarVisibilidade(documento)}
                    />
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <a
                        className="btn btn-outline-primary btn-sm"
                        href={`/api/documentos/${documento.id}/download`}
                        download
                      >
                        <i className="bi bi-download" />
                      </a>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        disabled={excluindoId === documento.id}
                        onClick={() => setConfirmandoExclusao(documento)}
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <Modal show={confirmandoExclusao !== null} onHide={() => setConfirmandoExclusao(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Excluir documento?</Modal.Title>
        </Modal.Header>
        <Modal.Body>Esta ação apaga o arquivo definitivamente.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmandoExclusao(null)}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={excluindoId !== null} onClick={excluir}>
            {excluindoId !== null ? 'Excluindo...' : 'Excluir'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
