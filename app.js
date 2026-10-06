/**
 * @typedef {Object} Member
 * @property {string} id - crypto.randomUUID() で生成
 * @property {string} name - 表示名（トリム済み）
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} payerId - 支払者の Member.id
 * @property {number} amount - 金額（正の整数、円単位）
 * @property {string} description - 用途
 * @property {string[]} targetIds - 割り勘対象の Member.id 配列。空なら全員
 */

/**
 * @typedef {Object} Balance
 * @property {string} memberId
 * @property {string} memberName
 * @property {number} amount - 正=受取超過、負=支払い超過（円）
 */

/**
 * @typedef {Object} Settlement
 * @property {string} payerId
 * @property {string} payerName
 * @property {string} receiverId
 * @property {string} receiverName
 * @property {number} amount - 送金額（正の整数、円）
 */

// グローバル状態
const AppState = {
  members: [],      // Member[]
  payments: [],     // Payment[]
  settlements: null // Settlement[] | null（null = 未計算）
};

/**
 * メンバーを追加する
 * @param {string} name
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function addMember(name) {
  const trimmed = name.trim();

  if (trimmed === '') {
    return { ok: false, error: '名前を入力してください' };
  }

  if (AppState.members.some(m => m.name === trimmed)) {
    return { ok: false, error: `「${trimmed}」は既に追加されています` };
  }

  AppState.members.push({
    id: crypto.randomUUID(),
    name: trimmed,
  });

  return { ok: true };
}

/**
 * メンバーを削除する（関連するPaymentも全て削除）
 * @param {string} id - Member.id
 */
function removeMember(id) {
  AppState.members = AppState.members.filter(member => member.id !== id);
  AppState.payments = AppState.payments.filter(payment =>
    payment.payerId !== id && !payment.targetIds.includes(id)
  );
}

/**
 * 支払いを追加する
 * @param {{ payerId: string, amount: number, description: string, targetIds: string[] }} paymentInput
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function addPayment(paymentInput) {
  const { payerId, amount, description, targetIds } = paymentInput ?? {};

  if (!payerId) {
    return { ok: false, error: '支払者を選択してください' };
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return { ok: false, error: '金額は1円以上の数値を入力してください' };
  }

  AppState.payments.push({
    id: crypto.randomUUID(),
    payerId,
    amount: Math.floor(amount),
    description: description ?? '',
    targetIds: Array.isArray(targetIds) ? targetIds : [],
  });

  return { ok: true };
}

/**
 * 支払いを削除する
 * @param {string} id - Payment.id
 */
function removePayment(id) {
  AppState.payments = AppState.payments.filter(payment => payment.id !== id);
}

/**
 * アプリの状態を初期状態にリセットする
 */
function resetAll() {
  AppState.members = [];
  AppState.payments = [];
  AppState.settlements = null;
}

/**
 * 各メンバーの残高を計算する
 * @param {Member[]} members
 * @param {Payment[]} payments
 * @returns {Balance[]}
 */
function calculateBalances(members, payments) {
  // 全 Member の Balance を 0 で初期化
  const balanceMap = new Map(
    members.map(m => [m.id, { memberId: m.id, memberName: m.name, amount: 0 }])
  );

  for (const payment of payments) {
    // 対象者を決定（空なら全員）
    const targets = payment.targetIds.length > 0
      ? payment.targetIds
      : members.map(m => m.id);

    const n = targets.length;
    if (n === 0) continue;

    const base = Math.floor(payment.amount / n);
    const remainder = payment.amount - base * n;

    // 支払者の Balance に支払い額を加算
    const payerBalance = balanceMap.get(payment.payerId);
    if (payerBalance) {
      payerBalance.amount += payment.amount;
    }

    // 各対象者の負担額を減算（最初の remainder 人に base+1 円、残りに base 円）
    targets.forEach((targetId, index) => {
      const share = index < remainder ? base + 1 : base;
      const targetBalance = balanceMap.get(targetId);
      if (targetBalance) {
        targetBalance.amount -= share;
      }
    });
  }

  return Array.from(balanceMap.values());
}

