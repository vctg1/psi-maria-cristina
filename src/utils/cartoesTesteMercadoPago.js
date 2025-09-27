// Cartões de Teste do MercadoPago
export const cartoesTesteMercadoPago = {
  visa: {
    numero: '4509953566233704',
    cvv: '123',
    vencimento: '11/25',
    titular: 'APRO' // Aprovado
  },
  visaRejeitado: {
    numero: '4013540682746260',
    cvv: '123', 
    vencimento: '11/25',
    titular: 'OTHE' // Rejeitado
  },
  master: {
    numero: '5031433215406351',
    cvv: '123',
    vencimento: '11/25',  
    titular: 'APRO' // Aprovado
  },
  masterRejeitado: {
    numero: '5031433215406351',
    cvv: '123',
    vencimento: '11/25',
    titular: 'OTHE' // Rejeitado
  }
};

// CPF de Teste
export const cpfTeste = '12345678909';