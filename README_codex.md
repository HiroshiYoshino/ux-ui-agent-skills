# Codex環境への導入手順

このガイドは、HiroshiYoshino版 `ux-ui-agent-skills` をCodexプラグインとして導入するための日本語手順です。デザイントークン、コンポーネント仕様、アクセシビリティの知識と検証ツールを利用できます。

## 1. 必要な環境を確認する

- Git
- Node.js 20以上とnpm
- Python 3。Python製の検証ツールを実行する場合に必要です。
- `codex plugin` コマンドを利用できるCodex CLI

このリポジトリのCIはCodex CLI **0.164.0** で検証しています。以下はそのCLI向けの手順です。CodexデスクトップアプリとIDE拡張での導入・操作は、このPRでは検証していません。

ターミナルで次を確認してください。WindowsではPowerShellを利用できます。

```sh
git --version
node --version
npm --version
python3 --version
codex --version
codex plugin --help
```

Codex CLIをインストールしていない場合、CIと同じバージョンは次で導入できます。Codex自体のログインや初期設定は[OpenAI公式ガイド](https://developers.openai.com/learn/codex)を参照してください。

```sh
npm install --global @openai/codex@0.164.0
```

Windowsで`codex.ps1`や`npm.ps1`の実行が制限されている場合は、同じ引数で`codex.cmd`、`npm.cmd`を使えます。`python3`が見つからない場合はPythonのインストール先とPATHを確認してください。一部の検証ツールは`python3`というコマンド名でPythonを呼び出します。

## 2. このPRのプラグインを導入する

最初にリポジトリをマーケットプレイスとして登録し、そこからプラグインを追加します。

**PR #13のマージ前は、次のブランチ指定を含めて実行してください。** ブランチを省略すると既定ブランチを読み込むため、このPRのCodex対応版を取得できません。

```sh
codex plugin marketplace add HiroshiYoshino/ux-ui-agent-skills@copilot/copilotimplement-codex-plugin-support-fix
codex plugin add ux-ui-agent-skills-codex@hiroshiyoshino-ux-ui-agent-skills
codex plugin list
```

マージ後に既定ブランチから導入する場合は、最初のコマンドを次に置き換えられます。

```sh
codex plugin marketplace add HiroshiYoshino/ux-ui-agent-skills
```

| 項目 | 名前 |
|---|---|
| マーケットプレイス | `hiroshiyoshino-ux-ui-agent-skills` |
| プラグイン | `ux-ui-agent-skills-codex` |
| スキルの名前空間 | `ux-ui-agent-skills-codex:` |

`codex plugin list`で上記プラグインのインストール状態を確認してください。その後、**利用したいプロジェクトのディレクトリへ移動し、新しいCodexセッションを開始**します。

```sh
codex
```

プラグインには23個のスキルと`ux-ui-kit` MCPサーバーを含みます。インストール済みのスキルを確認し、最初に`ux-ui-agent-skills-codex:design-doctrine`、作業に応じて`design-screen`や`design-review`を利用するよう依頼してください。

依頼例:

```text
ux-ui-agent-skills-codex:design-doctrine と design-screen を使って、
このプロジェクトに設定画面を作成してください。
検証はこのプロジェクトのファイルに対して実行し、結果を報告してください。
```

導入時にリポジトリを手動でcloneしたり、スキルを生成したりする必要はありません。同じスキルを別途`.agents/skills`へコピーすると二重に表示されるため、プラグイン経由で利用します。

## 3. 画面をブラウザで検証できるようにする

プラグインの導入だけでは、利用先プロジェクトの依存パッケージやブラウザはインストールされません。ブラウザ検証を使う場合は、**利用先プロジェクトのルート**で準備します。以下はnpmを使うプロジェクトの例です。

```sh
npm install --save-dev playwright
npx playwright install chromium chrome
```

pnpmやYarnを使うプロジェクトでは、そのプロジェクトのパッケージ管理方法に合わせてください。

Codexには次の条件で検証を実行するよう依頼してください。

- 実行する作業ディレクトリは利用先プロジェクトにする。
- 検証対象のトークン、ソース、HTMLには利用先プロジェクトのパスを指定する。
- `DS_REQUIRE_BROWSER=1`を設定し、ブラウザ不足を成功として扱わない。
- 別のディレクトリから起動する場合は、`UX_UI_PROJECT_ROOT`に利用先プロジェクトの絶対パスを設定する。
- MCPの`run_gate`、`review_ui`では、`project_root`と検証対象に絶対パスを渡す。

PowerShellで環境変数を設定する例です。パスは自分のプロジェクトに置き換えてください。

```powershell
Set-Location 'C:\work\my-project'
$env:DS_REQUIRE_BROWSER = '1'
$env:UX_UI_PROJECT_ROOT = (Get-Location).Path
codex
```

## 4. 利用時の注意

- このCodexプラグインはClaude Code用のフックを有効にしません。編集後の自動検証や、未検証のまま終了することを防ぐ仕組みはありません。検証ツールを明示的に実行してください。
- Claude専用の`critique`、`observe`、`scaffold-project`は含みません。利用できる範囲は[Codexプラグイン仕様](docs/CODEX-PLUGIN.md)を参照してください。
- `scripts/accuracy_report.mjs`は、このキット自身の総合自己テストです。利用先プロジェクトの品質確認には、個別の検証ツールをそのプロジェクトのファイルに対して実行してください。
- Windowsで利用するために、Gitのグローバル設定やスキルの改行コードを変更する必要はありません。
- `npx ux-ui-agent-skills init --agent codex`は、公開npmパッケージから`AGENTS.md`などを配置する別の導入方法です。このPRのプラグインを導入するコマンドではありません。詳細は[AGENTS.md方式の手順](docs/AGENTS-SETUP.md)を参照してください。

## 5. 更新と削除

配布側でプラグインのバージョンが更新された場合、マーケットプレイスを更新して再追加します。その後、新しいCodexセッションを開始してください。

```sh
codex plugin marketplace upgrade
codex plugin add ux-ui-agent-skills-codex@hiroshiyoshino-ux-ui-agent-skills
```

削除する場合:

```sh
codex plugin remove ux-ui-agent-skills-codex@hiroshiyoshino-ux-ui-agent-skills
codex plugin marketplace remove hiroshiyoshino-ux-ui-agent-skills
```

## 関連資料

- [プラグインの詳細・検証済み範囲](docs/CODEX-PLUGIN.md)
- [リポジトリ全体の導入ガイド](docs/INSTALL.md)
- [テストの実行方法](tests/README.md)
- [OpenAI公式のプラグイン・マーケットプレイス仕様](https://developers.openai.com/plugins/build/plugins)

この手順はリポジトリのCLIテストとOpenAI公式ドキュメントを参照して作成しています。公式ドキュメントは更新されるため、CLIの操作が異なる場合は`codex plugin --help`を確認してください。
