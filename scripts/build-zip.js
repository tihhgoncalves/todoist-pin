#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'releases');

// Lê a versão do package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const zipName = `todoist-pin-v${version}.zip`;
const zipPath = path.join(outputDir, zipName);

console.log(`🔨 Iniciando build para Chrome Web Store...`);

// 1. Executar build
console.log(`📦 Gerando build...`);
try {
  execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erro ao executar build');
  process.exit(1);
}

// 2. Verificar se a pasta dist existe
if (!fs.existsSync(distDir)) {
  console.error(`❌ Pasta dist não encontrada em ${distDir}`);
  process.exit(1);
}

// 3. Criar pasta releases se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 4. Criar ZIP
console.log(`📁 Compactando em ${zipName}...`);
return new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
    console.log(`✅ ZIP criado com sucesso!`);
    console.log(`📍 Caminho: ${zipPath}`);
    console.log(`📊 Tamanho: ${sizeMB} MB`);
    console.log(`\n🚀 Pronto para publicar no Chrome Web Store!`);
    resolve();
  });

  archive.on('error', (err) => {
    console.error('❌ Erro ao criar ZIP:', err);
    reject(err);
  });

  archive.pipe(output);
  archive.directory(distDir, 'todoist-pin');
  archive.finalize();
}).catch((error) => {
  process.exit(1);
});
