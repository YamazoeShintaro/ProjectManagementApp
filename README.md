## アプリ概要

このアプリは、プロジェクト管理に必要な機能を統合したWebアプリケーションです。
ウォーターフォール型開発にもアジャイル開発にも、さらにはシステム開発以外の様々なプロジェクトにも利用できます。
このアプリを使用することで以下のようなことが可能になります。

1. PERT図で視覚的にプロジェクト全体像を把握
![PERT図で視覚的にプロジェクト全体像を把握](docs/screenshots/screenshot1.png)
2. 依存関係と工数から自動でスケジュールを算出
![依存関係と工数から自動でスケジュールを算出](docs/screenshots/screenshot2.png)
3. WBS形式でのプロジェクト進捗管理
![WBS形式でのプロジェクト進捗管理](docs/screenshots/screenshot3.png)
4. 進捗のずれを反映した最適なスケジュールを即座に再計算
![進捗のずれを反映した最適なスケジュールを即座に再計算1](docs/screenshots/screenshot4.png)
![進捗のずれを反映した最適なスケジュールを即座に再計算2](docs/screenshots/screenshot5.png)
5. 社員の工数配分と社内リソース管理の効率化
![社員の工数配分と社内リソース管理の効率化1](docs/screenshots/screenshot6.png)
![社員の工数配分と社内リソース管理の効率化2](docs/screenshots/screenshot7.png)

### 主要機能
- **プロジェクト管理**: プロジェクトの作成・編集・一覧表示
- **WBS（作業分解構造）**: ガントチャート風のタスク管理画面
- **PERT図**: タスク間の依存関係をビジュアルに表示・編集
- **スケジュール自動算出**: 依存関係と工数から最適スケジュールを計算
- **社員管理**: 社員登録・工数配分・プロジェクト参加管理
- **チェックリスト機能**: タスクごとの詳細チェックリスト管理

## 技術スタック

- **フロントエンド**: React 18 + TypeScript + React Router
- **バックエンド**: FastAPI + SQLAlchemy + Pydantic
- **データベース**: PostgreSQL 14
- **UI**: React Flow（PERT図）+ カスタムCSS
- **開発環境**: Docker Compose

## セットアップ手順

### 前提条件

以下のソフトウェアがインストールされている必要があります：

