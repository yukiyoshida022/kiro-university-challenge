# Design Document: 割り勘計算 Web アプリ（warikan-calculator）

## Overview

グループ旅行・飲み会などで複数人が立て替えた費用を精算するためのクライアントサイド完結型 Web アプリ。
バックエンドサーバー不要、外部ライブラリ不要。HTML/CSS/JavaScript のみで構成し、GitHub Pages に静的ファイルとしてデプロイする。

### 技術的な方針

- 純粋な HTML/CSS/JavaScript（ES2020+、バンドラー・フレームワーク不使用）
- ビルドステップなし。ファイルをそのままブラウザで開けば動作する
- GitHub Pages へは `main` ブランチのリポジトリルートを直接公開
- オフライン完全動作（外部フォントや CDN 参照なし）

---

## Architecture

### ファイル構成

```
warikan-calculator/
├── index.html      # アプリ全体のエントリーポイント。HTML構造・CSSインライン
├── app.js          # アプリケーションロジック全体（状態管理・計算・UI更新）
└── README.md       # GitHub Pages URL と使い方
```

単一 HTML ファイルに完結させることも可能だが、テスタビリティのため HTML と JS は分離する。
CSS は `<style>` タグで `index.html` にインラインで定義する（外部 CSS ファイル不要）。

### データフロー

```
ユーザー操作（DOM イベント）
  ↓
イベントハンドラ（app.js）
  ↓
State 更新（純粋オブジェクト操作）
  ↓
計算関数呼び出し（Balance計算 / Settlement生成）
  ↓
UI 再レンダリング（DOM 更新）
```

状態はグローバルな `AppState` オブジェクト1つで管理する。フレームワーク的なリアクティビティは持たせず、状態更新後に手動で描画関数を呼ぶシンプルな構造とする。

---

## Components and Interfaces

### UI コンポーネント構成

```
┌─────────────────────────────────────────────┐
│  Header（タイトル・リセットボタン）            │
├─────────────┬───────────────────────────────┤
│  Member     │  Payment                       │
│  Panel      │  Panel                         │
│  ─────────  │  ───────────────────────────   │
│  名前入力   │  支払者 / 金額 / 用途 / 対象者  │
│  追加ボタン │  追加ボタン                    │
│  ─────────  │  ───────────────────────────   │
│  Member     │  Payment                       │
│  List       │  List                          │
│  （削除可）  │  （削除可）                    │
├─────────────┴───────────────────────────────┤
│  Balance Panel（残高一覧）                    │
├─────────────────────────────────────────────┤
│  Settlement Panel（精算結果）                │
│  「精算を計算する」ボタン                     │
└─────────────────────────────────────────────┘
```

### 主要な関数インターフェース

```javascript
// 状態管理
function addMember(name: string): Result
function removeMember(id: string): void
function addPayment(payment: PaymentInput): Result
function removePayment(id: string): void
function resetAll(): void

// 計算
function calculateBalances(members: Member[], payments: Payment[]): Balance[]
function calculateSettlements(balances: Balance[]): Settlement[]

// UI
function render(): void
function renderMembers(): void
function renderPayments(): void
function renderBalances(): void
function renderSettlements(): void
```

`Result` 型は `{ ok: true }` または `{ ok: false, error: string }` のユニオン。

---

## Data Models

### AppState（グローバル状態）

```javascript
const AppState = {
  members: Member[],    // 登録済みメンバーリスト
  payments: Payment[],  // 登録済み支払いリスト
  settlements: Settlement[] | null  // null = 未計算
};
```

### Member

```javascript
{
  id: string,       // crypto.randomUUID() で生成
  name: string      // 表示名（トリム済み）
}
```

### Payment

```javascript
{
  id: string,       // crypto.randomUUID() で生成
  payerId: string,  // 支払者の Member.id
  amount: number,   // 金額（正の整数 or 小数。内部では円単位整数に丸める）
  description: string,   // 用途（任意文字列）
  targetIds: string[]    // 割り勘対象の Member.id 配列。空なら全員
}
```

