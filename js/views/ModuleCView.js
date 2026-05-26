/** Module C — 車票預訂 View */
const ModuleCView = {

  /* ─── 查詢班次 ─── */
  renderSearch() {
    UI.setActiveTab('nav-c');
    const stations = stationRepo.getAll();
    const optHtml = stations.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const today = new Date().toISOString().split('T')[0];

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">🚄 車票預訂</h1>
        <button class="btn btn-outline" onclick="Router.navigate('/my-tickets')">🎫 我的票券</button>
      </div>
      <div class="card">
        <div class="form-row-3">
          <div class="form-group"><label>出發站</label><select id="c-dep" class="form-control">${optHtml}</select></div>
          <div class="form-group"><label>到達站</label><select id="c-arr" class="form-control">${stations.map((s,i) => `<option value="${s.id}" ${i===1?'selected':''}>${s.name}</option>`).join('')}</select></div>
          <div class="form-group"><label>日期</label><input id="c-date" class="form-control" type="date" value="${today}"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>車種篩選</label>
            <select id="c-type" class="form-control">
              <option value="">全部車種</option>
              <option value="high_speed">高速鐵路</option>
              <option value="express">自強號</option>
              <option value="local">區間車</option>
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary w-full" onclick="ModuleCView.doSearch()">查詢班次</button>
          </div>
        </div>
      </div>
      <div id="c-results"></div>
    `);
  },

  doSearch() {
    const depId = UI.val('c-dep'), arrId = UI.val('c-arr');
    const date = UI.val('c-date'), trainType = UI.val('c-type') || null;
    if (!depId || !arrId || !date) { UI.toast('請填寫所有查詢條件', 'error'); return; }
    if (depId === arrId) { UI.toast('出發站與到達站不能相同', 'error'); return; }

    const results = trainService.searchSchedules({ departureStationId: depId, arrivalStationId: arrId, date, trainType });
    const ticketTypes = ticketTypeRepo.getAll();
    const typeLabels = { high_speed: '高鐵', express: '自強號', local: '區間車' };

    const html = results.length === 0
      ? '<div class="empty-state"><div class="empty-icon">🚄</div><p>無符合條件的班次</p></div>'
      : results.map(s => {
          const fare = trainService.calculateFare(s.id, ticketTypes[0]?.id);
          return `
            <div class="schedule-item">
              <div class="schedule-time">
                <div class="time">${s.departureTime ? s.departureTime.split('T')[1]?.slice(0,5) || s.departureTime : '—'}</div>
                <div class="station">${s.departureStation?.name || '—'}</div>
              </div>
              <div class="schedule-arrow">
                <div>${typeLabels[s.trainType] || s.trainType} ${s.trainNumber}</div>
                <div>→</div>
                ${UI.badge(s.status, { on_time:'準點', delayed:`誤點 ${s.delayMinutes}分`, cancelled:'停駛' })}
              </div>
              <div class="schedule-time">
                <div class="time">${s.arrivalTime ? s.arrivalTime.split('T')[1]?.slice(0,5) || s.arrivalTime : '—'}</div>
                <div class="station">${s.arrivalStation?.name || '—'}</div>
              </div>
              <div class="schedule-info">
                <div class="schedule-price">$${fare.discounted}</div>
                <div class="schedule-seats">剩餘 ${s.availableSeats} 座</div>
                <button class="btn btn-sm btn-primary mt-8" onclick="ModuleCView.showBookModal('${s.id}')">訂票</button>
              </div>
            </div>
          `;
        }).join('');

    document.getElementById('c-results').innerHTML = html;
  },

  /* ─── 訂票 Modal ─── */
  showBookModal(scheduleId) {
    if (!Store.isLoggedIn()) { UI.toast('請先登入', 'error'); return; }
    const ticketTypes = ticketTypeRepo.getAll();
    const schedule = scheduleRepo.getById(scheduleId);
    const fare = trainService.calculateFare(scheduleId, ticketTypes[0]?.id);

    UI.showModal(`
      <div class="modal-header"><h3>訂票 — ${schedule?.trainNumber}</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>票種</label>
          <select id="tk-type" class="form-control" onchange="ModuleCView.updateFare('${scheduleId}')">
            ${ticketTypes.map(t => `<option value="${t.id}">${t.name}（折扣率 ${t.discountRate}）</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>身分證號碼</label><input id="tk-id" class="form-control" placeholder="A123456789"></div>
          <div class="form-group"><label>聯絡電話</label><input id="tk-phone" class="form-control" placeholder="0912345678"></div>
        </div>
        <div class="form-group">
          <label>座位偏好</label>
          <select id="tk-seat" class="form-control">
            <option value="any">不指定</option>
            <option value="window">靠窗</option>
            <option value="aisle">靠走道</option>
          </select>
        </div>
        <div id="tk-fare-info" class="text-sm" style="padding:8px;background:var(--bg);border-radius:6px">
          票價：<strong>$${fare.original}</strong> × ${fare.discountRate} = <strong style="color:var(--primary)">$${fare.discounted}</strong>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleCView.doBook('${scheduleId}')">確認訂票</button>
      </div>
    `);
  },

  updateFare(scheduleId) {
    const typeId = UI.val('tk-type');
    const fare = trainService.calculateFare(scheduleId, typeId);
    const el = document.getElementById('tk-fare-info');
    if (el) el.innerHTML = `票價：<strong>$${fare.original}</strong> × ${fare.discountRate} = <strong style="color:var(--primary)">$${fare.discounted}</strong>`;
  },

  doBook(scheduleId) {
    const result = trainService.createOrder({
      scheduleId,
      ticketTypeId: UI.val('tk-type'),
      seatPreference: UI.val('tk-seat'),
      idNumber: UI.val('tk-id'),
      phone: UI.val('tk-phone')
    });
    if (!result.success) { UI.toast(result.errors.join('、'), 'error'); return; }

    // 模擬付款
    trainService.payOrder(result.order.id, 'credit_card');
    UI.closeModal();
    UI.toast('訂票成功！已模擬付款');
    Router.navigate('/my-tickets');
  },

  /* ─── 我的票券 ─── */
  renderMyTickets() {
    UI.setActiveTab('nav-c');
    const user = Store.getUser();
    if (!user) { Router.navigate('/'); return; }
    const orders = ticketOrderRepo.findByPassengerId(user.id);

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">🎫 我的票券</h1>
        <button class="btn btn-outline" onclick="Router.navigate('/trains')">← 返回查詢</button>
      </div>
      ${orders.length === 0 ? '<div class="empty-state"><div class="empty-icon">🎫</div><p>尚無票券</p></div>' :
        orders.map(o => {
          const sch = scheduleRepo.getById(o.scheduleId);
          const dep = sch ? stationRepo.getById(sch.departureStationId) : null;
          const arr = sch ? stationRepo.getById(sch.arrivalStationId) : null;
          const tt = ticketTypeRepo.getById(o.ticketTypeId);
          const typeLabels = { high_speed:'高鐵', express:'自強號', local:'區間車' };
          return `
            <div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">
                    ${dep?.name || '?'} → ${arr?.name || '?'}
                    <span class="text-sm text-muted">(${typeLabels[sch?.trainType] || ''} ${sch?.trainNumber || ''})</span>
                  </div>
                  <div class="text-sm text-muted">
                    ${sch ? UI.formatDateTime(sch.departureTime) : '—'} · ${tt?.name || '全票'} · $${o.discountedPrice}
                  </div>
                </div>
                ${UI.badge(o.status, { paid:'已付款', pending:'待付款', transferred:'已轉讓', refunded:'已退票', collected:'已取票' })}
              </div>
              <div class="flex gap-8">
                ${o.status === 'paid' ? `
                  <button class="btn btn-sm btn-outline" onclick="ModuleCView.showTransferModal('${o.id}')">分票</button>
                  <button class="btn btn-sm btn-outline" onclick="ModuleCView.showChangeModal('${o.id}')">改票</button>
                  <button class="btn btn-sm btn-danger" onclick="ModuleCView.doRefund('${o.id}')">退票</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')
      }
    `);
  },

  showTransferModal(orderId) {
    UI.showModal(`
      <div class="modal-header"><h3>分票給其他使用者</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>接收者 Email</label>
          <input id="tr-email" class="form-control" type="email" placeholder="friend@email.com">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleCView.doTransfer('${orderId}')">確認轉移</button>
      </div>
    `);
  },

  doTransfer(orderId) {
    const email = UI.val('tr-email');
    if (!email) { UI.toast('請輸入 Email', 'error'); return; }
    const result = trainService.transferTicket(orderId, email);
    UI.closeModal();
    UI.toast(result.success ? `票券已轉移給 ${email}` : result.errors[0], result.success ? 'success' : 'error');
    this.renderMyTickets();
  },

  showChangeModal(orderId) {
    const order = ticketOrderRepo.getById(orderId);
    const sch = scheduleRepo.getById(order.scheduleId);
    const dep = stationRepo.getById(sch.departureStationId);
    const arr = stationRepo.getById(sch.arrivalStationId);
    const date = sch.operatingDate;
    const alternatives = scheduleRepo.search({
      departureStationId: sch.departureStationId, arrivalStationId: sch.arrivalStationId, date
    }).filter(s => s.id !== sch.id && s.availableSeats > 0);

    UI.showModal(`
      <div class="modal-header"><h3>改票</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <p class="text-sm text-muted mb-16">原班次：${dep?.name} → ${arr?.name} ${UI.formatDateTime(sch.departureTime)}</p>
        ${alternatives.length === 0 ? '<p class="text-sm text-muted">同日期無其他可用班次</p>' :
          alternatives.map(s => `
            <div class="list-item" style="cursor:pointer" onclick="ModuleCView.doChange('${orderId}','${s.id}')">
              <div class="list-item-content">
                <div class="list-item-title">${s.trainNumber}</div>
                <div class="list-item-subtitle">${UI.formatDateTime(s.departureTime)} · 剩餘 ${s.availableSeats} 座</div>
              </div>
              <button class="btn btn-sm btn-primary">改搭此班</button>
            </div>
          `).join('')
        }
      </div>
      <div class="modal-footer"><button class="btn btn-outline" onclick="UI.closeModal()">取消</button></div>
    `);
  },

  doChange(orderId, newScheduleId) {
    const result = trainService.changeTicket(orderId, newScheduleId);
    UI.closeModal();
    UI.toast(result.success ? '改票成功' : result.errors[0], result.success ? 'success' : 'error');
    this.renderMyTickets();
  },

  doRefund(orderId) {
    UI.confirm('確定要退票？退票後無法還原。').then(ok => {
      if (!ok) return;
      const result = trainService.refundTicket(orderId);
      UI.toast(result.success ? `退票成功，退款 $${result.refundAmount}` : result.errors[0],
               result.success ? 'success' : 'error');
      this.renderMyTickets();
    });
  },

  /* ─── 管理員：班次管理 ─── */
  renderManagerPanel() {
    UI.setActiveTab('nav-c');
    const user = Store.getUser();
    if (!user || user.role !== 'manager') { UI.toast('需要平台經理權限', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    const schedules = scheduleRepo.findByDate(today);

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">🚆 班次管理</h1>
      </div>
      <div class="card mb-16">
        <div class="card-header"><span class="card-title">票種折扣設定</span></div>
        ${ticketTypeRepo.getAll().map(tt => `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${tt.name}</div>
              <div class="list-item-subtitle">折扣率：${tt.discountRate}</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="ModuleCView.showEditTicketTypeModal('${tt.id}')">編輯</button>
          </div>
        `).join('')}
      </div>
      <div class="card-header mb-8"><span class="card-title">今日班次 (${today})</span></div>
      ${schedules.length === 0 ? '<div class="empty-state"><div class="empty-icon">🚄</div><p>今日無班次</p></div>' :
        schedules.map(s => {
          const dep = stationRepo.getById(s.departureStationId);
          const arr = stationRepo.getById(s.arrivalStationId);
          return `
            <div class="schedule-item">
              <div class="schedule-time">
                <div class="time">${s.departureTime?.split('T')[1]?.slice(0,5) || s.departureTime}</div>
                <div class="station">${dep?.name || '—'}</div>
              </div>
              <div class="schedule-arrow">
                <div>${s.trainNumber}</div>
                ${UI.badge(s.status, { on_time:'準點', delayed:`誤點${s.delayMinutes}分`, cancelled:'停駛' })}
              </div>
              <div class="schedule-time">
                <div class="time">${s.arrivalTime?.split('T')[1]?.slice(0,5) || s.arrivalTime}</div>
                <div class="station">${arr?.name || '—'}</div>
              </div>
              <div class="schedule-info">
                <div class="schedule-seats">剩 ${s.availableSeats} 座</div>
                <button class="btn btn-sm btn-warning mt-8" onclick="ModuleCView.showNotifModal('${s.id}')">發送通知</button>
              </div>
            </div>
          `;
        }).join('')
      }
    `);
  },

  showEditTicketTypeModal(typeId) {
    const tt = ticketTypeRepo.getById(typeId);
    UI.showModal(`
      <div class="modal-header"><h3>編輯票種：${tt.name}</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label>折扣率（0.0~1.0）</label><input id="tt-rate" class="form-control" type="number" step="0.1" min="0" max="1" value="${tt.discountRate}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleCView.doEditTicketType('${typeId}')">儲存</button>
      </div>
    `);
  },

  doEditTicketType(typeId) {
    const rate = parseFloat(UI.val('tt-rate'));
    if (isNaN(rate) || rate < 0 || rate > 1) { UI.toast('折扣率需介於 0 到 1 之間', 'error'); return; }
    ticketTypeRepo.update(typeId, { discountRate: rate, updatedBy: Store.getUser().id });
    UI.closeModal();
    UI.toast('票種更新成功');
    this.renderManagerPanel();
  },

  showNotifModal(scheduleId) {
    UI.showModal(`
      <div class="modal-header"><h3>發送異常通知</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>通知類型</label>
          <select id="notif-type" class="form-control">
            <option value="delay">誤點</option>
            <option value="cancellation">停駛</option>
          </select>
        </div>
        <div class="form-group"><label>通知訊息</label><textarea id="notif-msg" class="form-control" rows="2" placeholder="列車因故延誤…"></textarea></div>
        <div class="form-row">
          <div class="form-group">
            <label>補償類型</label>
            <select id="notif-comp-type" class="form-control">
              <option value="points">點數補貼</option>
              <option value="refund">退款</option>
            </select>
          </div>
          <div class="form-group"><label>補償金額</label><input id="notif-comp-amt" class="form-control" type="number" value="100"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-warning" onclick="ModuleCView.doSendNotif('${scheduleId}')">發送</button>
      </div>
    `);
  },

  doSendNotif(scheduleId) {
    trainService.sendNotification(scheduleId, {
      type: UI.val('notif-type'), message: UI.val('notif-msg'),
      compensationType: UI.val('notif-comp-type'),
      compensationAmount: parseFloat(UI.val('notif-comp-amt')) || 0
    });
    UI.closeModal();
    UI.toast('通知已發送，所有訂票乘客將收到通知');
    this.renderManagerPanel();
  }
};

window.ModuleCView = ModuleCView;
