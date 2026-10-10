// Pré-carregado pelo PM2 (node -r) a cada start/restart do app: lê o .env de produção e
// SOBRESCREVE o ambiente herdado. Sem isto, `pm2 restart` reaproveitava os valores guardados no
// último deploy e uma edição no .env só valia após rodar o script de release de novo.
// Leitura literal, sem expansão de `$` (hashes e tokens podem conter `$`), com as mesmas regras do
// deploy/release-pm2.sh. Nunca loga valores. Limitação: só define/sobrescreve — REMOVER uma
// variável do .env exige o release script (ver deploy/README.md).
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS puro, carregado por `node -r` */
const fs = require('fs');

const ARQUIVO = '/root/projetos/psi-maria-cristina/.env';
const OBRIGATORIAS = ['DATABASE_URL', 'JWT_SECRET'];

let conteudo;
try {
  conteudo = fs.readFileSync(ARQUIVO, 'utf8');
} catch {
  // Falha fechado: subir com o ambiente antigo esconderia o problema.
  console.error('[carregar-env] não foi possível ler o .env de produção; o app não vai iniciar');
  process.exit(1);
}

// Remove BOM (editores no Windows) para a primeira variável não ser descartada.
for (const bruta of conteudo.replace(/^﻿/, '').split('\n')) {
  const linha = bruta.replace(/\r$/, '');
  if (!linha || linha.startsWith('#')) continue;
  const igual = linha.indexOf('=');
  if (igual < 1) continue;
  const chave = linha.slice(0, igual);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(chave)) continue;
  let valor = linha.slice(igual + 1);
  if (valor.length >= 2) {
    const primeiro = valor[0];
    const ultimo = valor[valor.length - 1];
    if ((primeiro === '"' && ultimo === '"') || (primeiro === "'" && ultimo === "'")) {
      valor = valor.slice(1, -1);
    }
  }
  process.env[chave] = valor;
}

const faltando = OBRIGATORIAS.filter((nome) => !process.env[nome]);
if (faltando.length > 0) {
  console.error(`[carregar-env] variáveis obrigatórias ausentes no .env: ${faltando.join(', ')}`);
  process.exit(1);
}

process.env.NODE_ENV = 'production';
