# EKKLE Sales OS - Guia de Deploy

Este guia detalha o processo de deploy do EKKLE Sales OS na plataforma Railway, usando GitHub Actions para CI/CD.

## Pré-requisitos

- Conta no [GitHub](https://github.com)
- Conta no [Railway](https://railway.app)
- Conta no [Supabase](https://supabase.com)
- Conta na [Evolution API](https://www.evolution-api.com/)
- API Key do [Kimi (Moonshot AI)](https://platform.moonshot.cn/)

## Passo 1: Fork do Repositório

Faça um fork deste repositório para sua conta do GitHub.

## Passo 2: Configurar Supabase

1. Crie um novo projeto no Supabase.
2. Vá para **Project Settings** > **API**.
3. Guarde os seguintes valores:
   - **Project URL**
   - **Project API keys** > `anon` (public)
   - **Project API keys** > `service_role` (secret)

## Passo 3: Configurar Railway

1. Crie um novo projeto no Railway.
2. Conecte seu repositório GitHub forkeado.
3. Adicione os seguintes serviços:
   - **Redis**: `New` > `Database` > `Redis`
   - **API**: `New` > `GitHub Repo` > `ekkle-sales-os`
   - **Worker**: `New` > `GitHub Repo` > `ekkle-sales-os`

4. Renomeie os serviços para `ekkle-api` e `ekkle-worker`.

5. Configure as variáveis de ambiente em **ambos** os serviços (`ekkle-api` e `ekkle-worker`):

| Variável | Descrição | Valor |
|---|---|---|
| `SUPABASE_URL` | URL do seu projeto Supabase | `https://<seu-projeto>.supabase.co` |
| `SUPABASE_ANON_KEY` | Chave anônima do Supabase | `sua-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase | `sua-service-role-key` |
| `REDIS_URL` | URL do serviço Redis no Railway | `${{Redis.REDIS_URL}}` |
| `KIMI_API_KEY` | Sua API Key do Kimi | `sua-kimi-api-key` |
| `KIMI_API_BASE_URL` | URL base da API do Kimi | `https://api.moonshot.cn/v1` |
| `EVOLUTION_API_URL` | URL da sua instância Evolution API | `https://sua-evolution-api.com` |
| `EVOLUTION_API_KEY` | Chave da sua instância Evolution API | `sua-evolution-api-key` |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância na Evolution API | `ekkle-sales` |
| `NODE_ENV` | Ambiente de execução | `production` |
| `PORT` | Porta da API (apenas para `ekkle-api`) | `3000` |

## Passo 4: Configurar GitHub Actions

1. No seu repositório GitHub, vá para **Settings** > **Secrets and variables** > **Actions**.
2. Crie os seguintes segredos:

| Segredo | Descrição | Valor |
|---|---|---|
| `RAILWAY_TOKEN` | Token de API do Railway | `seu-railway-token` |
| `SUPABASE_URL` | URL do seu projeto Supabase | `https://<seu-projeto>.supabase.co` |
| `SUPABASE_ANON_KEY` | Chave anônima do Supabase | `sua-anon-key` |

## Passo 5: Executar Migrações e Seeds

1. Clone o repositório localmente.
2. Instale as dependências: `bun install`
3. Crie um arquivo `.env` com as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
4. Execute as migrações:
   ```bash
   bun run scripts/migrate.ts
   ```
5. Execute os seeds para popular com dados de teste:
   ```bash
   bun run scripts/seeds.ts
   ```

## Passo 6: Deploy

Faça um push para a branch `main` do seu repositório. O GitHub Actions irá automaticamente:

1. Rodar testes e lint.
2. Construir as imagens Docker.
3. Fazer o deploy dos serviços `ekkle-api` e `ekkle-worker` no Railway.

## Passo 7: Configurar Webhook no Evolution API

1. Após o deploy, o Railway irá fornecer uma URL pública para o serviço `ekkle-api` (ex: `https://ekkle-api.up.railway.app`).
2. Na sua instância da Evolution API, configure o **Webhook de Mensagens** para apontar para:
   ```
   https://<sua-url-do-railway>/webhook/whatsapp
   ```

## Teste Local com Docker Compose

Para testar o ambiente completo localmente:

1. Crie um arquivo `.env` com as variáveis necessárias.
2. Suba os containers:
   ```bash
   docker-compose up --build
   ```
3. O sistema estará disponível em `http://localhost:3000`.

## Estrutura do Deploy

- **ekkle-api**: Serviço que expõe a API REST e recebe webhooks.
- **ekkle-worker**: Serviço que processa a fila de mensagens do WhatsApp.
- **Redis**: Banco de dados de fila (BullMQ).
- **Supabase**: Banco de dados principal (PostgreSQL).
