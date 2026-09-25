# Deploy em VPS: cristinapsi.online

Este projeto usa Next.js e PostgreSQL em Docker Compose, atrás do Nginx já
instalado na VPS. O GitHub Actions
verifica cada push em `master`. O deploy só roda quando a variável
`DEPLOY_ENABLED=true` estiver configurada como variável do repositório no GitHub.

## 0. Condição para publicar

Consulte `SEGURANCA-PRE-PRODUCAO.md`. Há pendências críticas e altas abertas,
incluindo cobrança, login e dados clínicos. **Não ative `DEPLOY_ENABLED` nem
insira dados reais de pacientes enquanto esses itens não forem resolvidos.**

## 1. DNS e portas

No painel DNS da Hostinger, crie/edite o registro `A` de `@` para
`147.93.9.44`. Remova registros `AAAA` incorretos. Se quiser `www`, configure
um `CNAME` para `cristinapsi.online` e acrescente `www` ao arquivo de Nginx e
ao certificado. Preserve as portas 80, 443 e SSH. A aplicação escuta apenas em
`127.0.0.1:3010`; PostgreSQL não publica porta.

Verifique: `dig +short cristinapsi.online A` deve mostrar `147.93.9.44`.

## 2. Preparar a VPS

A VPS atual usa Ubuntu 24.04 e já tem Docker Compose e Nginx. Não remova nem
reinicie os serviços de outros projetos. Se recriar a VPS, instale o Docker
conforme a [documentação oficial para Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

Crie o diretório de deploy e o de documentos clínicos:

```sh
install -d -m 700 /opt/psi /opt/psi/documentos
chown 1000:1000 /opt/psi/documentos
install -d -m 755 /opt/psi/app
```

O usuário `node` no container tem UID 1000 e precisa gravar em
`/opt/psi/documentos`. O diretório está fora do código e não é publicado pelo
servidor web. O banco usa um volume Docker separado.

Crie `/opt/psi/.env` com `chmod 600` e valores **novos de produção**:

```dotenv
# Use apenas caracteres hexadecimais para não precisar codificar a senha na URL PostgreSQL.
POSTGRES_PASSWORD=COLE_AQUI_UM_VALOR_DE_openssl_rand_-hex_32
JWT_SECRET=COLE_AQUI_OUTRO_VALOR_DE_openssl_rand_-hex_32
NEXT_PUBLIC_MP_PUBLIC_KEY=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
DOCUMENTOS_MAX_MB=15
```

Gere cada valor com `openssl rand -hex 32`, separadamente. O arquivo fica
somente na VPS; o deploy nunca o copia ou sobrescreve. As credenciais do
MercadoPago devem ser de produção somente após a revisão das rotas de pagamento.

## 3. GitHub Actions

O branch `master` foi criado para o deploy. Se ele será o branch principal do
projeto, altere também **Settings → General → Default branch** para `master`.
Commits em `main` não acionam este workflow.

No repositório, vá a **Settings → Environments → New environment** e crie
`production`. Em **Secrets and variables → Actions**, configure as variáveis
na seção do **repositório** (o `if` do job as lê antes de entrar no ambiente).
Os secrets podem ficar no repositório ou no ambiente `production`:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | Conteúdo inteiro da chave privada exclusiva de deploy, criada localmente em `~/.ssh/psi_deploy_ed25519` |
| Secret | `DEPLOY_KNOWN_HOSTS` | Linha de `ssh-keyscan -H -p 22 147.93.9.44`, depois de comparar o fingerprint com `/etc/ssh/ssh_host_ed25519_key.pub` na VPS |
| Variável | `DEPLOY_HOST` | `147.93.9.44` |
| Variável | `DEPLOY_USER` | `root` (ou usuário de deploy configurado na VPS) |
| Variável | `DEPLOY_PORT` | `22` |
| Variável do repositório | `DEPLOY_ENABLED` | Comece sem essa variável; defina `true` somente após resolver o checklist de segurança |

A linha verificada nesta VPS para `DEPLOY_KNOWN_HOSTS` é:

```text
147.93.9.44 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIB929SXAp7ZxRGzp0X+Ql94Gml85tabk047WNG+4TgVH
```

Fingerprint: `SHA256:hIkzDWHQcdmojguwNWtIDOu57INf3kzob3Vt30pNQG8`.
Se a VPS for reinstalada ou a chave do host mudar, compare novamente antes
de atualizar o secret. Para copiar `DEPLOY_SSH_KEY`, abra o arquivo privado
`C:\Users\victo\.ssh\psi_deploy_ed25519` no seu computador e cole seu
conteúdo inteiro no campo Secret do GitHub. Não o envie em chat nem o versione.

A chave **pública** correspondente deve constar em `~/.ssh/authorized_keys` do
usuário de deploy na VPS. Nunca adicione a chave privada ao repositório.
As demais variáveis também devem ser do repositório. Os secrets do ambiente
`production` ficam disponíveis quando o job de deploy começa.

O workflow usa SSH para sincronizar o código e executar `docker compose up -d
--build`. A VPS precisa de espaço e memória para compilar Next.js. Reserve ao
menos 4 GB de RAM ou swap suficiente para o build.

## 4. Domínio e certificado

Antes da liberação do sistema, use uma página temporária. Crie o webroot para
o desafio ACME e instale somente o virtual host novo:

```sh
install -d -m 755 /var/www/psi-acme
cp /opt/psi/app/deploy/nginx-acme.conf /etc/nginx/sites-available/cristinapsi.online
ln -s /etc/nginx/sites-available/cristinapsi.online /etc/nginx/sites-enabled/cristinapsi.online
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/psi-acme -d cristinapsi.online --email SEU_EMAIL --agree-tos --non-interactive
cp /opt/psi/app/deploy/nginx-maintenance.conf /etc/nginx/sites-available/cristinapsi.online
nginx -t && systemctl reload nginx
```

O Certbot já está instalado nesta VPS. Troque `SEU_EMAIL` por um endereço seu.
O certificado foi emitido em 2026-09-25 com a conta Certbot existente, que
não tinha e-mail. Adicione um contato com `certbot update_account --email
SEU_EMAIL` para receber avisos.
O certificado exige DNS apontando para esta VPS. Instale o hook de renovação:

```sh
install -m 755 /opt/psi/app/deploy/renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/psi-reload-nginx.sh
certbot renew --dry-run --cert-name cristinapsi.online
```

A página temporária deve
responder `200` em `https://cristinapsi.online` e não expõe a aplicação.

## 5. Publicação e conta inicial

Depois de resolver o checklist de segurança, substitua a página temporária
pelo proxy da aplicação e ative o deploy automático:

```sh
cp /opt/psi/app/deploy/nginx-cristinapsi.online.conf /etc/nginx/sites-available/cristinapsi.online
nginx -t && systemctl reload nginx
```

Configure `DEPLOY_ENABLED=true` no GitHub e observe o workflow em **Actions**.
Na VPS:

```sh
cd /opt/psi/app
docker compose --env-file /opt/psi/.env -f deploy/compose.yml ps
docker compose --env-file /opt/psi/.env -f deploy/compose.yml logs --tail=100 app
curl -I https://cristinapsi.online/
```

O container aplica migrations com `prisma migrate deploy` antes de iniciar.
Para criar a conta inicial da psicóloga, gere um hash bcrypt de uma senha forte
fora da VPS (por exemplo, `node -e "require('bcrypt').hash('SENHA',12).then(console.log)"`
na máquina com as dependências instaladas), e rode o seed uma vez com
`PSICOLOGA_EMAIL` e `PSICOLOGA_SENHA_HASH` passados ao processo. Evite gravar
a senha em histórico de shell; use um terminal privado e apague os valores ao
fim. O seed atual também define horários iniciais; revise antes de executá-lo.

## 6. Backups e manutenção

Agende cópias **criptografadas fora da VPS** do banco PostgreSQL e de
`/opt/psi/documentos`, e teste a restauração antes de aceitar pacientes.
Exemplo de dump manual:

```sh
cd /opt/psi/app
docker compose --env-file /opt/psi/.env -f deploy/compose.yml exec -T db \
  pg_dump -U psi -d psi_maria_cristina -Fc > /opt/psi/backup-$(date +%F).dump
```

Esse exemplo gera somente uma cópia local temporária. Inclua também os volumes
persistentes e segredos necessários no plano de recuperação. Antes de migrations
que removem ou transformam dados, faça e verifique um backup. Para diagnosticar:

```sh
cd /opt/psi/app
docker compose --env-file /opt/psi/.env -f deploy/compose.yml logs --tail=100 --follow
```
