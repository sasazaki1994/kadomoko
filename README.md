# KadoMoco v0.1

デスクトップの隅に住みつく小さな未分類生物を、作業の合間に少しずつ育てる常駐型ドット絵育成ゲームです。

- 1回の操作は5〜20秒で完結
- 1日3〜5回触れば進行するバランス
- 放置しても死亡・離脱・データ消失・重いペナルティなし

## 技術構成

Electron / React / Vite / TypeScript / Zustand / electron-store / CSS Animation

## セットアップ

```bash
npm install
npm run dev        # 開発起動(Electron ウィンドウが開きます)
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite + Electron の開発起動 |
| `npm run build` | 型チェック + 本番ビルド(dist / dist-electron) |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run test` | ゲームロジックの単体テスト |
| `npm run generate:sheet` | 仮スプライトシート PNG の再生成 |

## 操作

| 操作 | 動作 |
| --- | --- |
| 左クリック | リアクション |
| ダブルクリック | ステータスパネルの開閉 |
| 右クリック | メニュー(食べもの / ふれあう / 遊ぶ / 休ませる / ステータス・設定 / 記録 / 最前面 / 終了) |
| ドラッグ | ウィンドウ移動(位置は保存されます) |

閉じてもタスクトレイに常駐します。完全終了はトレイメニューまたは右クリックメニューの「終了」から行います。

## ディレクトリ

- `electron/` — メインプロセス(透明ウィンドウ・トレイ・保存・IPC)とプリロード
- `src/game/` — ゲームロジック(ステータス、時間経過、状態判定、レベル、日課、性格、イベント、季節)
- `src/game/data/` — バランス定数・テキスト等のデータ定義
- `src/store/` — Zustand ストア
- `src/components/` — UI コンポーネント
- `src/assets/pet/pixel/kadomoco_sheet.png` — スプライトシート(4列×8行、64px、現状は自動生成の仮素材)

スプライトシートは `scripts/generate-placeholder-sheet.mjs` が生成する仮素材です。本素材が用意できたら同じパス・同じ仕様(256×512、4列×8行、行順 = normal / happy / hungry / sleepy / sleeping / sulking / playing / curious)で差し替えてください。画像が存在しない場合も CSS フォールバック表示で動作します。

## 開発者モード

開発起動時のみ、ウィンドウ左上の「D」ボタンから DevTools パネルを開けます(ステータス変更・時間経過の疑似実行・日課操作・性格変更・イベント強制発生・セーブ初期化など)。本番ビルドでは表示されません。
