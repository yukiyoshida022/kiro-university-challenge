# Requirements Document

## Introduction

グループ旅行や飲み会など、複数人で費用を分担する場面で使える割り勘計算Webアプリ。
各メンバーが立て替えた金額と用途を入力すると、最終的な過不足を計算し、支払い回数が最小になる精算方法（誰が誰にいくら払うか）を出力する。
バックエンド不要のクライアントサイドのみで動作し、ブラウザだけで完結する。

## Glossary

- **App**: 割り勘計算Webアプリ全体
- **Group**: 割り勘の対象となる参加者の集合
- **Member**: Groupに属する参加者1人。名前で識別される
- **Payment**: あるMemberが立て替えた1件の支出（金額・用途・支払者・対象者を持つ）
- **Balance**: 各Memberの純粋な過不足額（立て替え総額 − 負担すべき総額）
- **Settlement**: 精算方法。「AさんはBさんに○○円払う」という形式の送金指示の集合
- **Payer**: Settlementにおいて支払いを行うMember（残高がマイナスの人）
- **Receiver**: Settlementにおいて受け取りを行うMember（残高がプラスの人）
- **Minimum Transfers Algorithm**: Balanceの正負を相殺することで送金回数を最小化するアルゴリズム

---

## Requirements

### Requirement 1: メンバー管理

**User Story:** グループのメンバーとして、自分の名前をアプリに登録したい。そうすることで、誰がいくら負担したかを正確に追跡できる。

#### Acceptance Criteria

1. THE App SHALL メンバーを2人以上登録できる状態を保証する
2. WHEN ユーザーが名前を入力してメンバー追加を実行したとき、THE App SHALL そのメンバーをGroupに追加する
3. IF 入力された名前が空文字または空白のみのとき、THEN THE App SHALL メンバーを追加せずエラーメッセージを表示する
4. IF 同じ名前のMemberがGroupに既に存在するとき、THEN THE App SHALL 重複として登録を拒否しエラーメッセージを表示する
5. WHEN ユーザーがメンバー削除を実行したとき、THE App SHALL そのMemberに紐づくPaymentをすべて削除した上でGroupから除外する
6. THE App SHALL 現在登録されているMember一覧を常に画面に表示する

---

### Requirement 2: 支出入力

**User Story:** 立て替えを行ったメンバーとして、支出の金額・用途・誰が誰の分を払ったかを記録したい。そうすることで、後で正確な精算ができる。

#### Acceptance Criteria

1. WHEN ユーザーがPaymentを登録するとき、THE App SHALL 支払者（Payer Member）・金額・用途・対象者（割り勘対象のMember）を入力項目として受け付ける
2. WHEN 対象者が未選択のとき、THE App SHALL Group全員を対象者として扱う
3. IF 金額が0以下または数値でないとき、THEN THE App SHALL Paymentを登録せずエラーメッセージを表示する
4. IF 支払者が未選択のとき、THEN THE App SHALL Paymentを登録せずエラーメッセージを表示する
5. WHEN Paymentが正常に登録されたとき、THE App SHALL 登録済みPayment一覧を更新して表示する
6. WHEN ユーザーがPaymentの削除を実行したとき、THE App SHALL 該当Paymentを一覧から除外する
7. THE App SHALL 登録済みPayment一覧（支払者・金額・用途・対象者）を画面に表示する

---

### Requirement 3: 残高計算

**User Story:** グループメンバーとして、自分が全体でいくら立て替え超過または不足しているかを確認したい。そうすることで、精算の根拠を理解できる。

#### Acceptance Criteria

1. WHEN PaymentまたはMemberが追加・削除されたとき、THE App SHALL 各MemberのBalanceを即時に再計算して表示する
2. THE App SHALL 各MemberのBalanceを「立て替え総額 − 負担すべき総額」として計算する
3. WHILE GroupにMemberが1人以下のとき、THE App SHALL Balanceを表示せず精算計算を無効化する
4. THE App SHALL 全MemberのBalanceの合計が0になることを保証する（丸め誤差を除く）
5. IF 割り勘対象のMember数が対象Paymentの割り切れない割り算を生じさせるとき、THEN THE App SHALL 1円単位で端数を調整して全Balanceの合計が0になるよう処理する

---

### Requirement 4: 精算方法の出力（最小送金回数）

**User Story:** グループメンバーとして、「誰が誰にいくら払えばいいか」を最小の支払い回数で知りたい。そうすることで、精算を素早く終わらせることができる。

#### Acceptance Criteria

1. WHEN ユーザーが精算計算を実行したとき、THE App SHALL Minimum Transfers Algorithm を用いてSettlementを生成する
2. THE App SHALL 各Settlementを「[Payer名] → [Receiver名]：[金額]円」の形式で表示する
3. THE App SHALL 生成されるSettlementの件数が、単純な全対全送金と比較して最小化されていることを保証する
4. WHILE 全MemberのBalanceが0のとき、THE App SHALL 「精算不要」と表示する
5. IF Groupに登録されたMemberが1人以下のとき、THEN THE App SHALL 精算計算を実行せずエラーメッセージを表示する
6. THE Settlement SHALL PayerとReceiverが同一のMemberにならない送金指示のみを含む

---

### Requirement 5: データのリセット

**User Story:** ユーザーとして、新しい旅行・イベントのために入力データをまとめてクリアしたい。そうすることで、毎回ページをリロードせずに使い回せる。

#### Acceptance Criteria

1. WHEN ユーザーがリセット操作を実行したとき、THE App SHALL すべてのMemberおよびPaymentを削除し初期状態に戻す
2. THE App SHALL リセット前にユーザーへ確認を求める

---

### Requirement 6: クライアントサイド完結

**User Story:** ユーザーとして、インターネット接続やサーバーなしでもアプリを使いたい。そうすることで、旅行先のオフライン環境でも使える。

#### Acceptance Criteria

1. THE App SHALL バックエンドサーバーへのネットワークリクエストを行わずにすべての計算をブラウザ内で完結させる
2. THE App SHALL 単一のHTMLファイルとしてブラウザで直接開いて動作する、またはローカルの静的ファイルサーバーで動作する
3. WHILE ネットワーク接続が存在しないとき、THE App SHALL すべての機能を正常に動作させる
