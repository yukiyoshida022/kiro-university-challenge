# プロジェクト構造

## ディレクトリ構成

```
kiro-university-challenge/
├── index.html      # マークアップ + CSS（インライン）
├── app.js          # アプリロジック全体
├── README.md       # プロジェクト説明・使い方
└── .kiro/
    ├── steering/   # プロジェクト全体のコンテキスト（本ファイル群）
    ├── specs/      # 機能仕様（requirements / design / tasks）
    └── hooks/      # 保存時の構文チェックなどの自動化
```

## app.js の内部構成

ファイル先頭から以下の順で並ぶ。この順序を維持する。

1. **型定義** — JSDoc `@typedef`（Member / Payment / Balance / Settlement）
2. **グローバル状態** — `AppState`（members / payments / settlements）
3. **状態操作関数** — `addMember` / `removeMember` / `addPayment` / `removePayment` / `resetAll`
4. **計算ロジック** — `calculateBalances` / `calculateSettlements`（純粋関数。DOMに触れない）
5. **UI レンダリング** — `renderMembers` / `renderPayments` / `renderBalances` / `renderSettlements`
6. **ユーティリティ** — `escapeHtml`
7. **統合レンダリング** — `render`（全 render を呼ぶ）
8. **初期化・イベントハンドラ** — `DOMContentLoaded` 内でイベント登録

## 命名・コーディング規約

- **データモデル**: `id` は `crypto.randomUUID()` で生成。メンバー名はトリム済みを保持
- **関数の戻り値**: 入力バリデーションを伴う操作は `{ ok: true } | { ok: false, error: string }` を返す
- **計算とUIの分離**: `calculate*` は純粋関数でDOMに触れない。DOM操作は `render*` に閉じる
- **イベント委譲**: 一覧内の削除ボタンは親要素でクリックを拾い `data-id` で対象を特定する
- **状態変更後**: データを変えたら `AppState.settlements = null` にして精算結果を無効化し、`render()` を呼ぶ
- **金額**: 整数（円単位）。割り勘の端数は1円単位で先頭メンバーから配分し合計を保つ

## 要素IDの対応

HTML の要素ID（`member-list`、`payment-amount-input`、`calculate-btn` など）を
`app.js` が `getElementById` / `querySelector` で参照する。
ID を変更するときは両ファイルを揃えて更新する。