### Balance

```javascript
{
  memberId: string,
  memberName: string,
  amount: number    // 正=受取超過、負=支払い超過（単位: 円）
}
```

### Settlement

```javascript
{
  payerId: string,
  payerName: string,
  receiverId: string,
  receiverName: string,
  amount: number    // 送金額（正の整数、単位: 円）
}
```

---

## Minimum Transfers Algorithm

### 残高計算ロジック

各 Payment に対して：

1. `targetIds` が空なら全 Member を対象とする
2. 対象 Member 数を `n` とする
3. 均等割り当て: `base = Math.floor(amount / n)`
4. 端数: `remainder = amount - base * n`
5. 最初の `remainder` 人に `base + 1` 円、残りに `base` 円を負担させる（切り捨て＋先頭への端数加算）
6. 支払者 (payer) の Balance に `amount` 加算、各対象者の Balance から各人の負担額を減算

**端数処理方針: 切り捨て（Math.floor）＋先頭メンバーへの端数加算**
- 例: 3人で1000円 → 333, 333, 334円（最後の1人が端数を負担）
- 全 Balance 合計は常に0になる

### Minimum Transfers アルゴリズム（貪欲法）

```
Input: Balance[] （合計が0であることが前提）
Output: Settlement[]

1. positives = Balance が正のメンバーリスト（降順ソート）
2. negatives = Balance が負のメンバーリスト（絶対値降順ソート）
3. while positives と negatives が両方非空:
   a. max_receiver = positives[0]（最大の受取超過）
   b. max_payer   = negatives[0]（最大の支払い超過）
   c. transfer = min(max_receiver.amount, abs(max_payer.amount))
   d. Settlement を追加: max_payer → max_receiver: transfer円
   e. max_receiver.amount -= transfer
      max_payer.amount    += transfer
   f. amount が 0 になった要素をリストから除外
4. return Settlements
```

**計算量**: O(n log n)（ソート）、n はメンバー数  
**最小性の保証**: 各ステップで少なくとも一方のメンバーが完全に精算されるため、送金回数は max(正の件数, 負の件数) 以下になる。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 有効な名前はメンバーリストに追加される

*For any* 空白のみでない文字列をメンバー名として追加したとき、追加後のメンバーリストはその名前のメンバーを含んでいなければならない。

**Validates: Requirements 1.2**

---

### Property 2: 空白のみの名前は拒否される

*For any* 空白文字（スペース・タブ・改行等）のみで構成された文字列は、メンバー追加時に拒否され、メンバーリストは変化しない。

**Validates: Requirements 1.3**

---

### Property 3: 重複名は拒否される

*For any* メンバーリストと、そのリストに既に存在する名前に対して、同じ名前の追加は拒否され、リストのサイズは変化しない。

**Validates: Requirements 1.4**

---

### Property 4: メンバー削除時に関連 Payment も消える

*For any* メンバーリストと Payment リストに対して、あるメンバーを削除したとき、そのメンバーが支払者または対象者として含まれる Payment がすべて削除される。

**Validates: Requirements 1.5**

---

### Property 5: 対象者未指定は全員対象と等価

*For any* メンバーリストに対して、対象者を空で Payment を登録した場合と、全メンバーを明示的に対象者に指定して登録した場合で、残高計算の結果は等しい。

**Validates: Requirements 2.2**

---

### Property 6: 無効な金額は拒否される

*For any* 0以下の数値または数値として解釈できない文字列を金額として入力したとき、Payment は登録されず、Payment リストは変化しない。

**Validates: Requirements 2.3**

---

### Property 7: 全 Balance の合計は常に0

*For any* メンバーリストと Payment リスト（1件以上、各 Payment の金額は正の整数）に対して、`calculateBalances` が返す全 Balance の合計は0（丸め誤差を除く）でなければならない。

