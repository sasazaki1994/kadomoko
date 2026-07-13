# KadoMoco v0.1 現行仕様と起動手順

この文書は、現在の Electron デスクトップアプリとしての KadoMoco を説明します。過去の別構想（Next.js、Prisma、PostgreSQL、生成AI情報源ネットワーク等）は現行実装の説明から除外しています。

## 目的

KadoMoco は「邪魔にならない相棒」です。小さな透明ウィンドウで常駐し、短い世話・記録・集中のきっかけを提供します。死亡、永久離脱、強い失敗表現はありません。

## 主要仕様

- Electron の透明・フレームレス・小型ウィンドウとして起動
- 通常時 180×180px、パネル表示時は安全な拡張サイズへ変更
- 右クリックメニュー、ステータス、記録、呼吸、集中を提供
- 閉じる操作は終了ではなく非表示。終了は明示操作のみ
- ゲームロジックは `src/game/`、UI は `src/components/`、永続化と OS 連携は `electron/` に分離
- renderer へ Node API は直接公開せず、preload の IPC 経由に限定

## セーブと互換性

- アプリバージョンは `package.json` の `version`
- セーブデータバージョンは `CURRENT_SAVE_VERSION`
- 旧バージョンのセーブは `migrateSave` と各 sanitize 関数で段階的に補完
- 主セーブ破損時はバックアップを使用し、両方破損時もクラッシュせず初期データで起動
- オフライン進行は最大12時間で打ち切り

## スプライト仕様

正式素材は `src/assets/pet/pixel/kadomoco_sheet.png` に配置します。

- PNG / 256×512px / 4列×8行 / 64×64px フレーム
- 行順: normal, happy, hungry, sleepy, sleeping, sulking, playing, curious
- 表示設定は `src/game/spriteSheet.ts` に集約
- `npm run validate:sprite` で存在、PNG、サイズを検証
- `image-rendering: pixelated` と `prefers-reduced-motion` に対応

## 起動・テスト・ビルド

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run package:win
```

`test:e2e` は本番ビルド後に Electron を起動する最小スモークテストです。ヘッドレス制約がある Linux 環境では失敗することがあるため、CI の通常品質ゲートは typecheck / lint / test / build、Windows 配布検証は Windows runner で行います。

## Windows 配布方針

- `electron-builder` で NSIS と ZIP を生成
- 出力先は `release/`
- appId は `com.kadomoco.app`
- productName と実行ファイル名は `KadoMoco`
- 正式アイコンは未同梱。用意できたら `build/icon.ico` を追加し、`build.win.icon` に指定
- ユーザーデータはアンインストール時に自動削除しない

## 受け入れ仕様

Gherkin 形式の受け入れ仕様は `spec/acceptance/kadomoco-desktop.feature` に置きます。起動、世話、保存復元、トレイ格納、配布、夢・発見・集中などを現行実装に合わせて管理します。

## 今後の予定

- 正式スプライトと正式アイコンの投入
- Windows 実機での NSIS / ZIP 起動検証
- E2E シナリオの段階的拡充（メニュー操作、保存復元、終了 IPC など）
