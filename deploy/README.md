# Deploy na VPS com PM2 e PostgreSQL da máquina

O deploy usa a branch `master`, a pasta `/opt/psi/app`, o processo PM2
`psi-maria-cristina`, Node 24, Nginx e o PostgreSQL instalado na VPS. O banco
se chama `psi_maria_cristina`, usa o usuário existente `admin` e a porta local `5432`.

O clone em `/root/projetos/psi-maria-cristina` é uma cópia separada, atualmente
na branch `main`; o workflow não faz deploy a partir dela.

## Comandos na VPS

Criação do banco (uma vez, se ainda não existir):

```bash
sudo -u postgres createdb -O admin psi_maria_cristina
```

Configure `DATABASE_URL` em `/opt/psi/.env` com o usuário `admin`, a senha
existente codificada para URL e o banco `psi_maria_cristina`. Não registre a
senha no Git. O arquivo `/opt/psi/app/.env` é um link para esse arquivo privado.

Deploy manual para testar ou recuperar:

```bash
cd /opt/psi/app
git pull --ff-only origin master
bash deploy/release-pm2.sh
pm2 status
curl -I http://127.0.0.1:3010/
```

O script carrega as variáveis privadas de `/opt/psi/.env`, instala as
dependências, compila, aplica migrations e recarrega apenas o processo PM2
deste projeto. Para entrar no banco, use:

```bash
psql -h 127.0.0.1 -U admin -d psi_maria_cristina
```

## CI/CD

O GitHub Actions executa lint, TypeScript e build a cada push em `master`.
Depois das verificações, sincroniza o código em `/opt/psi/app` e executa
`bash deploy/release-pm2.sh` por SSH. O job de deploy exige os secrets
`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` e as variáveis de repositório
`DEPLOY_HOST=147.93.9.44`, `DEPLOY_USER=root`, `DEPLOY_PORT=22` e
`DEPLOY_ENABLED=true`. O ambiente GitHub chama-se `production`.

## Domínio e dados de pacientes

O domínio já tem HTTPS, mas exibe uma página temporária. O checklist
`SEGURANCA-PRE-PRODUCAO.md` ainda registra riscos críticos e altos. Não
receba dados reais de pacientes até resolvê-los. Para liberar a aplicação
depois da revisão:

```bash
cp /opt/psi/app/deploy/nginx-cristinapsi.online.conf /etc/nginx/sites-available/cristinapsi.online
nginx -t && systemctl reload nginx
```

Antes disso, configure backups criptografados fora da VPS do banco e de
`/opt/psi/documentos`, e teste a restauração. O certificado HTTPS tem
renovação automática; adicione um e-mail de contato com
`certbot update_account --email SEU_EMAIL`.
