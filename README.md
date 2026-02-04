# EKKLE SALES OS

Sistema de vendas B2B para igrejas com automação de WhatsApp, utilizando agentes AI para qualificação e atendimento de leads.

## 📋 Visão Geral

O EKKLE SALES OS é um sistema backend que automatiza o processo de vendas para igrejas através do WhatsApp. Quando um pastor ou líder envia uma mensagem, o sistema:

1. Recebe a mensagem via webhook do Evolution API
2. Coloca na fila Redis para processamento assíncrono
3. Processa com agentes AI (Kimi K2.5) que detectam intenção
4. Responde automaticamente via WhatsApp
5. Registra tudo no banco de dados Supabase

### Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │────▶│   Evolution     │────▶│   EKKLE API     │
│   (Pastor)      │     │   API           │     │   (Webhook)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Supabase      │◀────│   Worker        │◀────│   Redis         │
│   (PostgreSQL)  │     │   (BullMQ)      │     │   (Queue)       │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Kimi K2.5     │
                        │   (AI Agent)    │
                        └─────────────────┘
```

## 🚀 Stack Tecnológico

| Componente | Tecnologia |
|------------|------------|
| Runtime | Bun 1.1+ |
| Framework API | Elysia.js |
| Banco de Dados | Supabase (PostgreSQL) |
| Fila | Redis + BullMQ |
| AI | Kimi K2.5 API (OpenAI compatible) |
| WhatsApp | Evolution API |
| Deploy | Railway / Docker |

## 📁 Estrutura do Projeto

```
/src
  /api              # API REST Elysia
    /middleware     # Rate limiting, error handling
    /routes         # Rotas da API
    /services       # Serviços de banco de dados
    server.ts       # Entry point da API
  /agents           # Lógica dos agentes AI
    baseAgent.ts    # Processamento de mensagens
    kimiClient.ts   # Cliente Kimi API
    evolutionClient.ts # Cliente Evolution API
  /workers          # Processadores de fila
    whatsappWorker.ts # Worker de mensagens
  /webhooks         # Receber WhatsApp
    whatsapp.ts     # Handler do webhook
  /shared           # Types, schemas, config
    types.ts        # Definições TypeScript
    schemas.ts      # Validação Zod
    config.ts       # Configurações
    supabase.ts     # Cliente Supabase
    redis.ts        # Cliente Redis
```

## 🛠️ Instalação

### Pré-requisitos

- [Bun](https://bun.sh/) 1.1 ou superior
- [Docker](https://docker.com/) (opcional, para desenvolvimento local)
- Conta no [Supabase](https://supabase.com/)
- Conta no [Railway](https://railway.app/) (para deploy)
- Instância do [Evolution API](https://github.com/EvolutionAPI/evolution-api)
- API Key do [Kimi/Moonshot](https://platform.moonshot.cn/)

### 1. Clonar o Repositório

```bash
git clone https://github.com/pfraquete/ekkle-sales-os.git
cd ekkle-sales-os
```

### 2. Instalar Dependências

```bash
bun install
```

### 3. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# Kimi API
KIMI_API_KEY=sua-kimi-api-key
KIMI_API_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-128k

# Evolution API
EVOLUTION_API_URL=https://sua-evolution-instance.com
EVOLUTION_API_KEY=sua-evolution-api-key
EVOLUTION_INSTANCE_NAME=ekkle-sales

# Webhook
WEBHOOK_SECRET=seu-webhook-secret
```

### 4. Configurar Banco de Dados

Execute o script SQL no Supabase SQL Editor:

```bash
# O script está em:
scripts/setup-database.sql
```

Opcionalmente, popule com dados de teste:

```bash
scripts/seed-data.sql
```

### 5. Executar Localmente

**Com Docker (recomendado):**

```bash
docker-compose up -d
```

**Sem Docker:**

```bash
# Terminal 1 - Iniciar Redis
redis-server

# Terminal 2 - Iniciar API
bun run dev:api

# Terminal 3 - Iniciar Worker
bun run dev:worker
```

### 6. Testar

Acesse:
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/docs
- Health Check: http://localhost:3000/health

## 🚢 Deploy no Railway

### 1. Criar Projeto no Railway