- [Docker](https://www.docker.com/get-started/) および Docker Compose
- [Python 3.11](https://www.python.org/downloads/) （重要: 3.13は非対応）
- [Node.js 16+](https://nodejs.org/)
- [Git](https://git-scm.com/)

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/project-management-app.git
cd project-management-app
```

### 2. Pythonバージョンの設定（重要）

Python 3.13では依存関係でエラーが発生するため、Python 3.11を使用してください。

```bash
# pyenvを使用している場合
pyenv install 3.11.10
pyenv local 3.11.10

# 環境変数をクリア
unset PYENV_VERSION

# バージョン確認
python --version  # Python 3.11.10 と表示されることを確認
```

### 3. データベースの起動

```bash
# PostgreSQLコンテナ起動
docker-compose up -d

# 起動確認
docker ps
```

### 4. バックエンドの起動

```bash
cd backend

# 仮想環境作成
python -m venv venv

# 仮想環境有効化
# Linux/Mac:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt
pip install email-validator

# 環境変数ファイル作成
echo "DATABASE_URL=postgresql://pm_user:pm_password@localhost:5432/project_management" > .env

# アプリケーション起動
python main.py
```

成功すると以下のメッセージが表示されます：
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### 5. フロントエンドの起動

**新しいターミナルウィンドウ**で以下を実行：

```bash
cd frontend

# 依存関係インストール
npm install

# 開発サーバー起動
npm start
```

ブラウザが自動的に http://localhost:3000 を開きます。

## 使用方法

### 基本的な操作の流れ

#### 1. 社員登録
1. サイドバーの「社員一覧」をクリック
2. 「新規社員登録」ボタンを押す
3. 社員名、メールアドレス、1日の稼働時間を入力
4. 「登録」ボタンで完了

#### 2. プロジェクト作成
1. トップページ（プロジェクト一覧）で「新規プロジェクト作成」をクリック
2. 基本情報を入力：
   - プロジェクト名（必須）
   - 開始日・終了日（必須）
   - プロジェクトマネージャー
   - クライアント名
   - 予算
3. プロジェクトメンバーを選択：
   - 社員にチェックを入れる
   - 役割と稼働率を設定
4. 「作成」ボタンで完了

#### 3. タスク管理（WBS画面）
1. プロジェクト一覧からプロジェクトをクリック
2. 「WBS」タブを選択
3. 「タスク追加」でタスクを作成：
   - タスク名（必須）
   - 予定工数（必須）
   - 担当者（必須）
   - カテゴリ（任意）
   - 説明
   - マイルストーン設定
4. タスクをクリックして詳細編集・チェックリスト管理

#### 4. 依存関係設定（PERT図）
1. 「PERT図」タブを選択
2. 依存関係の種類を選択（FS：終了→開始など）
3. タスクノードの右端から線を引いて別のタスクの左端に接続
4. 依存関係を削除する場合は線をクリック

#### 5. スケジュール計算
1. タスクや依存関係を変更後、「スケジュール要更新」が表示される
2. 「スケジュール再計算」ボタンをクリック
3. 自動的に最適なスケジュールが算出される

## 主要なユースケース

### 1. システム開発プロジェクト

**シナリオ**: ECサイト構築プロジェクト（3ヶ月、5名体制）

**手順**:
1. プロジェクト作成（期間：2025-09-01 〜 2025-11-30）
2. メンバー登録：PM（1.0）、SE（0.8）、PG（0.8）、デザイナー（0.4）、テスター（0.6）
3. タスク作成例：
   - `[要件定義] 業務要件整理` → PM担当、5人日
   - `[設計] システム設計書作成` → SE担当、8人日  
   - `[開発] フロントエンド実装` → PG担当、15人日
   - `[テスト] 単体テスト` → PG担当、5人日
   - `[テスト] 結合テスト` → テスター担当、10人日
4. 依存関係設定：要件定義 → 設計 → 開発 → 単体テスト → 結合テスト
5. スケジュール自動計算で最適な開始・終了日を算出

### 2. イベント企画プロジェクト

**シナリオ**: 社内イベント企画（2ヶ月、3名体制）

**手順**:
1. プロジェクト作成（期間：2025-09-01 〜 2025-10-31）
2. メンバー登録：企画責任者（1.0）、デザイナー（0.3）、総務（0.2）
3. タスク作成例：
   - `[企画] イベント企画書作成` → 企画責任者、3人日
   - `[デザイン] ポスター作成` → デザイナー、2人日
   - `[準備] 会場予約` → 総務、1人日
   - `[準備] ケータリング手配` → 総務、1人日
   - `[実施] イベント当日運営` → 全員、1人日
4. マイルストーン設定：企画書完成、ポスター完成、イベント実施

### 3. 製品開発プロジェクト

**シナリオ**: 新製品開発（6ヶ月、8名体制）

**手順**:
1. フェーズ分割：企画フェーズ、設計フェーズ、開発フェーズ、テストフェーズ
2. 各フェーズでタスクを詳細化
3. クリティカルパスを意識した依存関係設定
4. 定期的なスケジュール見直しと工数調整

## システムの詳細仕様

### 機能詳細

#### WBS（作業分解構造）画面
- **Excel風ガントチャート**: 左側にタスク情報、右側に期間バーを表示
- **リアルタイム進捗表示**: チェックリスト完了率に基づく進捗可視化
- **カテゴリ管理**: タスクをカテゴリ別に色分け表示
- **タスク詳細パネル**: 右側パネルでタスクの詳細情報・チェックリスト管理

#### PERT図画面
- **ドラッグ&ドロップ**: タスクノードを自由に配置
- **依存関係作成**: ノード間を線で接続して依存関係を設定
- **4種類の依存関係**: FS（終了→開始）、SS（開始→開始）、FF（終了→終了）、SF（開始→終了）
- **循環依存検出**: 無効な依存関係を自動検出・阻止

#### スケジュール計算エンジン
- **CPM（クリティカルパス法）**: Forward Passによる最早開始・終了日計算
- **営業日計算**: 土日を除外した営業日ベースでの計算
- **稼働率考慮**: メンバーの稼働率を考慮した実際の所要日数計算
- **制約条件対応**: 最早開始日、デッドラインなどの制約を考慮

### データ構造

#### 主要エンティティ
- **Employee**: 社員マスタ（名前、メール、稼働時間）
- **Project**: プロジェクト（名前、期間、予算、マネージャー）
- **ProjectMember**: プロジェクト参加者（役割、稼働率、参加期間）
- **Task**: タスク（名前、工数、期間、座標、マイルストーン）
- **TaskDependency**: タスク依存関係
- **TaskChecklist**: チェックリスト項目

## トラブルシューティング

### よくある問題と解決法

#### Python関連エラー

**Python 3.13でのエラー**
```bash
# 症状: psycopg2-binary, pydantic-core のビルドエラー
# 解決方法:
pyenv install 3.11.10
pyenv local 3.11.10
unset PYENV_VERSION
```

**依存関係エラー**
```bash
# email-validator不足の場合
pip install email-validator

# 仮想環境の再作成
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### データベース接続エラー

```bash
# Docker コンテナの確認
docker ps
docker logs project-management-app-postgres-1

# コンテナの再起動
docker-compose down
docker-compose up -d

# データベースの初期化
docker exec -it project-management-app-postgres-1 psql -U pm_user -d project_management -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

#### フロントエンドエラー

```bash
# node_modules の再インストール
rm -rf node_modules package-lock.json
npm install

# 開発サーバーの再起動
npm start
```

### 動作確認

#### サービス確認
- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000
- **API仕様（Swagger）**: http://localhost:8000/docs

#### データベース直接接続
```bash
docker exec -it project-management-app-postgres-1 psql -U pm_user -d project_management

# テーブル一覧確認
\dt

# サンプルデータ確認
SELECT * FROM employee;
SELECT * FROM project;
```

### テストデータの投入
アプリケーション起動時に以下のサンプルデータが自動投入されます：
- **社員**: 田中太郎、佐藤花子、鈴木一郎
- **コードマスタ**: ステータス（未着手/進行中/完了）、優先度（高/中/低）

本格的な運用前に、これらのサンプルデータを削除し、実際のデータに置き換えてください。