# Implementation Plan: 割り勘計算 Web アプリ（warikan-calculator）

## Overview

バニラ HTML/CSS/JavaScript で構成するクライアントサイド完結型の割り勘計算アプリ。
`index.html`（HTML構造＋インラインCSS）と `app.js`（状態管理・計算・UI）の2ファイル構成で実装する。
テストは fast-check を用いたプロパティベーステスト（PBT）と Node.js `node:test` を用いたユニットテストで行う。

---

## Tasks

- [x] 1. プロジェクト構成と基本ファイルの作成
  - [x] 1.1 `index.html` の雛形を作成する
    - `<style>` タグで CSS をインライン定義（外部 CSS ファイル不要）
    - `<script src="app.js">` でスクリプトを読み込む
    - Header・Member Panel・Payment Panel・Balance Panel・Settlement Panel の骨格 HTML を配置する
    - _Requirements: 6.2_
  - [x] 1.2 `app.js` に AppState と定数の初期定義を作成する
    - `AppState = { members: [], payments: [], settlements: null }` を定義する
    - `Member`, `Payment`, `Balance`, `Settlement` の構造コメントを追加する
    - _Requirements: 1.1, 2.1_
  - [x] 1.3 `README.md` に GitHub Pages URL と使い方を記載する
    - _Requirements: 6.1_

- [x] 2. データモデルとバリデーション関数の実装
  - [x] 2.1 `addMember(name)` 関数を実装する
    - `crypto.randomUUID()` で ID 生成
    - 空文字・空白のみの場合は `{ ok: false, error: '...' }` を返す
    - 同名 Member が既存の場合は `{ ok: false, error: '〇〇は既に追加されています' }` を返す
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.2 Property 1: 有効な名前はメンバーリストに追加されることをテストする
    - **Property 1: 有効な名前はメンバーリストに追加される**
    - **Validates: Requirements 1.2**
    - `fc.string().filter(s => s.trim().length > 0)` で生成した名前で `addMember` を呼び、結果を検証
  - [x] 2.3 Property 2: 空白のみの名前は拒否されることをテストする
    - **Property 2: 空白のみの名前は拒否される**
    - **Validates: Requirements 1.3**
    - `fc.stringOf(fc.constantFrom(' ', '\t', '\n'))` で生成した文字列で `addMember` を呼び、拒否を検証
  - [x] 2.4 Property 3: 重複名は拒否されることをテストする
    - **Property 3: 重複名は拒否される**
    - **Validates: Requirements 1.4**
    - 既存メンバーと同名で `addMember` を呼び、リストサイズが変化しないことを検証
  - [x] 2.5 `removeMember(id)` 関数を実装する
    - 対象 Member を `AppState.members` から削除する
    - そのメンバーが `payerId` または `targetIds` に含まれる Payment をすべて削除する
    - _Requirements: 1.5_
  - [x] 2.6 Property 4: メンバー削除時に関連 Payment も消えることをテストする
    - **Property 4: メンバー削除時に関連 Payment も消える**
    - **Validates: Requirements 1.5**
    - 任意のメンバーリストと Payment リストを生成し、メンバー削除後に関連 Payment が存在しないことを検証
  - [x] 2.7 `addPayment(paymentInput)` 関数を実装する
    - 金額が 0 以下または非数値の場合はエラーを返す
    - 支払者が未選択（payerId が空）の場合はエラーを返す
    - 正常時は `crypto.randomUUID()` で ID 生成して登録する
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 2.8 Property 6: 無効な金額は拒否されることをテストする
    - **Property 6: 無効な金額は拒否される**
    - **Validates: Requirements 2.3**
    - `fc.oneof(fc.integer({max: 0}), fc.string())` で生成した値で `addPayment` を呼び、拒否を検証
  - [x] 2.9 `removePayment(id)` 関数を実装する
    - 対象 Payment を `AppState.payments` から削除する
    - _Requirements: 2.6_
  - [x] 2.10 `resetAll()` 関数を実装する
    - `AppState.members = []`, `AppState.payments = []`, `AppState.settlements = null` にリセットする
    - _Requirements: 5.1_
  - [x] 2.11 Property 10: リセット後は空の初期状態になることをテストする
    - **Property 10: リセット後は空の初期状態になる**
    - **Validates: Requirements 5.1**
    - 任意の AppState から `resetAll()` を呼び、members と payments が空であることを検証

- [x] 3. 残高計算ロジックの実装
  - [x] 3.1 `calculateBalances(members, payments)` を実装する
    - `targetIds` が空なら全 Member を対象とする
    - `Math.floor(amount / n)` で均等割り、端数 `remainder` を先頭 `remainder` 人に加算する
    - Payer の Balance に `amount` 加算、各対象者から各人負担額を減算する
    - _Requirements: 3.2, 3.4, 3.5_
  - [x] 3.2 Property 5: 対象者未指定は全員対象と等価であることをテストする
    - **Property 5: 対象者未指定は全員対象と等価**
    - **Validates: Requirements 2.2**
    - 任意のメンバーリストと金額を生成し、`targetIds=[]` の結果と全メンバー指定の結果を比較して等しいことを検証
  - [x] 3.3 Property 7: 全 Balance の合計は常に 0 であることをテストする
    - **Property 7: 全 Balance の合計は常に0**
    - **Validates: Requirements 3.4, 3.5**
    - 任意のメンバーリストと正の金額の Payment リストを生成し、Balance 合計が 0 であることを検証

