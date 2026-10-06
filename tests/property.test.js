// Feature: warikan-calculator, Property 1: 有効な名前はメンバーリストに追加される

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');
const { AppState, addMember, removeMember, addPayment, resetAll, calculateBalances, calculateSettlements } = require('../app.js');

describe('Property 1: 有効な名前はメンバーリストに追加される', () => {
  beforeEach(() => {
    resetAll();
  });

  it('空白のみでない任意の文字列はメンバーリストに追加される（Validates: Requirements 1.2）', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.trim().length > 0),
        (name) => {
          // 各イテレーション前に状態をリセット
          resetAll();

          const result = addMember(name);

          // ok: true が返ること
          assert.equal(result.ok, true, `addMember("${name}") は ok:true を返すべき`);

          // members リストにトリム済みの名前で追加されていること
          const trimmed = name.trim();
          const found = AppState.members.some(m => m.name === trimmed);
          assert.equal(found, true, `"${trimmed}" が AppState.members に存在すること`);

          // members の長さが 1 増えていること
          assert.equal(AppState.members.length, 1, 'メンバーが1件追加されていること');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 2: 空白のみの名前は拒否される

describe('Property 2: 空白のみの名前は拒否される', () => {
  beforeEach(() => {
    resetAll();
  });

  it('空白文字のみで構成された文字列はaddMemberに拒否され、membersのサイズが変化しない（Validates: Requirements 1.3）', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n')),
        (whitespaceOnlyName) => {
          resetAll();
          const beforeSize = AppState.members.length;

          const result = addMember(whitespaceOnlyName);

          // ok: false が返ること
          assert.equal(result.ok, false, `addMember("${JSON.stringify(whitespaceOnlyName)}") は ok:false を返すべき`);

          // メンバーリストのサイズが変化しないこと
          assert.equal(AppState.members.length, beforeSize, 'メンバーリストのサイズが変化してはいけない');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 3: 重複名は拒否される

describe('Property 3: 重複名は拒否される', () => {
  beforeEach(() => {
    resetAll();
  });

  it('既存メンバーと同名でaddMemberを呼ぶとok:falseが返りリストサイズが変化しない（Validates: Requirements 1.4）', () => {
    fc.assert(
      fc.property(
        // 1〜5人の有効名リストを生成（重複なし）
        fc.uniqueArray(
          fc.string().filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        // その中から1つ選ぶインデックス
        fc.nat({ max: 4 }),
        (names, pickIndex) => {
          resetAll();

          // メンバーを登録
          for (const name of names) {
            addMember(name);
          }

          // 既に登録済みの名前を選択（pickIndex を names の範囲に収める）
          const existingName = AppState.members[pickIndex % AppState.members.length].name;
          const beforeSize = AppState.members.length;

          // 重複名で追加を試みる
          const result = addMember(existingName);

          // ok: false が返ること
          assert.equal(result.ok, false, `addMember("${existingName}") は ok:false を返すべき`);

          // メンバーリストのサイズが変化しないこと
          assert.equal(
            AppState.members.length,
            beforeSize,
            `重複追加後のリストサイズが ${AppState.members.length} で変化してはいけない（期待: ${beforeSize}）`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 8: Settlement が全 Balance を解消する

describe('Property 8: Settlement が全 Balance を解消する', () => {
  it('合計が0のBalance配列に対してSettlementを全実行すると全Memberの残高が0になる（Validates: Requirements 4.1）', () => {
    fc.assert(
      fc.property(
        // 合計が0になるBalance配列を生成
        // 2人以上のメンバーで、最後の1人の amount を調整して合計を0にする
        fc.uniqueArray(
          fc.record({
            memberId: fc.uuid(),
            memberName: fc.string({ minLength: 1 }),
            amount: fc.integer({ min: -10000, max: 10000 }),
          }),
          { minLength: 2, maxLength: 10, selector: b => b.memberId }
        ).map(balances => {
          // 最後の要素の amount を調整して合計を0にする
          const sumExceptLast = balances.slice(0, -1).reduce((s, b) => s + b.amount, 0);
          const adjusted = balances.map((b, i) =>
            i === balances.length - 1 ? { ...b, amount: -sumExceptLast } : { ...b }
          );
          return adjusted;
        }),
        (balances) => {
          const settlements = calculateSettlements(balances);

          // Settlement を全て実行した後の残高マップを構築
          const residualMap = new Map(
            balances.map(b => [b.memberId, b.amount])
          );

          for (const s of settlements) {
            residualMap.set(s.payerId, (residualMap.get(s.payerId) ?? 0) + s.amount);
            residualMap.set(s.receiverId, (residualMap.get(s.receiverId) ?? 0) - s.amount);
          }

          // 全 Member の残高が 0 であること（-0 も 0 として扱う）
          for (const [memberId, residual] of residualMap.entries()) {
            assert.equal(
              residual === 0 || Object.is(residual, -0),
              true,
              `memberId=${memberId} の残高が ${residual} で0にならない`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 9: Payer と Receiver は常に異なる

describe('Property 9: Payer と Receiver は常に異なる', () => {
  it('任意のBalance配列から生成されたSettlementにおいてpayerId === receiverIdが存在しない（Validates: Requirements 4.6）', () => {
    fc.assert(
      fc.property(
        // 合計が0になるBalance配列を生成（Property 8 と同じジェネレーター）
        fc.uniqueArray(
          fc.record({
            memberId: fc.uuid(),
            memberName: fc.string({ minLength: 1 }),
            amount: fc.integer({ min: -10000, max: 10000 }),
          }),
          { minLength: 2, maxLength: 10, selector: b => b.memberId }
        ).map(balances => {
          // 最後の要素の amount を調整して合計を0にする
          const sumExceptLast = balances.slice(0, -1).reduce((s, b) => s + b.amount, 0);
          return balances.map((b, i) =>
            i === balances.length - 1 ? { ...b, amount: -sumExceptLast } : { ...b }
          );
        }),
        (balances) => {
          const settlements = calculateSettlements(balances);

          for (const s of settlements) {
            assert.notEqual(
              s.payerId,
              s.receiverId,
              `Settlement に payerId === receiverId (${s.payerId}) が存在する`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 6: 無効な金額は拒否される

describe('Property 6: 無効な金額は拒否される', () => {
  beforeEach(() => {
    resetAll();
  });

  it('0以下の整数または文字列の金額でaddPaymentを呼ぶとok:falseが返る（Validates: Requirements 2.3）', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ max: 0 }), fc.string()),
        (invalidAmount) => {
          resetAll();
          // payerIdは何でもよい（金額バリデーション前にpayerIdチェックが走るため、有効なpayerIdを設定）
          addMember('テスト太郎');
          const payerId = AppState.members[0].id;

          const result = addPayment({ payerId, amount: invalidAmount, description: '', targetIds: [] });

          assert.equal(result.ok, false, `amount=${JSON.stringify(invalidAmount)} は拒否されるべき`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 7: 全 Balance の合計は常に 0 である

describe('Property 7: 全 Balance の合計は常に 0 である', () => {
  it('任意のメンバーリストと正の金額の Payment リストを与えると Balance 合計が 0 になる（Validates: Requirements 3.4, 3.5）', () => {
    fc.assert(
      fc.property(
        // 1〜8人のメンバー（重複名なし）
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 8 }
        ).map(names =>
          names.map(name => ({
            id: require('node:crypto').randomUUID(),
            name: name.trim(),
          }))
        ),
        // 0〜10件の Payment
        fc.array(
          fc.record({
            id: fc.constant('payment-id'), // id は計算に使わない
            amount: fc.integer({ min: 1, max: 100000 }),
            // payerIndex と targetIndices は後で members に紐づける
            payerIndex: fc.nat({ max: 7 }),
            targetIndices: fc.array(fc.nat({ max: 7 }), { minLength: 0, maxLength: 8 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (members, rawPayments) => {
          if (members.length === 0) return;

          // rawPayments の index を実際の member.id に変換
          const payments = rawPayments.map(p => ({
            id: require('node:crypto').randomUUID(),
            payerId: members[p.payerIndex % members.length].id,
            amount: p.amount,
            description: '',
            targetIds: [...new Set(
              p.targetIndices.map(i => members[i % members.length].id)
            )],
          }));

          const balances = calculateBalances(members, payments);

          // 全 Balance の合計が 0 であること
          const total = balances.reduce((sum, b) => sum + b.amount, 0);
          assert.equal(
            total,
            0,
            `Balance 合計が ${total} で 0 にならない (members=${members.length}, payments=${payments.length})`
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});

// Feature: warikan-calculator, Property 4: メンバー削除時に関連 Payment も消える

describe('Property 4: メンバー削除時に関連 Payment も消える', () => {
  beforeEach(() => {
    resetAll();
  });

  it('任意のメンバーを削除すると、そのメンバーが payerId または targetIds に含まれる Payment が全て消える（Validates: Requirements 1.5）', () => {
    fc.assert(
      fc.property(
        // 1〜5人のメンバー（重複名なし）
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        // 0〜10件の Payment（payerIndex / targetIndices はメンバーインデックスで指定）
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 100000 }),
            description: fc.string({ maxLength: 20 }),
            payerIndex: fc.nat({ max: 4 }),
            targetIndices: fc.array(fc.nat({ max: 4 }), { minLength: 0, maxLength: 5 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // 削除するメンバーのインデックス
        fc.nat({ max: 4 }),
        (names, rawPayments, deleteIndex) => {
          resetAll();

          // メンバーを登録（AppState 経由）
          for (const name of names) {
            addMember(name);
          }
          const members = AppState.members;
          if (members.length === 0) return;

          // Payment を登録
          for (const p of rawPayments) {
            const payerId = members[p.payerIndex % members.length].id;
            const targetIds = [...new Set(
              p.targetIndices.map(i => members[i % members.length].id)
            )];
            addPayment({ payerId, amount: p.amount, description: p.description, targetIds });
          }

          // 削除対象メンバーを選択
          const targetMember = members[deleteIndex % members.length];
          const targetId = targetMember.id;

          // メンバーを削除
          removeMember(targetId);

          // 削除後、AppState.payments に削除メンバーが payerId または targetIds に含まれる Payment がないこと
          const orphaned = AppState.payments.filter(
            payment => payment.payerId === targetId || payment.targetIds.includes(targetId)
          );

          assert.equal(
            orphaned.length,
            0,
            `削除メンバー(${targetMember.name})が残った Payment が ${orphaned.length} 件存在する`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 10: リセット後は空の初期状態になる

describe('Property 10: リセット後は空の初期状態になる', () => {
  it('任意のAppStateからresetAll()を呼ぶとmembersとpaymentsが空になる（Validates: Requirements 5.1）', () => {
    fc.assert(
      fc.property(
        // 0〜5人のメンバー名（重複なし）
        fc.uniqueArray(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 0, maxLength: 5 }
        ),
        // 0〜10件の Payment
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 100000 }),
            description: fc.string({ maxLength: 20 }),
            payerIndex: fc.nat({ max: 4 }),
            targetIndices: fc.array(fc.nat({ max: 4 }), { minLength: 0, maxLength: 5 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (names, rawPayments) => {
          resetAll();

          // メンバーを登録
          for (const name of names) {
            addMember(name);
          }
          const members = AppState.members;

          // Payment を登録（メンバーがいる場合のみ）
          if (members.length > 0) {
            for (const p of rawPayments) {
              const payerId = members[p.payerIndex % members.length].id;
              const targetIds = [...new Set(
                p.targetIndices.map(i => members[i % members.length].id)
              )];
              addPayment({ payerId, amount: p.amount, description: p.description, targetIds });
            }
          }

          // resetAll() を呼ぶ
          resetAll();

          // members と payments が空であること
          assert.equal(
            AppState.members.length,
            0,
            `resetAll() 後に AppState.members が空でない（${AppState.members.length}件残存）`
          );
          assert.equal(
            AppState.payments.length,
            0,
            `resetAll() 後に AppState.payments が空でない（${AppState.payments.length}件残存）`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: warikan-calculator, Property 5: 対象者未指定は全員対象と等価

describe('Property 5: 対象者未指定は全員対象と等価', () => {
  it('targetIds=[]の結果と全メンバーIDを指定した結果が等しい（Validates: Requirements 2.2）', () => {
    fc.assert(
      fc.property(
        // 1人以上のメンバーリストを生成
        fc.array(
          fc.string().filter(s => s.trim().length > 0),
          { minLength: 1 }
        ).map(names => {
          const seen = new Set();
          const unique = [];
          for (const name of names) {
            const trimmed = name.trim();
            if (!seen.has(trimmed)) {
              seen.add(trimmed);
              unique.push({ id: require('node:crypto').randomUUID(), name: trimmed });
            }
          }
          return unique;
        }),
        // 金額（1以上の整数）
        fc.integer({ min: 1 }),
        // 支払者インデックス
        fc.nat({ max: 99 }),
        (members, amount, payerIndex) => {
          if (members.length === 0) return;

          const payerId = members[payerIndex % members.length].id;
          const allMemberIds = members.map(m => m.id);

          // targetIds=[] の Payment
          const paymentEmpty = {
            id: 'payment-empty',
            payerId,
            amount,
            description: '',
            targetIds: [],
          };

          // 全メンバーIDを指定した Payment
          const paymentAll = {
            id: 'payment-all',
            payerId,
            amount,
            description: '',
            targetIds: allMemberIds,
          };

          const balancesEmpty = calculateBalances(members, [paymentEmpty]);
          const balancesAll   = calculateBalances(members, [paymentAll]);

          // memberId でソートして順序を揃えて比較
          const sort = arr => [...arr].sort((a, b) => a.memberId.localeCompare(b.memberId));

          const sortedEmpty = sort(balancesEmpty);
          const sortedAll   = sort(balancesAll);

          assert.deepEqual(
            sortedEmpty,
            sortedAll,
            `targetIds=[] と全員指定の Balance が一致しない (payerId=${payerId}, amount=${amount})`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
