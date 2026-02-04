-- ===========================================
-- EKKLE SALES OS - Database Setup Script
-- Execute este script no Supabase SQL Editor
-- ===========================================

-- Habilitar extensão pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ===========================================
-- TABELA: leads
-- Armazena informações dos pastores/líderes
-- ===========================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  church_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'new' 
    CHECK (status IN ('new', 'contacted', 'qualified', 'negotiating', 'won', 'lost')),
  temperature VARCHAR(10) NOT NULL DEFAULT 'cold' 
    CHECK (temperature IN ('cold', 'warm', 'hot')),
  assigned_agent VARCHAR(10) NOT NULL DEFAULT 'sdr' 
    CHECK (assigned_agent IN ('sdr', 'bdr', 'closer')),
  embedding extensions.vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON public.leads(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- ===========================================
-- TABELA: conversations
-- Histórico de mensagens
-- ===========================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  direction VARCHAR(10) NOT NULL 
    CHECK (direction IN ('inbound', 'outbound')),
  agent_name VARCHAR(10) NOT NULL 
    CHECK (agent_name IN ('sdr', 'bdr', 'closer')),
  intent_detected VARCHAR(20) NOT NULL DEFAULT 'unknown' 
    CHECK (intent_detected IN ('greeting', 'pricing', 'features', 'technical', 'objection', 'closing', 'support', 'off_hours', 'unknown')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON public.conversations(intent_detected);

-- ===========================================
-- TABELA: agent_executions
-- Log de execuções dos agentes AI
-- ===========================================
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_name VARCHAR(10) NOT NULL 
    CHECK (agent_name IN ('sdr', 'bdr', 'closer')),
  input_message TEXT NOT NULL,
  output_message TEXT,
  intent_detected VARCHAR(20) 
    CHECK (intent_detected IN ('greeting', 'pricing', 'features', 'technical', 'objection', 'closing', 'support', 'off_hours', 'unknown')),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(15) NOT NULL 
    CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para agent_executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_lead_id ON public.agent_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON public.agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON public.agent_executions(created_at DESC);

-- ===========================================
-- TABELA: payments
-- Controle de vendas/pagamentos
-- ===========================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status VARCHAR(15) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  external_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para payments
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- ===========================================
-- TRIGGER: updated_at automático
-- ===========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas para service role (backend)
DROP POLICY IF EXISTS "Service role has full access to leads" ON public.leads;
CREATE POLICY "Service role has full access to leads" ON public.leads
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to conversations" ON public.conversations;
CREATE POLICY "Service role has full access to conversations" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to agent_executions" ON public.agent_executions;
CREATE POLICY "Service role has full access to agent_executions" ON public.agent_executions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to payments" ON public.payments;
CREATE POLICY "Service role has full access to payments" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');

-- Política para leitura anônima (healthcheck)
DROP POLICY IF EXISTS "Anon can read leads count" ON public.leads;
CREATE POLICY "Anon can read leads count" ON public.leads
  FOR SELECT USING (true);

-- ===========================================
-- COMENTÁRIOS NAS TABELAS
-- ===========================================
COMMENT ON TABLE public.leads IS 'Leads de pastores e líderes de igrejas';
COMMENT ON TABLE public.conversations IS 'Histórico de mensagens WhatsApp';
COMMENT ON TABLE public.agent_executions IS 'Log de execuções dos agentes AI';
COMMENT ON TABLE public.payments IS 'Controle de vendas e pagamentos';

-- ===========================================
-- FIM DO SCRIPT
-- ===========================================
