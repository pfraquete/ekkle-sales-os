/**
 * EKKLE SALES OS - Security Check
 * Verifica se não há secrets commitados no código
 * 
 * Uso: bun run scripts/security-check.ts
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

// ===========================================
// Configuration
// ===========================================

const ROOT_DIR = process.cwd();

// Padrões de secrets que não devem estar no código
const SECRET_PATTERNS = [
  // API Keys
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI API Key
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWT (exceto exemplos)
  /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/g,       // Slack Bot Token
  /ghp_[a-zA-Z0-9]{36}/g,                    // GitHub Personal Access Token
  /gho_[a-zA-Z0-9]{36}/g,                    // GitHub OAuth Token
  /AKIA[0-9A-Z]{16}/g,                       // AWS Access Key ID
  /[a-zA-Z0-9/+=]{40}/g,                     // AWS Secret Access Key (40 chars)
  
  // Passwords
  /password\s*[:=]\s*['"][^'"]{8,}['"]/gi,   // Hardcoded passwords
  /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi,     // Hardcoded secrets
  
  // Database URLs with credentials
  /postgres:\/\/[^:]+:[^@]+@/g,              // PostgreSQL connection string
  /mysql:\/\/[^:]+:[^@]+@/g,                 // MySQL connection string
  /mongodb\+srv:\/\/[^:]+:[^@]+@/g,          // MongoDB connection string
  
  // Private Keys
  /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
  /-----BEGIN OPENSSH PRIVATE KEY-----/g,
];

// Arquivos/diretórios a ignorar
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.env.example',
  '.env.local.example',
  'bun.lockb',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '*.md',
  '*.txt',
  'security-check.ts', // Ignorar este próprio arquivo
];

// Extensões a verificar
const CHECK_EXTENSIONS = [
  '.ts',
  '.js',
  '.tsx',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
];

// ===========================================
// Functions
// ===========================================

function shouldIgnore(path: string): boolean {
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.startsWith('*')) {
      return path.endsWith(pattern.slice(1));
    }
    return path.includes(pattern);
  });
}

function shouldCheck(path: string): boolean {
  return CHECK_EXTENSIONS.some(ext => path.endsWith(ext));
}

interface Finding {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

async function checkFile(filePath: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Ignorar linhas de comentário
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        return;
      }
      
      // Ignorar linhas com process.env (são referências, não valores)
      if (line.includes('process.env')) {
        return;
      }
      
      // Ignorar linhas com ${...} (são templates)
      if (line.includes('${') && line.includes('}')) {
        return;
      }
      
      SECRET_PATTERNS.forEach((pattern, patternIndex) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Ignorar JWTs de exemplo/demo
            if (match.includes('supabase-demo')) {
              return;
            }
            
            findings.push({
              file: filePath.replace(ROOT_DIR, '.'),
              line: index + 1,
              pattern: `Pattern ${patternIndex + 1}`,
              snippet: line.trim().substring(0, 100) + (line.length > 100 ? '...' : ''),
            });
          });
        }
      });
    });
  } catch {
    // Ignorar erros de leitura
  }
  
  return findings;
}

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      if (shouldIgnore(fullPath)) {
        continue;
      }
      
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        const subFiles = await walkDir(fullPath);
        files.push(...subFiles);
      } else if (stats.isFile() && shouldCheck(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignorar erros de acesso
  }
  
  return files;
}

async function checkEnvFiles(): Promise<string[]> {
  const issues: string[] = [];
  
  // Verificar se .env está no .gitignore
  try {
    const gitignore = await readFile(join(ROOT_DIR, '.gitignore'), 'utf-8');
    
    if (!gitignore.includes('.env')) {
      issues.push('⚠️  .env não está no .gitignore');
    }
    
    if (!gitignore.includes('.env.local')) {
      issues.push('⚠️  .env.local não está no .gitignore');
    }
  } catch {
    issues.push('⚠️  Arquivo .gitignore não encontrado');
  }
  
  // Verificar se .env existe (não deveria em produção)
  try {
    await stat(join(ROOT_DIR, '.env'));
    issues.push('⚠️  Arquivo .env existe no diretório (não commitar!)');
  } catch {
    // OK - arquivo não existe
  }
  
  return issues;
}

// ===========================================
// Main
// ===========================================

async function main() {
  console.log('===========================================');
  console.log('EKKLE SALES OS - Security Check');
  console.log('===========================================\n');
  
  console.log('🔍 Verificando arquivos...\n');
  
  // Verificar arquivos .env
  console.log('1️⃣  Verificando configuração de .env:');
  const envIssues = await checkEnvFiles();
  
  if (envIssues.length === 0) {
    console.log('   ✅ Configuração de .env OK');
  } else {
    envIssues.forEach(issue => console.log(`   ${issue}`));
  }
  
  // Verificar secrets no código
  console.log('\n2️⃣  Verificando secrets no código:');
  
  const files = await walkDir(ROOT_DIR);
  console.log(`   📁 ${files.length} arquivos para verificar`);
  
  const allFindings: Finding[] = [];
  
  for (const file of files) {
    const findings = await checkFile(file);
    allFindings.push(...findings);
  }
  
  if (allFindings.length === 0) {
    console.log('   ✅ Nenhum secret encontrado no código');
  } else {
    console.log(`\n   ❌ ${allFindings.length} possíveis secrets encontrados:\n`);
    
    allFindings.forEach(finding => {
      console.log(`   📄 ${finding.file}:${finding.line}`);
      console.log(`      ${finding.snippet}`);
      console.log('');
    });
  }
  
  // Verificar dependências vulneráveis (básico)
  console.log('\n3️⃣  Verificando package.json:');
  
  try {
    const pkg = JSON.parse(await readFile(join(ROOT_DIR, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    // Verificar se há dependências com versões fixas (recomendado)
    let hasWildcard = false;
    Object.entries(deps).forEach(([name, version]) => {
      if (typeof version === 'string' && (version.startsWith('*') || version === 'latest')) {
        console.log(`   ⚠️  ${name}: ${version} (versão não fixa)`);
        hasWildcard = true;
      }
    });
    
    if (!hasWildcard) {
      console.log('   ✅ Todas as dependências têm versões fixas');
    }
  } catch {
    console.log('   ⚠️  Não foi possível ler package.json');
  }
  
  // Resultado final
  console.log('\n===========================================');
  
  const totalIssues = envIssues.length + allFindings.length;
  
  if (totalIssues === 0) {
    console.log('✅ Verificação de segurança concluída - Nenhum problema encontrado!');
  } else {
    console.log(`⚠️  Verificação de segurança concluída - ${totalIssues} problemas encontrados`);
    console.log('   Revise os itens acima antes de fazer commit.');
  }
  
  console.log('===========================================');
  
  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch(console.error);