**Validates: Requirements 3.4, 3.5**

---

### Property 8: Settlement が全 Balance を解消する

*For any* Balance リスト（合計が0）に対して、`calculateSettlements` が返す Settlement を全て実行したとき、全 Member の残高が0になる。

**Validates: Requirements 4.1**

---

### Property 9: Payer と Receiver は常に異なる

*For any* Balance リストに対して生成された Settlement において、Payer と Receiver が同一の Member である Settlement は存在しない。

**Validates: Requirements 4.6**

---

### Property 10: リセット後は空の初期状態になる

*For any* アプリの状態（任意のメンバー・Payment が登録済み）に対して、リセットを実行すると `members` と `payments` がともに空の配列になる。

**Validates: Requirements 5.1**

---

## Error Handling

| 操作 | エラー条件 | 対応 |
|---|---|---|
| メンバー追加 | 名前が空/空白のみ | インラインエラーメッセージ表示、追加しない |
| メンバー追加 | 同名が既に存在 | 「〇〇は既に追加されています」エラー表示 |
| Payment 追加 | 金額が0以下・非数値 | エラーメッセージ表示、登録しない |
| Payment 追加 | 支払者が未選択 | エラーメッセージ表示、登録しない |
| 精算計算 | メンバーが1人以下 | 「2人以上のメンバーが必要です」エラー表示 |
| リセット | ユーザー操作 | `confirm()` ダイアログで確認後に実行 |

- エラーメッセージは操作フォームの近くにインラインで表示する
- 次の有効な操作時にエラーメッセージをクリアする

---

## Testing Strategy

### 単体テスト（Example-based）

対象: 純粋関数（`calculateBalances`, `calculateSettlements`, バリデーション関数）

- Node.js + `node:test` または Vitest（ゼロ設定で動作）
- 具体的なシナリオを網羅する（2人均等割り、3人割り切れない、全員精算済みなど）
- エラーケースの境界値（金額=0、金額=1、金額=負数）

### プロパティベーステスト（Property-based）

対象: 上記 Correctness Properties 10件

ライブラリ: **fast-check**（JavaScript/TypeScript 向け PBT ライブラリ、npm 不要なら CDN で利用可）

各プロパティのテスト設定:
- 最低 **100 iterations** で実行
- タグコメント: `// Feature: warikan-calculator, Property N: <property_text>`

テスト対象プロパティと使用する Generator:

| Property | Generator |
|---|---|
| P1: 有効名追加 | `fc.string().filter(s => s.trim().length > 0)` |
| P2: 空白名拒否 | `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` |
| P3: 重複名拒否 | メンバーリスト + その中から名前を選択 |
| P4: 削除時Payment削除 | メンバーリスト + Paymentリスト |
| P5: 対象者省略=全員 | メンバーリスト + 金額 |
| P6: 無効金額拒否 | `fc.oneof(fc.integer({max: 0}), fc.string())` |
| P7: Balance合計=0 | メンバーリスト + Paymentリスト（正の金額） |
| P8: Settlement完全解消 | Balance配列（合計=0になるよう生成） |
| P9: Payer≠Receiver | Balance配列 |
| P10: リセット後空 | 任意の AppState |

### 統合テスト

- ブラウザの Playwright または Puppeteer で E2E シナリオを実行（任意）
- 最低限: Chromium で `index.html` を開き、3〜4人のシナリオを手動確認

---

## GitHub Pages デプロイ方法

1. リポジトリを GitHub に push（`main` ブランチ）
2. GitHub リポジトリの **Settings → Pages → Source** を `main` ブランチ、ルート（`/`）に設定
3. 数分後に `https://<username>.github.io/<repo-name>/` で公開される
4. `index.html` がルートに存在するため追加設定不要

### GitHub Actions（任意・自動化したい場合）

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

ビルドステップが不要なため、ファイルをそのままアップロードするだけでよい。
