/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

// プロジェクトルートディレクトリ
// スクリプトをプロジェクト直下で実行する運用が多いので cwd を既定に。
// もし従来の __dirname を使いたければ環境変数で切替可能。
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'important-files-export.txt';

// 重要なファイルのみを指定
const IMPORTANT_FILES = [
  // Backend core files
  'backend/main.py',
  'backend/models/database.py',
  'backend/models/schemas.py',
  'backend/requirements.txt',
  'backend/.env',

  // Frontend core files
  'frontend/src/App.tsx',
  'frontend/src/index.tsx',
  'frontend/src/types/index.ts',
  'frontend/src/utils/api.ts',
  'frontend/src/utils/pdf-utils.ts',
  'frontend/src/App.css',
  'frontend/package.json',
  'frontend/tsconfig.json',
  'frontend/public/index.html',

  // Frontend pages (main ones)
  'frontend/src/pages/ProjectList.tsx',
  'frontend/src/pages/ProjectDetail.tsx',
  'frontend/src/pages/EmployeeList.tsx',
  'frontend/src/pages/EmployeeDetail.tsx',

  // Frontend components (main ones)
  'frontend/src/components/WBSView.tsx',
  'frontend/src/components/PERTChart.tsx',

  // Config files
  'docker-compose.yml',
  'README.md'
];

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function exportImportantFiles() {
  console.log('重要ファイルの出力を開始...');

  let output = '';
  const existingFiles = [];
  const missingFiles = [];

  // ヘッダー情報
  output += '='.repeat(80) + '\n';
  output += 'PROJECT MANAGEMENT APP - IMPORTANT FILES EXPORT\n';
  output += `Generated: ${new Date().toISOString()}\n`; // ← 修正ポイント（テンプレートリテラルで閉じる）
  output += '='.repeat(80) + '\n\n';

  // ファイル存在チェック
  IMPORTANT_FILES.forEach((file) => {
    const fullPath = path.resolve(PROJECT_ROOT, file);
    if (fileExists(fullPath)) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  });

  // 存在するファイルリスト
  output += 'EXISTING FILES:\n';
  output += '-'.repeat(40) + '\n';
  existingFiles.forEach((file) => (output += `✓ ${file}\n`));

  // 不足しているファイルリスト
  if (missingFiles.length > 0) {
    output += '\nMISSING FILES:\n';
    output += '-'.repeat(40) + '\n';
    missingFiles.forEach((file) => (output += `✗ ${file}\n`));
  }

  output += '\n' + '='.repeat(80) + '\n\n';

  // 各ファイルの内容
  existingFiles.forEach((file) => {
    const fullPath = path.resolve(PROJECT_ROOT, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');

      output += `FILE: ${file}\n`;
      output += '-'.repeat(`FILE: ${file}`.length) + '\n';
      output += content + '\n';
      output += '\n' + '='.repeat(80) + '\n\n';
    } catch (e) {
      output += `FILE: ${file}\n`;
      output += '-'.repeat(`FILE: ${file}`.length) + '\n';
      output += `ERROR: Could not read file - ${e.message}\n`;
      output += '\n' + '='.repeat(80) + '\n\n';
    }
  });

  // ファイル出力
  fs.writeFileSync(path.resolve(PROJECT_ROOT, OUTPUT_FILE), output, 'utf8');

  const outStat = fs.statSync(path.resolve(PROJECT_ROOT, OUTPUT_FILE));
  console.log(`重要ファイル出力完了: ${OUTPUT_FILE}`);
  console.log(`存在するファイル: ${existingFiles.length}`);
  console.log(`不足しているファイル: ${missingFiles.length}`);
  console.log(`ファイルサイズ: ${Math.round(outStat.size / 1024)}KB`);

  if (missingFiles.length > 0) {
    console.log('\n不足しているファイル:');
    missingFiles.forEach((file) => console.log(`  - ${file}`));
  }
}

// 使用方法説明
function showUsage() {
  console.log(`
使用方法:
  node export-project-code.js [--help]
  環境変数:
    PROJECT_ROOT=/path/to/project    解析するプロジェクトルート（既定: カレントディレクトリ）
    OUTPUT_FILE=important-files.txt  出力ファイル名（既定: important-files-export.txt）

重要ファイルのみを出力します:
- Backend: main.py, models/, requirements.txt
- Frontend: App.tsx, index.tsx, types/, utils/, package.json
- 設定ファイル: docker-compose.yml, frontend/tsconfig.json

ファイルサイズを大幅に削減し、問題解決に必要な情報のみを含みます。
`);
}

// 引数チェック
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
} else {
  exportImportantFiles();
}
