# Deploy na VPS com PM2 e PostgreSQL da máquina

O deploy usa a branch `master`, releases em `/root/projetos/psi-maria-cristina/.deploy/releases/<commit>` e o processo PM2
`psi-maria-cristina`, Node 24, Nginx e o PostgreSQL instalado na VPS. O banco
se chama `psi_maria_cristina`, usa o usuário existente `admin` e a porta local `5432`.

O clone em `/root/projetos/psi-maria-cristina` permanece intacto. O workflow
sincroniza cada push em `master` apenas para a subpasta `.deploy/releases`.

## Comandos na VPS

Criação do banco (uma vez, se ainda não existir):

```bash
sudo -u postgres createdb -O admin psi_maria_cristina
```

Configure `DATABASE_URL` em `/root/projetos/psi-maria-cristina/.env` com o usuário `admin`, a senha
existente codificada para URL e o banco `psi_maria_cristina`. Não registre a
senha no Git. Configure `DOCUMENTOS_DIR` com o caminho absoluto
`/root/projetos/psi-maria-cristina/documentos-privados`. Cada release tem `.env`
como link para esse arquivo privado.

Para conferir ou reiniciar a versão ativa:

```bash
export PATH="/root/.nvm/versions/node/v24.18.1/bin:$PATH"
pm2 status
pm2 restart psi-maria-cristina
curl -I http://127.0.0.1:3010/
```

O script carrega as variáveis privadas do `.env` na raiz do projeto, instala as
dependências, compila, aplica migrations e reinicia apenas o processo PM2
deste projeto. O build acontece na nova release antes da troca, preservando os
arquivos CSS/JS servidos pela versão anterior durante a compilação. Para entrar no banco, use:

```bash
psql -h 127.0.0.1 -U admin -d psi_maria_cristina
```

## CI/CD

O GitHub Actions executa lint, TypeScript e build a cada push em `master`.
Depois das verificações, sincroniza o código em `/root/projetos/psi-maria-cristina/.deploy/releases/<commit>` e executa
`bash deploy/release-pm2.sh` por SSH. O job de deploy exige os secrets
`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` e as variáveis de repositório
`DEPLOY_HOST=147.93.9.44`, `DEPLOY_USER=root`, `DEPLOY_PORT=22` e
`DEPLOY_ENABLED=true`. O ambiente GitHub chama-se `production`.

## Domínio e dados de pacientes

O domínio já tem HTTPS e aponta para o PM2. Para atualizar manualmente a
configuração do Nginx:

```bash
cp /root/projetos/psi-maria-cristina/.deploy/current/deploy/nginx-cristinapsi.online.conf /etc/nginx/sites-available/cristinapsi.online
nginx -t && systemctl reload nginx
```

Configure backups criptografados fora da VPS do banco e de
`/root/projetos/psi-maria-cristina/documentos-privados`, e teste a restauração.
O certificado HTTPS tem
renovação automática; adicione um e-mail de contato com
`certbot update_account --email SEU_EMAIL`.