/**
 * 精算方法を計算する（支払い回数最小化）
 * @param {Balance[]} balances
 * @returns {Settlement[]}
 */
function calculateSettlements(balances) {
  const settlements = [];

  // amount > 0: 受取超過（降順）
  const positives = balances
    .filter(b => b.amount > 0)
    .map(b => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);

  // amount < 0: 支払い超過（絶対値降順）
  const negatives = balances
    .filter(b => b.amount < 0)
    .map(b => ({ ...b }))
    .sort((a, b) => a.amount - b.amount);

  while (positives.length > 0 && negatives.length > 0) {
    const receiver = positives[0];
    const payer = negatives[0];

    const transfer = Math.min(receiver.amount, Math.abs(payer.amount));

    settlements.push({
      payerId: payer.memberId,
      payerName: payer.memberName,
      receiverId: receiver.memberId,
      receiverName: receiver.memberName,
      amount: transfer,
    });

    receiver.amount -= transfer;
    payer.amount += transfer;

    if (receiver.amount === 0) positives.shift();
    if (payer.amount === 0) negatives.shift();
  }

  return settlements;
}


// ─── UI レンダリング ───────────────────────────────────────────────

/**
 * 6.1 メンバー一覧をDOMに描画
 */
function renderMembers() {
  const list = document.getElementById('member-list');
  list.innerHTML = '';

  AppState.members.forEach(member => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="item-text">${escapeHtml(member.name)}</span>
      <button class="delete-btn" data-id="${member.id}" aria-label="${escapeHtml(member.name)}を削除">✕</button>
    `;
    list.appendChild(li);
  });
}

/**
 * 7.1 支払い一覧・支払者ドロップダウン・対象者チェックボックスを更新
 */
function renderPayments() {
  // 支払い一覧
  const list = document.getElementById('payment-list');
  list.innerHTML = '';

  AppState.payments.forEach(payment => {
    const payer = AppState.members.find(m => m.id === payment.payerId);
    const payerName = payer ? payer.name : '(不明)';

    let targetText;
    if (payment.targetIds.length === 0) {
      targetText = '全員';
    } else {
      targetText = payment.targetIds
        .map(id => {
          const m = AppState.members.find(m => m.id === id);
          return m ? m.name : '(不明)';
        })
        .join('、');
    }

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="item-header">
        <span class="item-text">
          ${escapeHtml(payerName)}：${payment.amount.toLocaleString()}円
          ${payment.description ? '（' + escapeHtml(payment.description) + '）' : ''}
        </span>
        <button class="delete-btn" data-id="${payment.id}" aria-label="支払いを削除">✕</button>
      </div>
      <div class="item-detail">対象：${escapeHtml(targetText)}</div>
    `;
    list.appendChild(li);
  });

  // 支払者ドロップダウン
  const payerSelect = document.getElementById('payer-select');
  const currentPayer = payerSelect.value;
  payerSelect.innerHTML = '<option value="">-- 支払者を選択 --</option>';
  AppState.members.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = member.name;
    if (member.id === currentPayer) option.selected = true;
    payerSelect.appendChild(option);
  });

  // 対象者チェックボックス
  const checkboxGroup = document.getElementById('target-checkboxes');
  const checkedIds = Array.from(checkboxGroup.querySelectorAll('input[type=checkbox]:checked'))
    .map(cb => cb.value);
  checkboxGroup.innerHTML = '';
  AppState.members.forEach(member => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = member.id;
    if (checkedIds.includes(member.id)) checkbox.checked = true;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + member.name));
    checkboxGroup.appendChild(label);
  });
}

/**
 * 8.1 残高一覧を更新
 */
function renderBalances() {
  const list = document.getElementById('balance-list');
  list.innerHTML = '';

  if (AppState.members.length <= 1) return;

  const balances = calculateBalances(AppState.members, AppState.payments);
  balances.forEach(balance => {
    const li = document.createElement('li');
    let amountText;
    let amountClass;

    if (balance.amount > 0) {
      amountText = `+${balance.amount.toLocaleString()}円`;
      amountClass = 'positive';
    } else if (balance.amount < 0) {
      amountText = `${balance.amount.toLocaleString()}円`;
      amountClass = 'negative';
    } else {
      amountText = '±0円';
      amountClass = 'zero';
    }

    li.innerHTML = `
      <span>${escapeHtml(balance.memberName)}</span>
      <span class="${amountClass}">${amountText}</span>
    `;
    list.appendChild(li);
  });
}

