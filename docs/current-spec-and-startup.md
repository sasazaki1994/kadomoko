# KadoMoco v0.1

KadoMoco は、デスクトップの隅に住みつく小さな未分類生物を、作業の合間に少しずつ育てる常駐型ドット絵育成ゲームです。

- 1回の操作は 5〜20 秒で完結します。
- 1日 3〜5 回触れば進行するバランスです。
- 放置しても死亡・離脱・データ消失・重いペナルティはありません。

> Note: 現在の実装は Electron デスクトップアプリです。リポジトリ運用方針には Next.js / TypeScript / Prisma / PostgreSQL / Vitest / Playwright / Vercel や、生成AI回答の情報源ネットワーク可視化アプリという将来方針が含まれていますが、現行コードには Next.js / Prisma / PostgreSQL / Vitest / Playwright の構成はまだありません。本 README は、現時点で起動できる実装の仕様と起動方法を記載します。

## 現在の仕様

### アプリ体験

- フレームレス・透明背景の小さな Electron ウィンドウとして起動し、初期表示位置は画面右下です。
- ウィンドウはタスクバーに表示されず、閉じる操作では終了せずに非表示になります。
- トレイアイコンから再表示、最前面表示の切り替え、終了ができます。
- ペット表示領域を右クリックするとメニューが開きます。
- メニューから「食べもの」「ふれあう」「遊ぶ」「休ませる」を実行できます。
- メニューからステータスパネルを開き、レベル、EXP、満腹、機嫌、眠気、なつき、性格、デイリータスクを確認できます。
- 開発モードでは `D` ボタンから DevTools 用パネルを開けます。

### 育成・進行

- ペットは `満腹` / `機嫌` / `眠気` / `なつき` のバイタルを持ちます。
- 時間経過でバイタルが変化し、睡眠中は眠気が回復します。
- アクションにはクールダウンがあり、状態によっては遊びなどがブロックされます。
- 経験値によりレベルアップし、リアクション、待機モーション、セリフパック、プロップなどが解放されます。
- 毎日デイリータスクがロールされ、達成すると経験値となつき報酬を得ます。
- 前日の行動傾向から性格が変化します。
- 一定間隔でランダムイベントや短い吹き出しセリフが発生します。

### データ保存

- セーブデータ、設定、ウィンドウ位置は `electron-store` に保存されます。
- アプリ再開時や OS のレジューム時には、オフライン経過分の進行を反映します。
- セーブデータにはバージョンがあり、読み込み時にサニタイズされます。

### 技術構成

- Electron
- React
- Vite
- TypeScript
- Zustand
- electron-store
- CSS Animation

## 起動方法

### 前提

- Node.js と npm が利用できる環境を用意してください。
- 依存関係は `package-lock.json` に固定されています。

### 初回セットアップ

```bash
npm install
```

### 開発起動

```bash
npm run dev
```

`npm run dev` は Vite 開発サーバーと Electron を起動し、KadoMoco の Electron ウィンドウを表示します。

### ビルド

```bash
npm run build
```

`npm run build` は TypeScript の型チェックを実行したうえで、Vite の本番ビルドを作成します。成果物は主に `dist/` と `dist-electron/` に出力されます。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite + Electron の開発起動 |
| `npm run build` | TypeScript 型チェック + 本番ビルド |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run preview` | Vite preview |
| `npm run generate:sheet` | プレースホルダーのペット用スプライトシート PNG を生成 |

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `electron/` | Electron メインプロセス、preload、IPC、トレイ、ウィンドウ制御 |
| `src/App.tsx` | アプリのルート UI、初期化、定期 tick、表示パネル制御 |
| `src/components/` | ペット、メニュー、ステータス、デイリータスク、吹き出し、開発用パネル |
| `src/game/` | 育成ロジック、時間経過、アクション、レベル、性格、セーブデータ、状態機械 |
| `src/game/data/` | バランス値、タスク、イベント、リアクション、セリフ、報酬などのデータ定義 |
| `src/store/` | Zustand ストア |
| `src/styles/` | グローバル CSS とペット表示用 CSS |
| `scripts/` | 補助スクリプト |

## 仕様メモと不足している spec の追記案

現行リポジトリには、Tsumiki ベースの spec ディレクトリや Gherkin/Cucumber 風の acceptance spec ファイルはまだありません。CodeRabbit などで仕様監査しやすくするため、次の spec を追加することを推奨します。

- `spec/requirements.md`: KadoMoco の目的、非目的、対象プラットフォーム、データ永続化方針を定義する。
- `spec/domain.md`: ペット状態、バイタル、性格、レベル、デイリータスク、ランダムイベントのドメイン用語を定義する。
- `spec/pipeline.md`: 将来の「生成AI回答 + 知識マップ」二層体験、および OpenAI 中心 3 段パイプラインを導入する場合の境界を定義する。
- `spec/acceptance/kadomoco-desktop.feature`: 現在の Electron 育成アプリとしての受け入れ条件を Gherkin 形式で管理する。
- `spec/acceptance/source-network.feature`: 将来の情報源ネットワーク可視化体験を実装する前に、回答生成ではなく根拠構造探索を中心に置く受け入れ条件を管理する。

### Acceptance spec 案

```gherkin
Feature: KadoMoco desktop pet
  Scenario: Launch the desktop pet in development mode
    Given dependencies are installed
    When the developer runs "npm run dev"
    Then a frameless Electron window opens near the bottom-right of the screen
    And the pet is visible without requiring a web browser tab

  Scenario: Care actions update the pet state
    Given the pet menu is open
    When the user selects a care action
    Then the related vital values or current action are updated
    And the updated pet state is saved

  Scenario: Status panel shows progression
    Given the pet menu is open
    When the user opens the status panel
    Then level, EXP, vitals, personality, and daily tasks are displayed

  Scenario: Closing keeps the pet resident
    Given the Electron window is visible
    When the user closes the window without choosing quit
    Then the app hides the window
    And the tray icon can show it again
```

## 既知のギャップ / 未解決リスク

- 現在の実装は Electron / React / Vite のデスクトップ育成アプリであり、Next.js / Prisma / PostgreSQL / Vitest / Playwright / Vercel 構成ではありません。
- 現在の README は現行実装の説明であり、生成AI回答の情報源ネットワーク可視化アプリとしての仕様は未実装です。
- 自動テスト用の Vitest / Playwright はまだ導入されていないため、現時点の検証は `typecheck` / `lint` / `build` が中心です。
- Acceptance spec は README 内の追記案であり、実行可能な `.feature` ファイルとしてはまだ分離していません。
