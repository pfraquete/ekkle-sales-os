-- ===========================================
-- EKKLE SALES OS - Seed Data Script
-- Dados de teste para desenvolvimento
-- ===========================================

-- Limpar dados existentes (cuidado em produção!)
-- TRUNCATE public.payments, public.agent_executions, public.conversations, public.leads CASCADE;

-- ===========================================
-- LEADS DE TESTE
-- ===========================================

-- Lead 1: Pastor interessado (quente)
INSERT INTO public.leads (phone, name, church_name, status, temperature, assigned_agent, metadata)
VALUES (
  '5511999990001',
  'Pastor João Silva',
  'Igreja Batista Central',
  'qualified',
  'hot',
  'bdr',
  '{"congregation_size": 500, "source": "google_ads", "city": "São Paulo"}'::jsonb
) ON CONFLICT (phone) DO NOTHING;

-- Lead 2: Líder de célula (morno)
INSERT INTO public.leads (phone, name, church_name, status, temperature, assigned_agent, metadata)
VALUES (
  '5511999990002',
  'Maria Santos',
  'Comunidade Vida Nova',
  'contacted',
  'warm',
  'sdr',
  '{"congregation_size": 150, "source": "referral", "city": "Campinas"}'::jsonb
) ON CONFLICT (phone) DO NOTHING;

-- Lead 3: Novo contato (frio)
INSERT INTO public.leads (phone, name, church_name, status, temperature, assigned_agent, metadata)
VALUES (
  '5511999990003',
  'Pastor Carlos Oliveira',
  'Igreja Presbiteriana do Bairro',
  'new',
  'cold',
  'sdr',
  '{"congregation_size": 80, "source": "organic", "city": "Guarulhos"}'::jsonb
) ON CONFLICT (phone) DO NOTHING;

-- ===========================================
-- CONVERSAS DE TESTE
-- ===========================================

-- Conversas do Lead 1 (Pastor João)
INSERT INTO public.conversations (lead_id, message, direction, agent_name, intent_detected, metadata)
SELECT 
  id,
  'Olá, vi o anúncio de vocês. Gostaria de saber mais sobre o sistema.',
  'inbound',
  'sdr',
  'greeting',
  '{"source": "whatsapp"}'::jsonb
FROM public.leads WHERE phone = '5511999990001'
ON CONFLICT DO NOTHING;

INSERT INTO public.conversations (lead_id, message, direction, agent_name, intent_detected, metadata)
SELECT 
  id,
  'Olá Pastor João! Que alegria receber sua mensagem. O EKKLE é uma plataforma completa de gestão para igrejas. Posso te contar mais sobre as funcionalidades?',
  'outbound',
  'sdr',
  'greeting',
  '{"agent": "sdr"}'::jsonb
FROM public.leads WHERE phone = '5511999990001'
ON CONFLICT DO NOTHING;

INSERT INTO public.conversations (lead_id, message, direction, agent_name, intent_detected, metadata)
SELECT 
  id,
  'Sim, por favor. Principalmente sobre gestão de membros e financeiro.',
  'inbound',
  'bdr',
  'features',
  '{"source": "whatsapp"}'::jsonb
FROM public.leads WHERE phone = '5511999990001'
ON CONFLICT DO NOTHING;

-- Conversas do Lead 2 (Maria)
INSERT INTO public.conversations (lead_id, message, direction, agent_name, intent_detected, metadata)
SELECT 
  id,
  'Boa tarde! Quanto custa o sistema?',
  'inbound',
  'sdr',
  'pricing',
  '{"source": "whatsapp"}'::jsonb
FROM public.leads WHERE phone = '5511999990002'
ON CONFLICT DO NOTHING;

INSERT INTO public.conversations (lead_id, message, direction, agent_name, intent_detected, metadata)
SELECT 
  id,
  'Boa tarde, Maria! Temos planos a partir de R$ 99/mês para igrejas menores. Posso entender melhor o tamanho da sua comunidade para indicar o plano ideal?',
  'outbound',
  'sdr',
  'pricing',
  '{"agent": "sdr"}'::jsonb
FROM public.leads WHERE phone = '5511999990002'
ON CONFLICT DO NOTHING;

-- ===========================================
-- EXECUÇÕES DE AGENTES DE TESTE
-- ===========================================

INSERT INTO public.agent_executions (lead_id, agent_name, input_message, output_message, intent_detected, tokens_used, execution_time_ms, status, metadata)
SELECT 
  id,
  'sdr',
  'Olá, vi o anúncio de vocês. Gostaria de saber mais sobre o sistema.',
  'Olá Pastor João! Que alegria receber sua mensagem. O EKKLE é uma plataforma completa de gestão para igrejas. Posso te contar mais sobre as funcionalidades?',
  'greeting',
  150,
  1200,
  'completed',
  '{"model": "moonshot-v1-128k"}'::jsonb
FROM public.leads WHERE phone = '5511999990001'
ON CONFLICT DO NOTHING;

-- ===========================================
-- PAGAMENTOS DE TESTE (mock)
-- ===========================================

INSERT INTO public.payments (lead_id, amount, currency, status, payment_method, external_id, metadata)
SELECT 
  id,
  199.00,
  'BRL',
  'pending',
  'pix',
  'mock_payment_001',
  '{"plan": "professional", "billing_cycle": "monthly"}'::jsonb
FROM public.leads WHERE phone = '5511999990001'
ON CONFLICT DO NOTHING;

-- ===========================================
-- VERIFICAÇÃO
-- ===========================================

-- Contar registros criados
SELECT 'leads' as table_name, COUNT(*) as count FROM public.leads
UNION ALL
SELECT 'conversations', COUNT(*) FROM public.conversations
UNION ALL
SELECT 'agent_executions', COUNT(*) FROM public.agent_executions
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments;
