'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { formatarTamanho } from '@/components/area-restrita/documentos/formatos';
import type { DocumentoDtoPaciente } from '@/types/documento';

function iconePorMime(mimeType: string): string {
  return mimeType === 'application/pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image';
}

export default function MeusDocumentos() {
  const [documentos, setDocumentos] = useState<DocumentoDtoPaciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch('/api/paciente/me/documentos');
      const dados = await response.json().catch(() => null);
      if (!response.ok) {
        setErro(dados?.error ?? 'Não foi possível carregar seus documentos.');
        return;
      }
      setDocumentos((dados?.documentos ?? []) as DocumentoDtoPaciente[]);
    } catch {
      setErro('Não foi possível carregar seus documentos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <section className="mt-5">
      <h2 className="h5 mb-3">Meus documentos</h2>
      {carregando ? (
        <div className="text-center py-4">
          <Spinner animation="border" role="status" size="sm" />
        </div>
      ) : erro ? (
        <Alert variant="danger">{erro}</Alert>
      ) : documentos.length === 0 ? (
        <p className="pmc-texto-2 mb-0">Nenhum documento disponível por enquanto.</p>
      ) : (
        <div className="d-flex flex-column gap-2">
          {documentos.map((documento) => (
            <Card key={documento.id}>
              <Card.Body className="d-flex align-items-center gap-3 py-3">
                <i className={`bi ${iconePorMime(documento.mimeType)} fs-4 text-secondary`} />
                <div className="flex-grow-1">
                  <p className="pmc-peso-medio mb-0">{documento.titulo}</p>
                  <p className="pmc-texto-2 pmc-t-sm mb-0">
                    {documento.nomeOriginal} · {formatarTamanho(documento.tamanhoBytes)} ·{' '}
                    {new Date(documento.criadoEm).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <a
                  className="btn btn-outline-primary btn-sm"
                  href={`/api/documentos/${documento.id}/download`}
                  download
                >
                  Baixar
                </a>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
