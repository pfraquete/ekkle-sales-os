/**
 * EKKLE SALES OS - Seeds Script
 * Insere 5 leads de teste no Supabase
 * 
 * Uso: bun run scripts/seeds.ts
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
// Seed Data
// ===========================================

const testLeads = [
  {
    phone: '5511999990001',
    name: 'Pastor João Silva',
    church_name: 'Igreja Batista Central',
    status: 'new',
    temperature: 'cold',
    assigned_agent: 'sdr',
    metadata: {
      source: 'seed',
      city: 'São Paulo',
      state: 'SP',
      members_count: 150
    }
  },
  {
    phone: '5521999990002',
    name: 'Pastor Carlos Oliveira',
    church_name: 'Comunidade Cristã Vida Nova',
    status: 'contacted',
    temperature: 'warm',
    assigned_agent: 'sdr',
    metadata: {
      source: 'seed',
      city: 'Rio de Janeiro',
      state: 'RJ',
      members_count: 300,
      instagram: '@vidanovaigreja'
    }
  },
  {
    phone: '5531999990003',
    name: 'Pastora Maria Santos',
    church_name: 'Igreja Presbiteriana Renovada',
    status: 'qualified',
    temperature: 'warm',
    assigned_agent: 'bdr',
    metadata: {
      source: 'seed',
      city: 'Belo Horizonte',
      state: 'MG',
      members_count: 200,
      instagram: '@iprenovada',
      address: 'Rua das Flores, 123 - Centro'
    }
  },
  {
    phone: '5541999990004',
    name: 'Pastor Pedro Ferreira',
    church_name: 'Igreja Assembleia de Deus Maranata',
    status: 'negotiating',
    temperature: 'hot',
    assigned_agent: 'ae',
    metadata: {
      source: 'seed',
      city: 'Curitiba',
      state: 'PR',
      members_count: 500,
      instagram: '@admaranata',
      address: 'Av. Brasil, 456 - Centro',
      interest_level: 'high'
    }
  },
  {
    phone: '5551999990005',
    name: 'Pastor Lucas Mendes',
    church_name: 'Igreja Metodista Wesleyana',
    status: 'won',
    temperature: 'hot',
    assigned_agent: 'ae',
    metadata: {
      source: 'seed',
      city: 'Porto Alegre',
      state: 'RS',
      members_count: 250,
      instagram: '@metodistapoa',
      converted_at: new Date().toISOString()
    }
  }
];

const testConversations = [
  // Conversas do Pastor João (lead 1)
  {
    lead_phone: '5511999990001',
    messages: [
      { message: 'Olá, vi o anúncio de vocês sobre gestão de igrejas', direction: 'inbound', agent_name: 'sdr', intent_detected: 'interest' },
      { message: 'Olá Pastor! Que alegria receber sua mensagem! Sou a Ana, do time EKKLE. Posso saber o nome da sua igreja?', direction: 'outbound', agent_name: 'sdr', intent_detected: 'greeting' }
    ]
  },
  // Conversas do Pastor Carlos (lead 2)
  {
    lead_phone: '5521999990002',
    messages: [
      { message: 'Boa tarde, gostaria de saber mais sobre o sistema', direction: 'inbound', agent_name: 'sdr', intent_detected: 'interest' },
      { message: 'Boa tarde, Pastor Carlos! Prazer em conhecê-lo! A Comunidade Cristã Vida Nova é uma igreja incrível! Quantos membros vocês têm atualmente?', direction: 'outbound', agent_name: 'sdr', intent_detected: 'qualification' },
      { message: 'Temos cerca de 300 membros', direction: 'inbound', agent_name: 'sdr', intent_detected: 'data' },
      { message: 'Excelente! Com 300 membros, vocês já devem sentir a necessidade de uma gestão mais organizada. Posso te mostrar como outras igrejas desse porte estão usando o EKKLE?', direction: 'outbound', agent_name: 'sdr', intent_detected: 'value_proposition' }
    ]
  },
  // Conversas da Pastora Maria (lead 3)
  {
    lead_phone: '5531999990003',
    messages: [
      { message: 'Recebi indicação de um colega pastor sobre vocês', direction: 'inbound', agent_name: 'bdr', intent_detected: 'referral' },
      { message: 'Que maravilha, Pastora Maria! Indicações são a melhor forma de conhecer nosso trabalho. Qual pastor indicou?', direction: 'outbound', agent_name: 'bdr', intent_detected: 'qualification' },
      { message: 'Foi o Pastor Carlos do Rio', direction: 'inbound', agent_name: 'bdr', intent_detected: 'data' },
      { message: 'Ah sim! O Pastor Carlos é um parceiro incrível! Ele já está usando nosso módulo de discipulado. Posso fazer uma análise gratuita da presença digital da sua igreja?', direction: 'outbound', agent_name: 'bdr', intent_detected: 'offer' },
      { message: 'Pode sim, nosso Instagram é @iprenovada', direction: 'inbound', agent_name: 'bdr', intent_detected: 'data' }
    ]
  },
  // Conversas do Pastor Pedro (lead 4)
  {
    lead_phone: '5541999990004',
    messages: [
      { message: 'Quero fechar o plano anual', direction: 'inbound', agent_name: 'ae', intent_detected: 'purchase_intent' },
      { message: 'Pastor Pedro! Que notícia maravilhosa! O plano anual é a melhor escolha - você economiza 2 meses! Vou preparar o link de pagamento agora mesmo.', direction: 'outbound', agent_name: 'ae', intent_detected: 'closing' },
      { message: 'Perfeito, aguardo', direction: 'inbound', agent_name: 'ae', intent_detected: 'confirmation' },
      { message: 'Aqui está o link seguro para pagamento: https://pay.ekkle.com.br/anual-ad-maranata\n\nValor: R$ 397,00/ano\nFormas: PIX, Cartão ou Boleto\n\nQualquer dúvida estou aqui!', direction: 'outbound', agent_name: 'ae', intent_detected: 'payment_link' }
    ]
  }
];

// ===========================================
// Seed Functions
// ===========================================

async function seedLeads() {
  console.log('\n📥 Inserindo leads de teste...\n');
  
  for (const lead of testLeads) {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', lead.phone)
      .single();
    
    if (existing) {
      console.log(`   ⏭️  Lead ${lead.name} já existe, pulando...`);
      continue;
    }
    
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();
    
    if (error) {
      console.error(`   ❌ Erro ao inserir ${lead.name}:`, error.message);
    } else {
      console.log(`   ✅ ${lead.name} (${lead.church_name})`);
    }
  }
}

async function seedConversations() {
  console.log('\n💬 Inserindo conversas de teste...\n');
  
  for (const conv of testConversations) {
    // Buscar lead pelo telefone
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name')
      .eq('phone', conv.lead_phone)
      .single();
    
    if (!lead) {
      console.log(`   ⚠️  Lead com telefone ${conv.lead_phone} não encontrado`);
      continue;
    }
    
    // Verificar se já tem conversas
    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead.id);
    
    if (count && count > 0) {
      console.log(`   ⏭️  ${lead.name} já tem conversas, pulando...`);
      continue;
    }
    
    // Inserir mensagens
    const messages = conv.messages.map(msg => ({
      ...msg,
      lead_id: lead.id
    }));
    
    const { error } = await supabase
      .from('conversations')
      .insert(messages);
    
    if (error) {
      console.error(`   ❌ Erro ao inserir conversas de ${lead.name}:`, error.message);
    } else {
      console.log(`   ✅ ${conv.messages.length} mensagens para ${lead.name}`);
    }
  }
}

async function seedAnalytics() {
  console.log('\n📊 Inserindo análises de mercado...\n');
  
  // Buscar lead qualificado
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name')
    .eq('phone', '5531999990003')
    .single();
  
  if (!lead) {
    console.log('   ⚠️  Lead para análise não encontrado');
    return;
  }
  
  // Verificar se já tem análise
  const { data: existing } = await supabase
    .from('analytics')
    .select('id')
    .eq('lead_id', lead.id)
    .single();
  
  if (existing) {
    console.log(`   ⏭️  ${lead.name} já tem análise, pulando...`);
    return;
  }
  
  const analytics = {
    lead_id: lead.id,
    analysis_type: 'market_analysis',
    address: 'Rua das Flores, 123 - Centro, Belo Horizonte - MG',
    instagram: '@iprenovada',
    competitor_count: 8,
    digital_score: 4,
    opportunity: 'high',
    raw_data: {
      followers: 1200,
      posts_last_month: 12,
      engagement_rate: 3.5,
      competitors: [
        'Igreja Batista Central BH',
        'Comunidade Cristã BH',
        'AD Ministério Madureira BH'
      ]
    }
  };
  
  const { error } = await supabase
    .from('analytics')
    .insert(analytics);
  
  if (error) {
    console.error(`   ❌ Erro ao inserir análise:`, error.message);
  } else {
    console.log(`   ✅ Análise de mercado para ${lead.name}`);
  }
}

// ===========================================
// Main
// ===========================================

async function main() {
  console.log('===========================================');
  console.log('EKKLE SALES OS - Seeds Script');
  console.log('===========================================');
  console.log(`\n🔗 Supabase URL: ${SUPABASE_URL}`);
  
  await seedLeads();
  await seedConversations();
  await seedAnalytics();
  
  console.log('\n===========================================');
  console.log('✅ Seeds concluídos!');
  console.log('===========================================');
  
  // Mostrar resumo
  const { count: leadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  const { count: conversationsCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Resumo:`);
  console.log(`   Leads: ${leadsCount}`);
  console.log(`   Conversas: ${conversationsCount}`);
}

main().catch(console.error);
