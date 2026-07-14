# KadoMoco v0.1

KadoMoco は、デスクトップの隅に住みつく小さな未分類生物を、作業の合間に少しずつ見守る常駐型ドット絵育成アプリです。

- 1回の操作は 5〜20 秒で完結
- 1日 3〜5 回触れば進行するバランス
- 放置しても死亡・永久離脱・重いペナルティはありません

## バージョン

- アプリバージョン: `package.json` の `version`（v0.1.0）
- セーブデータバージョン: `src/game/saveData.ts` の `CURRENT_SAVE_VERSION`（内部互換用）

アプリのリリース番号とセーブデータの移行番号は別物です。旧セーブは起動時に段階的に補完され、壊れた主セーブはバックアップから復旧を試みます。

## 技術構成

Electron / React / Vite / TypeScript / Zustand / electron-store / CSS Animation

## セットアップと起動

```bash
npm ci
npm run dev
```

## 品質確認コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run test` | ゲームロジックと保存移行の Node.js テスト |
| `npm run build` | スプライト検証 + 型チェック + 本番ビルド |
| `npm run test:e2e` | 本番ビルド後に Electron の最小 E2E スモークテストを実行 |
| `npm run package:win` | Windows NSIS / ZIP パッケージを `release/` に生成 |

## 操作

| 操作 | 動作 |
| --- | --- |
| 左クリック | 短いリアクション |
| ダブルクリック | ステータスパネルの開閉 |
| 右クリック | 世話・記録・集中・呼吸・終了メニュー |
| Escape | 開いているメニューやパネルを閉じる |
| ドラッグ | ウィンドウ移動（位置は保存） |

閉じるボタンでは終了せず、トレイ常駐として非表示になります。完全終了はトレイメニューまたは右クリックメニューの「終了」から行います。

## 実装済み機能

- 4種類の基本世話（食べもの / ふれあう / 遊ぶ / 休ませる）
- ステータス、レベル、日課、性格、観察表示
- 記録パネル、日誌、エピソード、週のふりかえり
- 夢のかけら、発見イベント、ひみつの合図、小さな遊び
- いっしょに深呼吸、いっしょに集中
- 透明・フレームレス・小型 Electron ウィンドウ
- セーブデータのサニタイズ、段階移行、バックアップ復旧

## スプライト生成・検証仕様

`src/assets/pet/pixel/kadomoco_sheet.png` は、正式素材の入力ファイル `assets/source/kadomoco-generated-magenta.png.base64` から生成する本番用スプライトシートです。生成 PNG は直接編集せず、見た目を変える場合は入力素材または `scripts/prepare-production-sprite-sheet.mjs` の生成処理を更新してください。

- 生成元: `assets/source/kadomoco-generated-magenta.png.base64`
- 生成先: `src/assets/pet/pixel/kadomoco_sheet.png`
- プレビュー成果物: `artifacts/kadomoco_sheet_preview.png` / `artifacts/kadomoco_sprite_preview.html`
- PNG 形式: RGBA 透過 PNG
- 寸法: 256×512px
- グリッド: 4列×8行、1フレーム 64×64px、全32フレーム
- 各状態: 4フレーム
- 行順: `normal` / `happy` / `hungry` / `sleepy` / `sleeping` / `sulking` / `playing` / `curious`

生成と検証は以下で実行します。

```bash
npm run prepare:sheet
npm run validate:sprite
```

`npm run build` は `prepare:sheet` と `validate:sprite:check` を先に実行してから型チェックと Vite 本番ビルドを行うため、配布用アセットはビルド時にも再生成・再検証されます。本番ビルドでは Vite の asset import によりスプライトが `dist/assets/` へ含まれます。アプリ側の表示は `image-rendering: pixelated` を指定した `PetCharacter` のスプライト表示を優先し、素材が読み込めない場合のみ CSS フォールバックへ切り替わります。

`validate:sprite` は `prepare:sheet` 実行後に以下を検査します。

