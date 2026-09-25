# Deploy com PM2 na VPS

**Estado atual:** o domínio `cristinapsi.online` tem HTTPS e exibe uma página
temporária. A VPS usa Nginx e PM2 para outros projetos. Este projeto fica em
`/opt/psi/app`, usa a porta local `3010` e tem PostgreSQL isolado em Docker na
porta local `5436`. O clone em `/root/projetos/psi-maria-cristina` não é usado
pelo deploy; atualmente está em `main` com mudanças locais.

## Fazer um deploy manual na VPS

```bash
cd /opt/psi/app
git pull --ff-only origin master
bash deploy/release-pm2.sh
pm2 status
curl -I http://127.0.0.1:3010/
```

O script carrega `/opt/psi/.env`, instala dependências, gera o Prisma Client,
compila, aplica as migrations e inicia/recarrega **somente** o processo PM2
`psi-maria-cristina`. O banco preserva seus dados em um volume Docker. O
arquivo `/opt/psi/.env` não fica no Git.

## Ligar o CI/CD da branch master

O job de CI já passa a cada push em `master`. Para permitir o job de deploy,
configure no repositório GitHub, em **Settings → Secrets and variables → Actions**:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | Conteúdo da chave privada SSH de deploy |
| Secret | `DEPLOY_KNOWN_HOSTS` | Linha abaixo |
| Variável | `DEPLOY_HOST` | `147.93.9.44` |
| Variável | `DEPLOY_USER` | `root` |
| Variável | `DEPLOY_PORT` | `22` |
| Variável | `DEPLOY_ENABLED` | `true` somente quando a publicação estiver permitida |

```text
147.93.9.44 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB929SXAp7ZxRGzp0X+Ql94Gml85tabk047WNG+4TgVH
```

Fingerprint verificado: `SHA256:hIkzDWHQcdmojguwNWtIDOu57INf3kzob3Vt30pNQG8`.
Crie também o ambiente GitHub `production` em **Settings → Environments**.
O workflow sincroniza `master` em `/opt/psi/app` e executa
`bash deploy/release-pm2.sh`. Não use `git push` de `main` para testar esse
workflow.

## Acesso público e segurança

`SEGURANCA-PRE-PRODUCAO.md` registra pendências críticas e altas. Não receba
dados reais de pacientes enquanto elas estiverem abertas. Para uma prévia
restrita, use `deploy/nginx-preview.conf` com uma senha em
`/etc/nginx/psi-preview.htpasswd`. Depois da revisão, troque pelo arquivo
`deploy/nginx-cristinapsi.online.conf` e recarregue o Nginx:

```bash
cp /opt/psi/app/deploy/nginx-cristinapsi.online.conf /etc/nginx/sites-available/cristinapsi.online
nginx -t && systemctl reload nginx
```

O certificado HTTPS foi emitido em 2026-09-25 e a renovação simulada passou.
Adicione um e-mail de contato com `certbot update_account --email SEU_EMAIL`.

## Backups

Antes de receber pacientes, agende backups criptografados fora da VPS do
PostgreSQL e de `/opt/psi/documentos`, e teste a restauração. Um dump manual:

```bash
cd /opt/psi/app
docker compose --env-file /opt/psi/.env -f deploy/compose.yml exec -T db \
  pg_dump -U psi -d psi_maria_cristina -Fc > /opt/psi/backup-$(date +%F).dump
```

Esse dump fica somente na VPS até que seja transferido ao destino de backup.
