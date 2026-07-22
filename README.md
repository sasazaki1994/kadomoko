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
| `npm run release:check` | OS非依存のv0.1.0リリースゲートを順次実行し、JSON / Markdownレポートを生成 |
| `npm run release:check -- --include-e2e` | GUIを利用できる環境でElectron E2Eも含めて実行 |
| `npm run release:check:win` | WindowsでE2E、NSIS / ZIP生成、パッケージ検証まで統合実行 |

統合ゲートは失敗した工程で停止し、後続工程を `not-run` として `artifacts/release-readiness.json` と `artifacts/release-readiness.md` に記録します。自動検証はWindows実機QAを完了扱いにせず、`manualQaStatus` は証拠を伴う手動更新まで `not-tested` のままです。

Electron main process はセーブのJSON安全性・1 MiB上限・save version、設定allowlist、boolean、共有`WINDOW_SPEC`範囲を純粋関数で検証します。不正IPCは短いエラーで拒否され、既存値を変更しません。Zustandの安定した公開入口は`src/store/usePetStore.ts`、構成実装は`createPetStore.ts`、通常保存タイマーの唯一の所有者は`persistence/saveScheduler.ts`です。公開store APIとE2E bridgeは変更していません。

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
- 通常180×180px、パネル表示時240×240pxの共有ウィンドウ仕様
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
2. OS非依存環境では `npm run release:check`（GUI利用可能時は `-- --include-e2e`）
3. Windows runner では `npm run release:check:win`
4. 生成されたリリース準備レポートを保存
5. NSIS / ZIP の起動、保存復元、終了、アンインストール時のユーザーデータ保持を実機確認

## 開発者 UI

開発起動時のみ左上の `D` ボタンから DevTools パネルを開けます。本番ビルドでは表示されません。

## v0.1.0 Release Candidate resources

- Install / uninstall guide: [`docs/install-and-uninstall.md`](docs/install-and-uninstall.md)
- Release notes: [`docs/release-notes-v0.1.0.md`](docs/release-notes-v0.1.0.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- License decision record: [`docs/licensing-decision.md`](docs/licensing-decision.md)
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

`.github/workflows/release.yml` runs on `v*.*.*` tags or manual dispatch. Its Windows job runs `release:check:win` with the requested tag, generates SHA-256 checksum files for the EXE and ZIP, then creates a **Draft** GitHub Release with the packages, checksums, release notes, and readiness reports attached. `contents: write` is scoped to that draft-release job only. It does not publish the release automatically and this change does not create a tag.

## RC Qualification workflow

Use **Actions > RC Qualification** to qualify a branch, commit, or tag without creating a Git tag, GitHub Release, issue, or PR. Inputs are:

- `ref`: target branch, commit, or tag; default `main`.
- `artifact-retention-days`: uploaded artifact retention; default `14`.
- `run-e2e`: whether to run Electron E2E; default `true`.

The workflow uploads `kadomoco-windows-rc-<version>-<short-sha>` containing the Windows NSIS EXE, ZIP, `.sha256` files, `rc-manifest.json`, readiness JSON / Markdown reports, and a QA result template. This differs from the Draft Release workflow: RC Qualification is for private qualification artifacts only, while Draft Release validates a version tag and creates a draft GitHub Release.

After downloading the RC artifact, verify checksums on Windows PowerShell:

```powershell
Get-FileHash .\KadoMoco-0.1.0-x64.exe -Algorithm SHA256
Get-FileHash .\KadoMoco-0.1.0-x64.zip -Algorithm SHA256
```

Run the Windows QA helper without administrator privileges:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-rc-qa.ps1 `
  -ArtifactDirectory .\release `
  -ReportPath .\qa-results\windows-rc-result.json
```

Add `-LaunchSmoke` only when you want to confirm the ZIP app process starts and does not immediately exit; the script does not force-terminate the app. Use [`docs/qa/windows-rc-test-plan.md`](docs/qa/windows-rc-test-plan.md), [`docs/qa/windows-rc-result-template.md`](docs/qa/windows-rc-result-template.md), and [`docs/qa/release-decision-template.md`](docs/qa/release-decision-template.md) for manual QA and release judgement.

既定30分の非破壊性能測定（管理者権限不要、アプリを終了せず、セーブ非変更）は次の通りです。2時間以上の例では`-DurationMinutes 120`へ変更します。JSON/Markdownは重複しない名前で`qa-results/`へ生成され、CPUとWorking Setの平均・中央値・最小・最大、メモリ差、予期しない終了を記録します。Windows実機以外では未実施として扱います。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-performance-soak.ps1 `
  -DurationMinutes 30 -SampleIntervalSeconds 10 -OutputDirectory '.\qa-results'
```

v0.1.0は署名secretが設定されない限り未署名で、SmartScreen警告が発生し得ます。`Get-AuthenticodeSignature .\KadoMoco-0.1.0-x64.exe`とSHA-256 manifestを確認してください。署名必須検証は`$env:KADOMOCO_REQUIRE_CODE_SIGNING='1'`で有効化し、証明書は`CSC_LINK`/`CSC_KEY_PASSWORD`のCI secretsだけに置きます。詳細は[`docs/code-signing-decision.md`](docs/code-signing-decision.md)を参照してください。実機QA JSONを現在commitの証跡として読む場合だけ`KADOMOCO_MANUAL_QA_REPORT`を指定し、性能証跡は`KADOMOCO_PERFORMANCE_REPORT`でレポートへ関連付けます。

## License

KadoMoco is proprietary software. Copyright © 2026 sasazaki1994. All Rights Reserved. This applies to the game code and original materials, including its characters, artwork, sprites, icons, logos, text, and audio.

Public access to this repository—and GitHub's ordinary repository viewing or forking functionality—does not grant permission to reuse the copyrighted work. Publishing or selling forked code as another product, or copying, modifying, redistributing, selling, or using KadoMoco code, assets, names, logos, or brand elements in another product without prior express written permission is prohibited.

Third-party dependencies remain subject to their respective licenses; those licenses apply only to the relevant third-party components and do not license KadoMoco itself. See [`LICENSE`](LICENSE) for the terms applicable to KadoMoco and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for dependency notices.

## Binary asset safety

The production sprite `src/assets/pet/pixel/kadomoco_sheet.png` is ignored generated output rather than a committed binary, because the review transport does not support binary patches. It is recreated deterministically by `prepare:sheet` and must not be edited directly. Update the canonical Base64 source at `assets/source/kadomoco-generated-magenta.png.base64`, then regenerate and verify all assets with:

```bash
npm run prepare:assets
npm run build
```

Do not copy, replace, or transform PNG/ICO files as text. Text-based automated fix tools (including automated review fixes) must not modify binary assets; reject such changes and regenerate through the documented pipeline instead. Asset changes must pass sprite signature, decoding, dimensions, transparency, icon validation, before merge. The canonical Base64 source is the reviewable, committed representation of the sprite.
