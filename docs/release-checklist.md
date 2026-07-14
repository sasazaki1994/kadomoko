# KadoMoco v0.1 リリース前チェックリスト

## 自動確認

- [ ] `npm ci` で依存関係をクリーンインストールできる
- [ ] `npm run generate:icons` で正式アイコンを再生成できる
- [ ] `npm run validate:icons` で正式アイコンを検証できる
- [ ] `build/` 配下の生成済みアイコンバイナリをコミットしていない
- [ ] `npm run licenses:generate` で第三者表記を再生成できる
- [ ] `npm run licenses:validate` で第三者ライセンス表記を検証できる
- [ ] `npm run check:release-version -- v0.1.0` でタグと package.json の整合性を検証できる
- [ ] `npm run typecheck` が成功する
- [ ] `npm run lint` が成功する
- [ ] `npm run test` が成功する
- [ ] `npm run validate:sprite` が成功する
- [ ] `npm run build` が成功する
- [ ] `npm run test:e2e` が成功する、またはGUIライブラリ不足として明示的にスキップされる
- [ ] `npm run package:win` でWindowsパッケージを生成できる
- [ ] `npm run verify:package:win` で成果物構成を検証できる

## Windows 10・11実機

- [ ] 初回起動できる
- [ ] 透明背景で表示される
- [ ] タスクバーに表示されない
- [ ] トレイに表示される
- [ ] 初期位置が右下になる
- [ ] ドラッグ移動できる
- [ ] ウィンドウ位置が保存される
- [ ] 右クリックメニューを開ける
- [ ] 左クリックでリアクションする
- [ ] ダブルクリックでステータスを開閉できる
- [ ] Escapeでメニューやパネルを閉じられる
- [ ] 食べもの、ふれあう、遊ぶ、休ませるの4種類の世話を実行できる
- [ ] ステータス表示を確認できる
- [ ] 日課の表示と進行を確認できる
- [ ] 夢・発見・集中・呼吸を確認できる
- [ ] 閉じる操作でトレイ格納される
- [ ] トレイから再表示できる
- [ ] 完全終了できる
- [ ] 再起動後にセーブが復元される
- [ ] アンインストール後もユーザーデータが保持される

## 表示環境

- [ ] 100%スケーリングで表示崩れがない
- [ ] 125%スケーリングで表示崩れがない
- [ ] 150%スケーリングで表示崩れがない
- [ ] 1920×1080で表示崩れがない
- [ ] ノートPC相当の小さい画面で画面外にはみ出さない
- [ ] 複数モニターで表示位置と復元が自然に動作する
- [ ] モニター切断後に画面外から復旧する
- [ ] タスクバー位置変更後も初期配置と拡張表示が画面内に収まる
- [ ] フルスクリーンアプリ使用時の控えめ設定を確認する

## 電源状態

- [ ] PCスリープ後もクラッシュしない
- [ ] スリープ復帰後に穏やかに復帰する
- [ ] 日付変更をまたいでも日課と進行が正常に更新される
- [ ] 12時間以上終了してから起動してもオフライン進行が上限内に収まる
- [ ] 集中セッション中のスリープで二重完了しない
- [ ] 集中セッション中のアプリ終了・再起動で二重完了しない

## 配布

- [ ] NSISインストーラーでインストールできる
- [ ] ZIP版を展開して直接起動できる
- [ ] 上書きインストールで既存セーブが維持される
- [ ] アンインストールできる
- [ ] Windows Defenderで重大な警告が出ないことを確認する
- [ ] SmartScreen表示の有無と文言を確認する
- [ ] 正式アイコンが設定されている
- [ ] バージョン情報がv0.1.0と一致する
- [ ] ライセンス表記が含まれる
- [ ] クレジット表記が含まれる
- [ ] リリースノートが準備されている
- [ ] GitHub Actions の Draft Release workflow が EXE / ZIP / SHA-256 / release notes を添付できる
- [ ] v0.1.0 タグを作成する前に `package.json` の version と一致している
- [ ] リポジトリ所有者が配布ライセンスを決定し、LICENSE / README / release notes / notices に反映している（未決定の間は公開ブロッカー）

## RC Qualification Kit

- [ ] Actions > RC Qualification を `ref=main` または検証対象コミットで手動実行する
- [ ] workflow が GitHub Release / tag / issue / PR を作成していないことを確認する
- [ ] `kadomoco-windows-rc-<version>-<short-sha>` artifact をダウンロードする
- [ ] EXE / ZIP / `.sha256` / `rc-manifest.json` / QAテンプレートが含まれることを確認する
- [ ] PowerShell の `Get-FileHash -Algorithm SHA256` で `.sha256` と `rc-manifest.json` の値を照合する
- [ ] `scripts/windows-rc-qa.ps1` を管理者権限なしで実行し、JSON結果を保存する
- [ ] `docs/qa/windows-rc-test-plan.md` に沿ってWindows実機QAを実施する
- [ ] `docs/qa/windows-rc-result-template.md` に結果を記録する
- [ ] `docs/qa/release-decision-template.md` で GO / GO WITH KNOWN LIMITATIONS / NO-GO を判定する
- [ ] `node scripts/check-project-license.mjs --require` が成功するまで、ライセンス未決定を公開ブロッカーとして扱う

RC Qualification workflow はタグなしで成果物を作る検証用です。Draft Release workflow は `v*.*.*` タグまたは指定タグを対象にドラフトGitHub Releaseを作るためのもので、公開前の最終段階でのみ使用します。
