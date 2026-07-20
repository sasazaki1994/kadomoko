# KadoMoco v0.1 現行仕様と起動手順

この文書は、現在の Electron デスクトップアプリとしての KadoMoco を説明します。過去の別構想（Next.js、Prisma、PostgreSQL、生成AI情報源ネットワーク等）は現行実装の説明から除外しています。

## 目的

KadoMoco は「邪魔にならない相棒」です。小さな透明ウィンドウで常駐し、短い世話・記録・集中のきっかけを提供します。死亡、永久離脱、強い失敗表現はありません。

## 主要仕様

- Electron の透明・フレームレス・小型ウィンドウとして起動
- 通常時 180×180px、パネル表示時 240×240px。値は `src/shared/windowSpec.ts` からmain / renderer / E2Eで共有
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
npm run release:check
npm run release:check:win
```

`release:check` はOS非依存の素材・ライセンス・バージョン・型・Lint・単体テスト・ビルドを一つのレポートへ統合します。GUIを利用できるLinuxでは `-- --include-e2e`、Windowsでは `release:check:win` を使い、E2Eと配布物検証まで同じレポートへ含めます。

## Windows 配布方針

- `electron-builder` で NSIS と ZIP を生成
- 出力先は `release/`
- appId は `com.kadomoco.app`
- productName と実行ファイル名は `KadoMoco`
- 正式アイコンはスプライトから再生成し、`build/icon.ico` と `build/tray-icon.png` を配布ビルドへ使用
- ユーザーデータはアンインストール時に自動削除しない

## 受け入れ仕様

Gherkin 形式の受け入れ仕様は `spec/acceptance/kadomoco-desktop.feature` に置きます。起動、世話、保存復元、トレイ格納、配布、夢・発見・集中などを現行実装に合わせて管理します。

## いっしょに集中

作業を邪魔せずに短い区切りを作る「いっしょに集中」を提供します。

- 右クリックメニューから 10 分または 25 分を選び、すぐに集中時間を始められます。詳細パネルを閉じても期限は保存されたまま進み、小さな残り時間を押すと現在時刻から計算した表示へ戻れます。
- 集中中は通常のペット表示とクリック・世話・文脈アクションを保ちます。直接操作の反応は通常どおり使えますが、自発的な会話・発見・小さな遊びとその終了反応だけは完了まで静かになります。
- 完了時は短い吹き出しと小さな反応だけを表示し、最初の 1 日 3 回には機嫌 +3 / なつき +1 / EXP +3 の控えめな報酬があります。
- 途中で終えてもペナルティや失敗表現はなく、その日の完了回数にも含めません。
- 開始時刻・終了時刻・直近の時刻確認点を保存するため、通常動作、PC 復帰、アプリ再起動のいずれでも終了時刻を過ぎていれば一度だけ完了します。完了状態はすぐに保存し、主セーブとバックアップの両方が未完了状態を再生しないよう更新します。
- 報酬回数は完了時のローカル日付で数えます。直近 366 日分を上限付きで保持するため、日付またぎでは翌日分として扱い、時計を戻しても同じ日付の報酬上限は再開放されません。時計を戻した場合は直近の確認点を基準に残り時間を保ち、時計が期限より先へ進んだ場合は一度だけ完了します。
- 集中パネルは 240 × 240 の既存拡張ウィンドウ内でスクロール可能に収まり、ダイアログ内のフォーカス移動、Tab / Shift+Tab、Escape、読み上げ用のタイマー名に対応します。
- セーブデータは v9 に上げ、v8 以前の旧データには `pet.focusSessions` を安全に補い、既存のバイタル・進行・記録・設定を保持します。破損した集中状態は上限付きでサニタイズします。

## 今後の予定

- 正式スプライトと正式アイコンの投入
- Windows 実機での NSIS / ZIP 起動検証
- E2E シナリオの段階的拡充（メニュー操作、保存復元、終了 IPC など）
