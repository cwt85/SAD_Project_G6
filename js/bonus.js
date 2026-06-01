/* =========================================================
   紅利點數管理
   - 依使用者儲存點數
   - 支援購票扣抵、自動核發與異常補償
========================================================= */

function getCurrentBonusPoints() {
  if (!currentUser) return 0;
  syncLegacyBonusPoints();
  return getUserBonusPoints(currentUser.id);
}

function getUserBonusPoints(userId) {
  if (!userId) return 0;

  const key = String(userId);

  if (!(key in userBonusPoints)) {
    userBonusPoints[key] = 0;
  }

  return Number(userBonusPoints[key] || 0);
}

function syncLegacyBonusPoints() {
  if (!currentUser) return;

  const userId = String(currentUser.id);

  if (!(userId in userBonusPoints) && Number(trainBonusPoints || 0) > 0) {
    userBonusPoints[userId] = Number(trainBonusPoints || 0);
  }

  trainBonusPoints = getUserBonusPoints(userId);
}

function addBonusPoints(amount, reason = "系統核發", source = "system", userId) {
  if (!userId && currentUser) {
    userId = currentUser.id;
  }

  const value = Math.floor(Number(amount || 0));

  if (!userId || value <= 0) {
    console.warn(`[紅利點數] 無效參數: userId=${userId}, value=${value}`);
    return false;
  }

  const allowedSources = [
    "system",
    "train-payment",
    "train-abnormal",
    "train-refund",
    "train-change",
    "system-award",
    "consumption-milestone"
  ];

  if (!allowedSources.includes(source)) {
    console.warn(`[紅利點數] 拒絕操作：來源 "${source}" 不被允許`);
    return false;
  }

  const key = String(userId);

  if (!(key in userBonusPoints)) {
    userBonusPoints[key] = 0;
  }

  const nextBalance = getUserBonusPoints(key) + value;
  userBonusPoints[key] = nextBalance;

  recordBonusPointChange({
    userId: key,
    type: "add",
    amount: value,
    reason,
    source,
    balance: nextBalance
  });

  syncLegacyBonusPoints();
  saveAppData();

  if (typeof renderAll === "function") {
    renderAll();
  }

  if (typeof renderBonusPointBar === "function") {
    renderBonusPointBar();
  }

  if (typeof refreshTrainBonusDisplay === "function") {
    refreshTrainBonusDisplay();
  }

  return true;
}

function deductBonusPoints(amount, reason = "扣抵使用", source = "system", userId) {
  if (!userId && currentUser) {
    userId = currentUser.id;
  }

  const value = Math.floor(Number(amount || 0));

  if (!userId || value <= 0) {
    console.warn(`[紅利點數] 無效參數: userId=${userId}, value=${value}`);
    return false;
  }

  const allowedSources = [
    "system",
    "train-payment",
    "train-payment-deduct",
    "purchase-deduct",
    "refund-deduct"
  ];

  if (!allowedSources.includes(source)) {
    console.warn(`[紅利點數] 拒絕操作：來源 "${source}" 不被允許`);
    return false;
  }

  const key = String(userId);
  const current = getUserBonusPoints(key);

  if (value > current) {
    console.warn(`[紅利點數] 餘額不足: current=${current}, value=${value}`);
    return false;
  }

  const nextBalance = current - value;
  userBonusPoints[key] = nextBalance;

  recordBonusPointChange({
    userId: key,
    type: "deduct",
    amount: value,
    reason,
    source,
    balance: nextBalance
  });

  syncLegacyBonusPoints();
  saveAppData();

  if (typeof renderAll === "function") {
    renderAll();
  }

  if (typeof renderBonusPointBar === "function") {
    renderBonusPointBar();
  }

  if (typeof refreshTrainBonusDisplay === "function") {
    refreshTrainBonusDisplay();
  }

  return true;
}

function recordBonusPointChange({ userId, type, amount, reason, source, balance }) {
  const targetUser = users.find(user => String(user.id) === String(userId));

  bonusPointRecords.unshift({
    id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    userName: targetUser ? targetUser.displayName || targetUser.account : `使用者 ${userId}`,
    type,
    amount,
    reason,
    source,
    balance,
    operatorId: currentUser ? currentUser.id : "system",
    operatorName: currentUser ? currentUser.displayName || currentUser.account : "系統",
    createdAt: new Date().toLocaleString("zh-TW")
  });
}

function getVisibleBonusRecords(limit = 5) {
  if (!isLoggedIn || !currentUser) return [];

  return bonusPointRecords
    .filter(record => isAdmin() || String(record.userId) === String(currentUser.id))
    .slice(0, limit);
}

function renderBonusPointBar() {
  const bar = document.getElementById("bonusPointBar");
  if (!bar) return;

  if (!isLoggedIn || !currentUser) {
    bar.innerHTML = `
      <div class="bonus-bar-inner">
        <div>
          <span>紅利點數</span>
          <strong>登入後顯示</strong>
        </div>
      </div>
    `;
    return;
  }

  syncLegacyBonusPoints();

  const points = getCurrentBonusPoints();
  const records = getVisibleBonusRecords();

bar.innerHTML = `
  <div class="bonus-bar-inner">
    <div class="bonus-summary">
      <span>紅利點數</span>
      <strong id="bonusBarPointsText">${Number(points || 0).toLocaleString()} 點</strong>
      <small>系統自動核發，無使用期限。訂票、完成行程、異常補償等均可獲得。</small>
    </div>
    <div class="bonus-actions">
      <details class="bonus-history">
        <summary>紀錄</summary>
        <div class="bonus-history-list">
          ${records.length === 0
            ? `<div class="bonus-history-empty">尚無紅利紀錄</div>`
            : records.map(renderBonusRecord).join("")}
        </div>
      </details>
    </div>
  </div>
`;
}

function renderBonusRecord(record) {
  const sign = record.type === "add" ? "+" : "-";
  const className = record.type === "add" ? "add" : "deduct";

  return `
    <div class="bonus-record ${className}">
      <strong>${sign}${Number(record.amount || 0).toLocaleString()} 點</strong>
      <span>${escapeHtml(record.reason || "")}</span>
      <small>${escapeHtml(record.createdAt || "")}，餘額 ${Number(record.balance || 0).toLocaleString()} 點</small>
    </div>
  `;
}