- [x] 4. Checkpoint — Balance 計算の動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 精算アルゴリズム（Minimum Transfers）の実装
  - [x] 5.1 `calculateSettlements(balances)` を実装する
    - `positives`（Balance > 0）を降順ソート、`negatives`（Balance < 0）を絶対値降順ソート
    - 貪欲法で Settlement を生成し、精算済みエントリをリストから除去する
    - Payer と Receiver が同一にならないことを保証する
    - _Requirements: 4.1, 4.3, 4.6_
  - [x] 5.2 Property 8: Settlement が全 Balance を解消することをテストする
    - **Property 8: Settlement が全 Balance を解消する**
    - **Validates: Requirements 4.1**
    - 合計が 0 になる Balance 配列を生成し、Settlement を全実行後に全 Member の残高が 0 であることを検証
  - [x] 5.3 Property 9: Payer と Receiver は常に異なることをテストする
    - **Property 9: Payer と Receiver は常に異なる**
    - **Validates: Requirements 4.6**
    - 任意の Balance 配列から生成された Settlement において、payerId === receiverId が存在しないことを検証

- [x] 6. UI — Member Panel の実装
  - [x] 6.1 `renderMembers()` 関数を実装する
    - メンバー一覧を DOM に描画する（削除ボタン付き）
    - メンバーが 0 人の場合は空表示
    - _Requirements: 1.6_
  - [x] 6.2 Member 追加フォームのイベントハンドラを接続する
    - 追加ボタンクリック時に `addMember` を呼び、結果に応じてエラーメッセージまたは一覧を更新する
    - `addMember` がエラーを返した場合はフォーム近傍にインラインエラーを表示する
    - 次の有効な操作時にエラーをクリアする
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 6.3 Member 削除ボタンのイベントハンドラを接続する
    - 削除ボタンクリック時に `removeMember` を呼び、一覧と Payment 一覧を再描画する
    - _Requirements: 1.5_

- [x] 7. UI — Payment Panel の実装
  - [x] 7.1 `renderPayments()` 関数を実装する
    - Payment 一覧を DOM に描画する（支払者・金額・用途・対象者・削除ボタン）
    - 対象者が全員の場合は「全員」と表示する
    - _Requirements: 2.7_
  - [x] 7.2 Payment 追加フォームのイベントハンドラを接続する
    - 支払者ドロップダウンをメンバーリストから動的生成する
    - 対象者チェックボックスをメンバーリストから動的生成する
    - 追加ボタンクリック時に `addPayment` を呼び、エラー処理と一覧更新を行う
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  - [x] 7.3 Payment 削除ボタンのイベントハンドラを接続する
    - 削除ボタンクリック時に `removePayment` を呼び、一覧と Balance を再描画する
    - _Requirements: 2.6_

- [x] 8. UI — Balance Panel の実装
  - [x] 8.1 `renderBalances()` 関数を実装する
    - `calculateBalances` を呼び、各 Member の Balance を一覧表示する
    - Member が 1 人以下の場合は Balance を非表示にする
    - _Requirements: 3.1, 3.3_

- [x] 9. UI — Settlement Panel の実装
  - [x] 9.1 `renderSettlements()` 関数を実装する
    - Settlement を「[Payer名] → [Receiver名]：[金額]円」形式で表示する
    - 全 Balance が 0 の場合は「精算不要」と表示する
    - Member が 1 人以下の場合はエラーメッセージを表示する
    - _Requirements: 4.2, 4.4, 4.5_
  - [x] 9.2 「精算を計算する」ボタンのイベントハンドラを接続する
    - クリック時に `calculateSettlements(calculateBalances(...))` を呼び、`AppState.settlements` を更新して再描画する
    - _Requirements: 4.1_

- [x] 10. UI — Header とリセット機能の実装
  - [x] 10.1 リセットボタンのイベントハンドラを実装する
    - `confirm()` ダイアログで確認後に `resetAll()` を呼び、全パネルを再描画する
    - _Requirements: 5.1, 5.2_

- [x] 11. `render()` 統合関数の実装と配線
  - [x] 11.1 `render()` 関数を実装し全サブ描画関数を呼び出す
    - `renderMembers()`, `renderPayments()`, `renderBalances()`, `renderSettlements()` を順に呼ぶ
    - アプリ起動時に初回 `render()` を呼ぶ
    - _Requirements: 1.6, 2.7, 3.1_
  - [x] 11.2 メンバー追加・削除・Payment 追加・削除の各操作後に `render()` が呼ばれることを確認する
    - _Requirements: 3.1_

- [x] 12. Final Checkpoint — 全テスト通過と動作確認
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- タスクに `*` が付いたサブタスクはオプション（MVP を優先する場合はスキップ可）
- プロパティテストには **fast-check** を使用（CDN 経由または npm でインストール）
- ユニットテストは Node.js `node:test` または Vitest で実行する
- 各タスクは前のタスクの成果物を前提として積み上げる構造になっている
- `index.html` はブラウザで直接開いても動作する（ビルド不要）

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.5", "2.7", "2.9", "2.10"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.6", "2.8", "2.11", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.1", "6.2", "6.3", "7.1", "7.2", "7.3", "8.1", "9.1", "9.2", "10.1"] },
    { "id": 5, "tasks": ["11.1", "11.2"] }
  ]
}
```
