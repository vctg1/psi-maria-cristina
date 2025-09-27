import { useState, useEffect } from 'react';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface CheckoutTransparenteProps {
  consulta: any;
  paciente: any;
  onPagamentoSucesso: () => void;
  onFechar: () => void;
}

export default function CheckoutTransparente({
  consulta,
  paciente,
  onPagamentoSucesso,
  onFechar
}: CheckoutTransparenteProps) {
  const [metodoPagamento, setMetodoPagamento] = useState<'cartao' | 'pix'>('pix');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [erroMensagem, setErroMensagem] = useState('');
  const [qrCodePix, setQrCodePix] = useState('');
  const [pixCopiaECola, setPixCopiaECola] = useState('');
  const [paymentIdPix, setPaymentIdPix] = useState('');
  
  // Estados para cartão de crédito
  const [dadosCartao, setDadosCartao] = useState({
    numero: '',
    titular: '',
    vencimento: '',
    cvv: '',
    parcelas: 1
  });

  const [dadosPagador, setDadosPagador] = useState({
    nome: paciente.nome || '',
    email: paciente.email || '',
    documento: paciente.cpf?.replace(/\D/g, '') || '',
    tipoDocumento: 'CPF'
  });

  // Inicializar MercadoPago SDK
  useEffect(() => {
    const loadMercadoPagoSDK = () => {
      // Remover script existente se houver
      const existingScript = document.querySelector('script[src*="mercadopago"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      
      script.onload = () => {
        try {
          if (window.MercadoPago) {
            window.MercadoPago = new window.MercadoPago('TEST-635a37a4-8161-467b-9c67-43c36197cf73');
            console.log('MercadoPago SDK carregado com sucesso');
          } else {
            console.error('MercadoPago SDK não encontrado após carregamento');
          }
        } catch (error) {
          console.error('Erro ao inicializar MercadoPago:', error);
        }
      };
      
      script.onerror = () => {
        console.error('Falha ao carregar o SDK do MercadoPago');
      };
      
      document.head.appendChild(script);
    };

    if (typeof window !== 'undefined') {
      if (!window.MercadoPago) {
        loadMercadoPagoSDK();
      } else {
        console.log('MercadoPago SDK já carregado');
      }
    }
  }, []);

  const gerarPixQRCode = async () => {
    setProcessandoPagamento(true);
    setErroMensagem('');

    try {
      const response = await fetch(`/api/pagamento-checkout?consultaId=${consulta.id}&email=${paciente.email}&nome=${paciente.nome}`);
      const data = await response.json();

      if (data.success) {
        setQrCodePix(data.qrCodeBase64);
        setPixCopiaECola(data.pixCopiaECola);
        setPaymentIdPix(data.paymentId);
        
        // Verificar status do pagamento a cada 3 segundos
        const interval = setInterval(async () => {
          try {
            const statusResponse = await fetch('/api/pagamento-checkout', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentId: data.paymentId,
                consultaId: consulta.id
              })
            });
            
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'approved') {
              clearInterval(interval);
              setProcessandoPagamento(false);
              onPagamentoSucesso();
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
          }
        }, 3000);

        // Limpar intervalo após 10 minutos
        setTimeout(() => clearInterval(interval), 600000);
      } else {
        setErroMensagem('Erro ao gerar PIX QR Code');
      }
    } catch (error) {
      setErroMensagem('Erro ao processar pagamento PIX');
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const detectarTipoCartao = (numero: string) => {
    const numeroLimpo = numero.replace(/\s/g, '');
    if (numeroLimpo.startsWith('4')) return 'visa';
    if (numeroLimpo.startsWith('5') || numeroLimpo.startsWith('2')) return 'master';
    if (numeroLimpo.startsWith('3')) return 'amex';
    if (numeroLimpo.startsWith('6')) return 'elo';
    return 'visa'; // default
  };

  const processarPagamentoCartao = async () => {
    setProcessandoPagamento(true);
    setErroMensagem('');

    try {
      // Verificar se MercadoPago está carregado
      if (!window.MercadoPago) {
        setErroMensagem('SDK do MercadoPago não carregado. Recarregue a página e tente novamente.');
        setProcessandoPagamento(false);
        return;
      }

      // Validar dados do cartão
      const numeroLimpo = dadosCartao.numero.replace(/\s/g, '');
      const vencimentoParts = dadosCartao.vencimento.split('/');
      
      if (numeroLimpo.length < 13 || numeroLimpo.length > 19) {
        setErroMensagem('Número do cartão inválido');
        setProcessandoPagamento(false);
        return;
      }

      if (vencimentoParts.length !== 2 || vencimentoParts[0].length !== 2 || vencimentoParts[1].length !== 2) {
        setErroMensagem('Data de vencimento inválida');
        setProcessandoPagamento(false);
        return;
      }

      // Detectar tipo de cartão
      const tipoCartao = detectarTipoCartao(numeroLimpo);

      console.log('MercadoPago object:', window.MercadoPago);
      console.log('Métodos disponíveis:', Object.getOwnPropertyNames(window.MercadoPago));

      // Verificar se a função createCardToken existe (v2 API)
      if (window.MercadoPago.createCardToken) {
        console.log('Usando createCardToken (v2)');
        
        const cardForm = {
          cardNumber: numeroLimpo,
          cardholderName: dadosCartao.titular,
          cardExpirationMonth: vencimentoParts[0],
          cardExpirationYear: `20${vencimentoParts[1]}`,
          securityCode: dadosCartao.cvv,
          identificationType: 'CPF',
          identificationNumber: dadosPagador.documento
        };

        console.log('Dados do cartão:', cardForm);

        const token = await window.MercadoPago.createCardToken(cardForm);
        console.log('Token criado:', token);

        await processarPagamento(token.id, tipoCartao);

      } else if (window.MercadoPago.fields) {
        // Usar Fields API (método mais moderno)
        console.log('Usando Fields API');
        setErroMensagem('Implementação com Fields API em desenvolvimento. Use PIX por enquanto.');
        setProcessandoPagamento(false);
        return;

      } else {
        // Tentar método legacy createToken
        console.log('Tentando createToken (legacy)');
        
        const tokenData = {
          cardNumber: numeroLimpo,
          cardholderName: dadosCartao.titular,
          cardExpirationMonth: vencimentoParts[0],
          cardExpirationYear: `20${vencimentoParts[1]}`,
          securityCode: dadosCartao.cvv,
          identificationType: 'CPF',
          identificationNumber: dadosPagador.documento
        };

        window.MercadoPago.createToken(tokenData, async (err: any, token: any) => {
          if (err) {
            console.error('Erro no createToken:', err);
            setErroMensagem('Erro ao validar dados do cartão. Verifique as informações.');
            setProcessandoPagamento(false);
            return;
          }

          console.log('Token criado (legacy):', token);
          await processarPagamento(token.id, tipoCartao);
        });
      }

    } catch (error: any) {
      console.error('Erro ao processar cartão:', error);
      
      let mensagem = 'Erro ao processar cartão de crédito';
      if (error.message && error.message.includes('createCardToken')) {
        mensagem = 'Erro na validação do cartão. Verifique os dados informados.';
      } else if (error.message) {
        mensagem = error.message;
      }
      
      setErroMensagem(mensagem);
      setProcessandoPagamento(false);
    }
  };

  const processarPagamento = async (tokenId: string, tipoCartao: string) => {
    try {
      console.log('Processando pagamento com token:', tokenId);

      const response = await fetch('/api/pagamento-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultaId: consulta.id,
          metodoPagamento: tipoCartao,
          dadosCartao: {
            token: tokenId,
            parcelas: dadosCartao.parcelas,
            issuerId: null
          },
          dadosPagador,
          valor: 150.00
        })
      });

      const data = await response.json();
      console.log('Resposta do pagamento:', data);

      if (data.success) {
        if (data.status === 'approved') {
          onPagamentoSucesso();
        } else if (data.status === 'pending') {
          setErroMensagem('Pagamento pendente de aprovação. Você será notificado quando for processado.');
        } else if (data.status === 'rejected') {
          let mensagemRejeicao = 'Pagamento rejeitado';
          if (data.statusDetail) {
            const detail = data.statusDetail;
            if (detail.includes('insufficient_amount')) mensagemRejeicao = 'Saldo insuficiente no cartão';
            else if (detail.includes('cc_rejected_invalid_installments')) mensagemRejeicao = 'Número de parcelas inválido';
            else if (detail.includes('cc_rejected_bad_filled_card_number')) mensagemRejeicao = 'Número do cartão incorreto';
            else if (detail.includes('cc_rejected_bad_filled_date')) mensagemRejeicao = 'Data de vencimento incorreta';
            else if (detail.includes('cc_rejected_bad_filled_security_code')) mensagemRejeicao = 'CVV incorreto';
            else if (detail.includes('cc_rejected_call_for_authorize')) mensagemRejeicao = 'Autorize o pagamento com seu banco';
          }
          setErroMensagem(mensagemRejeicao);
        } else {
          setErroMensagem(`Status: ${data.status}. ${data.statusDetail || 'Erro desconhecido'}`);
        }
      } else {
        setErroMensagem(data.error || 'Erro ao processar pagamento');
      }
    } catch (error) {
      console.error('Erro na requisição de pagamento:', error);
      setErroMensagem('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setProcessandoPagamento(false);
    }
  };



  const copiarPixCodigo = () => {
    navigator.clipboard.writeText(pixCopiaECola);
    alert('Código PIX copiado para a área de transferência!');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90%',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Pagamento da Consulta</h2>
          <button onClick={onFechar} style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer' 
          }}>×</button>
        </div>

        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Detalhes da Consulta</h4>
          <p style={{ margin: '5px 0' }}><strong>Data:</strong> {new Date(consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
          <p style={{ margin: '5px 0' }}><strong>Horário:</strong> {consulta.hora}</p>
          <p style={{ margin: '5px 0' }}><strong>Valor:</strong> R$ 150,00</p>
        </div>

        {/* Seleção do método de pagamento */}
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Escolha a forma de pagamento:</h4>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button
              onClick={() => setMetodoPagamento('pix')}
              style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${metodoPagamento === 'pix' ? '#007bff' : '#ddd'}`,
                borderRadius: '10px',
                backgroundColor: metodoPagamento === 'pix' ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '24px' }}>📱</span>
              <span>PIX</span>
            </button>
            <button
              onClick={() => setMetodoPagamento('cartao')}
              style={{
                flex: 1,
                padding: '1rem',
                border: `2px solid ${metodoPagamento === 'cartao' ? '#007bff' : '#ddd'}`,
                borderRadius: '10px',
                backgroundColor: metodoPagamento === 'cartao' ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '24px' }}>💳</span>
              <span>Cartão</span>
            </button>
          </div>
        </div>

        {/* Formulário PIX */}
        {metodoPagamento === 'pix' && (
          <div>
            {!qrCodePix ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: '2rem', color: '#666' }}>
                  O PIX é instantâneo e você não paga taxas!
                </p>
                <button
                  onClick={gerarPixQRCode}
                  disabled={processandoPagamento}
                  style={{
                    padding: '1rem 2rem',
                    backgroundColor: processandoPagamento ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '16px',
                    cursor: processandoPagamento ? 'not-allowed' : 'pointer'
                  }}
                >
                  {processandoPagamento ? 'Gerando...' : 'Gerar QR Code PIX'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h4>Escaneie o QR Code ou copie o código:</h4>
                <div style={{ margin: '1rem 0' }}>
                  <img 
                    src={`data:image/png;base64,${qrCodePix}`}
                    alt="QR Code PIX"
                    style={{ maxWidth: '200px', border: '1px solid #ddd', borderRadius: '10px' }}
                  />
                </div>
                <div style={{ margin: '1rem 0' }}>
                  <textarea
                    value={pixCopiaECola}
                    readOnly
                    style={{
                      width: '100%',
                      height: '80px',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    onClick={copiarPixCodigo}
                    style={{
                      marginTop: '10px',
                      padding: '10px 20px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Copiar Código PIX
                  </button>
                </div>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Aguardando confirmação do pagamento...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Formulário Cartão de Crédito */}
        {metodoPagamento === 'cartao' && (
          <div>
            {/* Botões de Teste */}
            <div style={{ marginBottom: '1rem', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>🧪 Dados de Teste:</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setDadosCartao({
                    numero: '4509 9535 6623 3704',
                    titular: 'APRO',
                    vencimento: '11/25',
                    cvv: '123',
                    parcelas: 1
                  })}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Visa Aprovado
                </button>
                <button
                  type="button"
                  onClick={() => setDadosCartao({
                    numero: '5031 4332 1540 6351',
                    titular: 'APRO',
                    vencimento: '11/25',
                    cvv: '123',
                    parcelas: 1
                  })}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Master Aprovado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log('MercadoPago SDK Status:', {
                      exists: !!window.MercadoPago,
                      methods: window.MercadoPago ? Object.getOwnPropertyNames(window.MercadoPago) : 'N/A'
                    });
                    alert(`MercadoPago carregado: ${!!window.MercadoPago ? 'SIM' : 'NÃO'}`);
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Debug SDK
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Número do Cartão
              </label>
              <input
                type="text"
                value={dadosCartao.numero}
                onChange={(e) => {
                  let valor = e.target.value.replace(/\D/g, '');
                  valor = valor.replace(/(\d{4})(?=\d)/g, '$1 ');
                  setDadosCartao({...dadosCartao, numero: valor});
                }}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                Nome no Cartão
              </label>
              <input
                type="text"
                value={dadosCartao.titular}
                onChange={(e) => setDadosCartao({...dadosCartao, titular: e.target.value.toUpperCase()})}
                placeholder="NOME COMPLETO"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Vencimento
                </label>
                <input
                  type="text"
                  value={dadosCartao.vencimento}
                  onChange={(e) => {
                    let valor = e.target.value.replace(/\D/g, '');
                    if (valor.length >= 2) {
                      valor = valor.substring(0,2) + '/' + valor.substring(2,4);
                    }
                    setDadosCartao({...dadosCartao, vencimento: valor});
                  }}
                  placeholder="MM/AA"
                  maxLength={5}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  CVV
                </label>
                <input
                  type="text"
                  value={dadosCartao.cvv}
                  onChange={(e) => setDadosCartao({...dadosCartao, cvv: e.target.value.replace(/\D/g, '')})}
                  placeholder="000"
                  maxLength={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                  Parcelas
                </label>
                <select
                  value={dadosCartao.parcelas}
                  onChange={(e) => setDadosCartao({...dadosCartao, parcelas: parseInt(e.target.value)})}
                  style={{

                    
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                >
                  <option value={1}>1x R$ 150,00</option>
                  <option value={2}>2x R$ 75,00</option>
                  <option value={3}>3x R$ 50,00</option>
                  <option value={4}>4x R$ 37,50</option>
                  <option value={5}>5x R$ 30,00</option>
                  <option value={6}>6x R$ 25,00</option>
                </select>
              </div>
            </div>

            <button
              onClick={processarPagamentoCartao}
              disabled={processandoPagamento || !dadosCartao.numero || !dadosCartao.titular || !dadosCartao.vencimento || !dadosCartao.cvv}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: processandoPagamento ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: processandoPagamento ? 'not-allowed' : 'pointer',
                marginTop: '1rem'
              }}
            >
              {processandoPagamento ? 'Processando...' : `Pagar R$ 150,00`}
            </button>
          </div>
        )}

        {erroMensagem && (
          <div style={{
            marginTop: '1rem',
            padding: '10px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '5px'
          }}>
            {erroMensagem}
          </div>
        )}
      </div>
    </div>
  );
}