/**
 * 9.1 精算結果を更新
 */
function renderSettlements() {
  const list = document.getElementById('settlement-list');
  list.innerHTML = '';

  if (AppState.settlements === null) return;

  if (AppState.settlements.length === 0) {
    const li = document.createElement('li');
    li.className = 'no-settlement';
    li.textContent = '精算不要です';
    list.appendChild(li);
    return;
  }

  AppState.settlements.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.payerName} → ${s.receiverName}：${s.amount.toLocaleString()}円`;
    list.appendChild(li);
  });
}

/**
 * XSS対策のためHTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── 統合レンダリング（11.1） ────────────────────────────────────────

function render() {
  renderMembers();
  renderPayments();
  renderBalances();
  renderSettlements();
}

// ─── 初期化・イベントハンドラ（11.2） ────────────────────────────────

// Node.js テスト環境向けエクスポート（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AppState,
    addMember,
    removeMember,
    addPayment,
    removePayment,
    resetAll,
    calculateBalances,
    calculateSettlements,
  };
}

// ブラウザ環境のみ実行
if (typeof document !== 'undefined') {
document.addEventListener('DOMContentLoaded', () => {

  // 6.2 メンバー追加
  const memberNameInput = document.getElementById('member-name-input');
  const addMemberBtn = document.getElementById('add-member-btn');
  const memberError = document.getElementById('member-error');

  function handleAddMember() {
    const result = addMember(memberNameInput.value);
    if (result.ok) {
      memberNameInput.value = '';
      memberError.textContent = '';
      AppState.settlements = null;
      render();
    } else {
      memberError.textContent = result.error;
    }
  }

  addMemberBtn.addEventListener('click', handleAddMember);
  memberNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddMember();
  });

  // 6.3 メンバー削除（イベント委譲）
  document.getElementById('member-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    removeMember(btn.dataset.id);
    AppState.settlements = null;
    render();
  });

  // 7.2 支払い追加
  document.getElementById('add-payment-btn').addEventListener('click', () => {
    const payerId = document.getElementById('payer-select').value;
    const amount = parseFloat(document.getElementById('payment-amount-input').value);
    const description = document.getElementById('payment-description-input').value;
    const targetIds = Array.from(
      document.querySelectorAll('#target-checkboxes input[type=checkbox]:checked')
    ).map(cb => cb.value);

    const result = addPayment({ payerId, amount, description, targetIds });
    if (result.ok) {
      document.getElementById('payer-select').value = '';
      document.getElementById('payment-amount-input').value = '';
      document.getElementById('payment-description-input').value = '';
      document.querySelectorAll('#target-checkboxes input[type=checkbox]')
        .forEach(cb => { cb.checked = false; });
      document.getElementById('payment-error').textContent = '';
      AppState.settlements = null;
      render();
    } else {
      document.getElementById('payment-error').textContent = result.error;
    }
  });

  // 7.3 支払い削除（イベント委譲）
  document.getElementById('payment-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    removePayment(btn.dataset.id);
    AppState.settlements = null;
    render();
  });

  // 9.2 精算を計算する
  document.getElementById('calculate-btn').addEventListener('click', () => {
    const settlementList = document.getElementById('settlement-list');
    if (AppState.members.length <= 1) {
      settlementList.innerHTML = '<li class="no-settlement">2人以上のメンバーが必要です</li>';
      return;
    }
    AppState.settlements = calculateSettlements(
      calculateBalances(AppState.members, AppState.payments)
    );
    renderSettlements();
  });

  // 10.1 リセット
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('すべてのデータをリセットします。よろしいですか？')) {
      resetAll();
      render();
    }
  });

  render();
});
} // end if (typeof document !== 'undefined')
