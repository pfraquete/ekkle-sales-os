/**
 * EKKLE SALES OS - Database Connection Test
 * Testa conexão com Supabase e verifica tabelas
 * 
 * Uso: bun run scripts/test-db.ts
 */

import { createClient } from '@supabase/supabase-js';

// ===========================================
// Configuration
// ===========================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ddlwzmhzrldumyzahtss.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('===========================================');
console.log('EKKLE SALES OS - Database Connection Test');
console.log('===========================================\n');

// ===========================================
// Test Functions
// ===========================================

async function testConnection() {
  console.log('📡 Testando conexão com Supabase...\n');
  
  // Verificar variáveis de ambiente
  console.log('1️⃣  Verificando variáveis de ambiente:');
  console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Configurada' : '❌ Não configurada'}`);
  console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
  
  if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n❌ Nenhuma chave de API configurada.');
    console.log('   Configure SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  // Criar cliente
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, key!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Testar conexão
  console.log('\n2️⃣  Testando conexão:');
  
  try {
    const { data, error } = await supabase.from('leads').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Tabela "leads" não existe. Execute: bun run migrate');
      } else {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    } else {
      console.log('   ✅ Conexão estabelecida com sucesso!');
    }
  } catch (err) {
    console.log(`   ❌ Erro de conexão: ${err}`);
    process.exit(1);
  }
  
  // Verificar tabelas
  console.log('\n3️⃣  Verificando tabelas:');
  
  const tables = [
    'leads',
    'conversations',
    'agent_executions',
    'payments',
    'analytics',
    'conversation_summaries'
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: ${count || 0} registros`);
      }
    } catch {
      console.log(`   ❌ ${table}: Erro ao acessar`);
    }
  }
  
  // Testar operações CRUD
  console.log('\n4️⃣  Testando operações CRUD:');
  
  // INSERT
  const testPhone = `test_${Date.now()}`;
  const { data: insertData, error: insertError } = await supabase
    .from('leads')
    .insert({
      phone: testPhone,
      name: 'Test Lead',
      status: 'new',
      temperature: 'cold',
      assigned_agent: 'sdr'
    })
    .select()
    .single();
  
  if (insertError) {
    console.log(`   ❌ INSERT: ${insertError.message}`);
  } else {
    console.log(`   ✅ INSERT: Lead criado (id: ${insertData.id})`);
    
    // UPDATE
    const { error: updateError } = await supabase
      .from('leads')
      .update({ name: 'Test Lead Updated' })
      .eq('id', insertData.id);
    
    if (updateError) {
      console.log(`   ❌ UPDATE: ${updateError.message}`);
    } else {
      console.log(`   ✅ UPDATE: Lead atualizado`);
    }
    
    // DELETE
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', insertData.id);
    
    if (deleteError) {
      console.log(`   ❌ DELETE: ${deleteError.message}`);
    } else {
      console.log(`   ✅ DELETE: Lead removido`);
    }
  }
  
  console.log('\n===========================================');
  console.log('✅ Teste de conexão concluído!');
  console.log('===========================================');
}

testConnection().catch(console.error);
