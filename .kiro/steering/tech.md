# 技術スタック

## 構成

- **バニラ HTML / CSS / JavaScript** — フレームワーク・ライブラリなし
- **ビルドツールなし** — トランスパイル・バンドル不要
- **バックエンドなし** — すべてブラウザ内で完結。永続化もサーバー通信もしない

## コードの置き場所

- `index.html` — マークアップ + CSS（`<style>` にインライン）
- `app.js` — アプリロジック全体（状態管理・計算・DOM描画・イベント）
- CSS は `index.html` 内の `<style>` に集約。別ファイルには分けていない

## JavaScript の方針

- 型注釈は JSDoc（`@typedef` / `@param` / `@returns`）で表現。TypeScript は使わない
- グローバル状態は単一オブジェクト `AppState`（`members` / `payments` / `settlements`）で管理
- ブラウザ標準APIを使う（`crypto.randomUUID()`、`document.*`、`Map` など）
- ユーザー入力は `escapeHtml()` を通してからDOMに挿入する（XSS対策）

## 動かし方

ビルド不要。ファイルを直接開く。

```
open index.html
```

## 構文チェック

Node.js の `node --check` で構文を検証する（`.js` 保存時にフックが自動実行）。
ESLint 等のリンターは未導入（`package.json` なし）。

```
node --check app.js
```

## 制約

- 外部ライブラリを安易に追加しない。必要になった場合も CDN / 単一ファイルで完結する方法を優先する
- バックエンド・ネットワーク通信を前提とした実装を入れない（オフライン動作が要件）
