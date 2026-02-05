/**
 * EKKLE SALES OS - Migration Script
 * Cria tabelas no Supabase via API (não SQL manual)
 * 
 * Uso: bun run scripts/migrate.ts
 */

import { createClient } from '@supabase/supabase-js';

// ===========================================
// Configuration
// ===========================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ddlwzmhzrldumyzahtss.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada');
  console.error('   Configure a variável de ambiente e tente novamente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ===========================================
// Migration Definitions
// ===========================================

const migrations = [
  {
    name: '001_enable_extensions',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "vector";
    `
  },
  {
    name: '002_create_leads_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255),
        church_name VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiating', 'won', 'lost')),
        temperature VARCHAR(10) NOT NULL DEFAULT 'cold' CHECK (temperature IN ('cold', 'warm', 'hot')),
        assigned_agent VARCHAR(10) NOT NULL DEFAULT 'sdr' CHECK (assigned_agent IN ('sdr', 'bdr', 'ae', 'closer')),
        embedding vector(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(temperature);
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON public.leads(assigned_agent);
    `
  },
  {
    name: '003_create_conversations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        agent_name VARCHAR(10) NOT NULL CHECK (agent_name IN ('sdr', 'bdr', 'ae', 'closer')),
        intent_detected VARCHAR(20) DEFAULT 'unknown',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON public.conversations(lead_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
    `
  },
  {
    name: '004_create_agent_executions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.agent_executions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        agent_name VARCHAR(10) NOT NULL CHECK (agent_name IN ('sdr', 'bdr', 'ae', 'closer')),
        input_message TEXT NOT NULL,
        output_message TEXT,
        intent_detected VARCHAR(20),
        tokens_used INTEGER DEFAULT 0,
        execution_time_ms INTEGER DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
        error_message TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_executions_lead_id ON public.agent_executions(lead_id);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON public.agent_executions(status);
    `
  },
  {
    name: '005_create_payments_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
        payment_method VARCHAR(50),
        external_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON public.payments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
    `
  },
  {
    name: '006_create_analytics_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.analytics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        analysis_type VARCHAR(50) NOT NULL DEFAULT 'market_analysis',
        address TEXT,
        instagram VARCHAR(255),
        competitor_count INTEGER DEFAULT 0,
        digital_score INTEGER DEFAULT 0 CHECK (digital_score >= 0 AND digital_score <= 10),
        opportunity VARCHAR(10) DEFAULT 'medium' CHECK (opportunity IN ('low', 'medium', 'high')),
        raw_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_analytics_lead_id ON public.analytics(lead_id);
    `
  },
  {
    name: '007_create_conversation_summaries_table',
    sql: `
      CREATE TABLE IF NOT EXISTS public.conversation_summaries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        key_points JSONB DEFAULT '[]',
        extracted_info JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversation_summaries_lead_id ON public.conversation_summaries(lead_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_summaries_lead_unique ON public.conversation_summaries(lead_id);
    `
  },
  {
    name: '008_create_updated_at_trigger',
    sql: `
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
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
      
      DROP TRIGGER IF EXISTS update_analytics_updated_at ON public.analytics;
      CREATE TRIGGER update_analytics_updated_at
        BEFORE UPDATE ON public.analytics
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_conversation_summaries_updated_at ON public.conversation_summaries;
      CREATE TRIGGER update_conversation_summaries_updated_at
        BEFORE UPDATE ON public.conversation_summaries
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    `
  },
  {
    name: '009_enable_rls',
    sql: `
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
      
      -- Políticas para service_role (acesso total)
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
      
      DROP POLICY IF EXISTS "Service role has full access to analytics" ON public.analytics;
      CREATE POLICY "Service role has full access to analytics" ON public.analytics
        FOR ALL USING (auth.role() = 'service_role');
      
      DROP POLICY IF EXISTS "Service role has full access to conversation_summaries" ON public.conversation_summaries;
      CREATE POLICY "Service role has full access to conversation_summaries" ON public.conversation_summaries
        FOR ALL USING (auth.role() = 'service_role');
    `
  },
  {
    name: '010_enable_realtime',
    sql: `
      -- Habilitar Realtime para tabelas principais
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    `
  }
];

// ===========================================
// Migration Runner
// ===========================================

async function runMigration(migration: { name: string; sql: string }) {
  console.log(`\n📦 Executando: ${migration.name}`);
  
  try {
    // Usar RPC para executar SQL raw
    const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
    
    if (error) {
      // Se RPC não existir, tentar via REST API diretamente
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql: migration.sql })
      });
      
      if (!response.ok) {
        // Fallback: executar via SQL Editor API
        console.log(`   ⚠️ Usando fallback para: ${migration.name}`);
        
        // Para migrations que falham, mostrar SQL para execução manual
        console.log(`   📋 Execute manualmente no Supabase Dashboard:`);
        console.log(`   ${migration.sql.substring(0, 100)}...`);
        return false;
      }
    }
    
    console.log(`   ✅ ${migration.name} executado com sucesso`);
    return true;
  } catch (err) {
    console.error(`   ❌ Erro em ${migration.name}:`, err);
    return false;
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .limit(1);
  
  return !error;
}

async function main() {
  console.log('===========================================');
  console.log('EKKLE SALES OS - Migration Script');
  console.log('===========================================');
  console.log(`\n🔗 Supabase URL: ${SUPABASE_URL}`);
  
  // Verificar se tabelas já existem
  const leadsExist = await checkTableExists('leads');
  
  if (leadsExist) {
    console.log('\n✅ Tabelas já existem no banco de dados.');
    console.log('   Para recriar, delete as tabelas manualmente primeiro.');
    
    // Listar tabelas existentes
    const tables = ['leads', 'conversations', 'agent_executions', 'payments', 'analytics', 'conversation_summaries'];
    console.log('\n📊 Tabelas encontradas:');
    
    for (const table of tables) {
      const exists = await checkTableExists(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    
    return;
  }
  
  console.log('\n🚀 Iniciando migrations...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n===========================================');
  console.log('📊 Resultado das Migrations:');
  console.log(`   ✅ Sucesso: ${successCount}`);
  console.log(`   ❌ Falhas: ${failCount}`);
  console.log('===========================================');
  
  if (failCount > 0) {
    console.log('\n⚠️ Algumas migrations falharam.');
    console.log('   Execute o SQL manualmente no Supabase Dashboard.');
    console.log('   Arquivo: scripts/setup-database.sql');
  }
}

main().catch(console.error);