1. Acesse [Railway](https://railway.app/)
2. Crie um novo projeto
3. Conecte ao repositório GitHub

### 2. Adicionar Serviços

**Serviço 1: API**
- Nome: `ekkle-api`
- Dockerfile: `Dockerfile`
- Variáveis de ambiente: (todas do .env.example)

**Serviço 2: Worker**
- Nome: `ekkle-worker`
- Dockerfile: `Dockerfile.worker`
- Variáveis de ambiente: (mesmas da API)

**Serviço 3: Redis**
- Adicione o plugin Redis do Railway
- Copie a `REDIS_URL` para os outros serviços

### 3. Configurar Webhook

No Evolution API, configure o webhook para:
```
https://seu-app.railway.app/webhook/whatsapp
```

## 📡 API Endpoints

### Health Check

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Status básico |
| GET | `/health/detailed` | Status com dependências |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |

### Leads

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/leads` | Listar leads (paginado) |
| GET | `/leads/:id` | Buscar lead por ID |
| POST | `/leads` | Criar lead |
| PATCH | `/leads/:id` | Atualizar lead |
| GET | `/leads/:id/conversations` | Histórico de conversas |

### Webhook

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/webhook/whatsapp` | Receber mensagens |
| GET | `/webhook/whatsapp` | Verificar endpoint |

### Stats

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/stats/queue` | Estatísticas da fila |

## 🤖 Sistema de Agentes

O sistema utiliza três tipos de agentes AI:

| Agente | Função | Quando é acionado |
|--------|--------|-------------------|
| **SDR** | Primeiro contato, qualificação inicial | Novos leads, saudações |
| **BDR** | Dúvidas técnicas, demonstração | Intent técnica ou features |
| **Closer** | Fechamento de vendas | Intent de compra ou pricing |

### Detecção de Intent

O sistema detecta automaticamente a intenção da mensagem:

- `greeting` - Saudação
- `pricing` - Pergunta sobre preço
- `features` - Funcionalidades
- `technical` - Dúvida técnica
- `objection` - Objeção de venda
- `closing` - Intenção de fechar
- `support` - Suporte
- `off_hours` - Fora do horário

## 🔒 Segurança

- **RLS (Row Level Security)** habilitado no Supabase
- **Rate Limiting** de 100 req/min por IP
- **Webhook Secret** para validar requisições
- **Service Role Key** apenas no backend

## 📊 Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `leads` | Pastores e líderes de igrejas |
| `conversations` | Histórico de mensagens |
| `agent_executions` | Log de execuções AI |
| `payments` | Controle de vendas |

### Diagrama ER

```
leads
├── id (PK)
├── phone (UNIQUE)
├── name
├── church_name
├── status
├── temperature
├── assigned_agent
├── embedding (vector)
└── metadata (JSONB)

conversations
├── id (PK)
├── lead_id (FK → leads)
├── message
├── direction
├── agent_name
├── intent_detected
└── metadata (JSONB)

agent_executions
├── id (PK)
├── lead_id (FK → leads)
├── agent_name
├── input_message
├── output_message
├── intent_detected
├── tokens_used
├── execution_time_ms
├── status
└── error_message

payments
├── id (PK)
├── lead_id (FK → leads)
├── amount
├── currency
├── status
├── payment_method
└── external_id
```

## 🧪 Testes

### Usando Postman/Insomnia

Importe a collection:
```
scripts/ekkle-sales-os.postman_collection.json
```

### Simular Webhook

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "event": "messages.upsert",
    "instance": "ekkle-sales",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "MSG_TEST_001"
      },
      "message": {
        "conversation": "Olá, gostaria de saber mais sobre o sistema"
      },
      "messageTimestamp": 1704067200,
      "pushName": "Pastor Teste"
    }
  }'
```

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
bun run dev          # API + Worker juntos
bun run dev:api      # Apenas API
bun run dev:worker   # Apenas Worker

# Produção
bun run start        # API + Worker
bun run start:api    # Apenas API
bun run start:worker # Apenas Worker

# Outros
bun run typecheck    # Verificar tipos
bun run lint         # Linting
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Para dúvidas ou problemas:
- Abra uma [Issue](https://github.com/pfraquete/ekkle-sales-os/issues)
- Entre em contato pelo email: suporte@ekkle.com.br

---

Desenvolvido com ❤️ para igrejas