- ファイル存在、PNG 読み込み、RGBA PNG（color type 6）であること
- 256×512px、4列×8行、64×64px セルであること
- 四隅が透明で、全32セルが空でないこと
- 透明背景化後に不透明なマゼンタ背景色が過剰に残っていないこと
- 完全に同一のセルがある場合は警告すること

入力素材を差し替える場合は、マゼンタ背景の PNG を base64 化して `assets/source/kadomoco-generated-magenta.png.base64` を更新し、`npm run prepare:sheet` で生成結果と `artifacts/` のプレビューを確認してから `npm run validate:sprite` と `npm run build` を実行してください。行順やセル寸法を変更する場合は、`src/game/spriteSheetSpec.json`、生成処理、実装側の状態マッピング、README を同時に更新してください。

## セーブデータ

`electron-store` を使い、OS 標準のアプリデータ領域に保存します。主データ名は `kadomoco-save`、バックアップは `kadomoco-save-backup` です。主セーブが壊れている場合はバックアップ、両方が壊れている場合は初期データで安全に起動します。

Windows の通常インストール版・ZIP版とも Electron の `userData` 配下を使います。アンインストーラー設定では `deleteAppDataOnUninstall: false` とし、ユーザーデータは自動削除しません。

## Windows 配布

```bash
npm run package:win
```

`release/` に NSIS インストーラーと ZIP を生成します。設定は `package.json` の `build` セクションで管理します。

Windows ビルドは `build/icon.ico` をアプリ／インストーラーアイコンとして使用し、`build/tray-icon.png` を `extraResources` として同梱してトレイアイコンに使用します。

配布前チェック:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test`
5. `npm run build`
6. `npm run test:e2e`（GUI 実行可能な環境）
7. Windows runner で `npm run package:win`
8. NSIS / ZIP の起動、保存復元、終了、アンインストール時のユーザーデータ保持を確認

## 開発者 UI

開発起動時のみ左上の `D` ボタンから DevTools パネルを開けます。本番ビルドでは表示されません。

## v0.1.0 Release Candidate resources

- Install / uninstall guide: [`docs/install-and-uninstall.md`](docs/install-and-uninstall.md)
- Release notes: [`docs/release-notes-v0.1.0.md`](docs/release-notes-v0.1.0.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- License decision status: [`docs/licensing-decision.md`](docs/licensing-decision.md)
- Credits: [`CREDITS.md`](CREDITS.md)
- Third-party notices: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- Bug reports: use the GitHub issue template and avoid attaching raw save data or personal information.

## App icon generation

Official app icons are generated from the first `normal` frame in `src/assets/pet/pixel/kadomoco_sheet.png`.

```bash
npm run generate:icons
npm run validate:icons
```

Generated outputs are intentionally ignored by Git and should be regenerated in CI/build jobs instead of committed as binary files:

- `build/icon.ico` for Windows app and installer packaging
- `build/tray-icon.png` for the Electron tray in development and packaged builds
- `build/icon.png` for README and release pages

The icon validator checks file presence, non-empty files, PNG transparency, ICO structure and sizes, Electron-builder-compatible PNG-backed ICO entries, and absence of opaque development magenta.

## Third-party notices

Production dependency notices are generated from `package-lock.json` plus installed package metadata:

```bash
npm run licenses:generate
npm run licenses:validate
```

Unknown dependency licenses fail validation and must be resolved before release.

## Release workflow

`.github/workflows/release.yml` runs on `v*.*.*` tags or manual dispatch. It validates that the tag name matches `package.json` (`v0.1.0`), runs sprite, icon, license, typecheck, lint, unit, build, Electron E2E, Windows packaging, and package verification, generates SHA-256 checksum files for the EXE and ZIP, then creates a **Draft** GitHub Release with the artifacts and release notes attached. The workflow uses `contents: write` only because `gh release create` needs permission to create the draft release and upload assets. It does not publish the release automatically and this change does not create a tag.
