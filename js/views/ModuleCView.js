/** Module C — 車票預訂 View */
const ModuleCView = {

    /* ─── 查詢班次 ─── */
    renderSearch() {
        UI.setActiveTab('nav-c');

        UI.render(`
      <div class="ticket-module-layout" style="display: flex; gap: 24px; align-items: flex-start; width: 100%;">
        
        <div class="flow-menu" style="width: 250px; flex-shrink: 0; position: sticky; top: 80px;">
          <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--text);">功能列表</h3>
          <button class="flow-btn active" id="f-btn-1" onclick="switchMainFlow(1)">車次查詢與訂票系統</button>
          <button class="flow-btn" id="f-btn-4" onclick="switchMainFlow(4)">付款與取票追蹤</button>
          <button class="flow-btn" id="f-btn-5" onclick="switchMainFlow(5)">分票管理</button>
          <button class="flow-btn" id="f-btn-6" onclick="switchMainFlow(6)">退票/改票</button>
        </div>

        <div class="flow-content" style="flex: 1; min-width: 0;">
          
          <div id="main-flow-1" class="flow-view">
            <div class="stepper-container">
              <div class="step active" id="step-ui-1"><div class="step-circle">1</div>查詢車次</div>
              <div class="step-line"></div>
              <div class="step" id="step-ui-2"><div class="step-circle">2</div>選擇票種與劃位</div>
              <div class="step-line"></div>
              <div class="step" id="step-ui-3"><div class="step-circle">3</div>確認訂單</div>
              <div class="step-line"></div>
              <div class="step" id="step-ui-4"><div class="step-circle">4</div>付款取票</div>
            </div>

            <div class="card" id="stage-search">
              <div class="form-row">
                <div class="form-group"><label>出發站</label><select id="start-station" class="form-control"><option>台北</option><option>台中</option><option>高雄</option></select></div>
                <div class="form-group"><label>抵達站</label><select id="end-station" class="form-control"><option>高雄</option><option>台中</option><option>台北</option></select></div>
                <div class="form-group"><label>乘車日期</label><input type="date" id="ride-date" class="form-control" value="2026-06-25"></div>
              </div>
              <div class="form-row" style="align-items:flex-end;">
                <div class="form-group"><label>車廂類型</label><select id="car-type" class="form-control"><option value="standard">標準車廂</option><option value="business">商務車廂</option></select></div>
                <div class="form-group" style="padding-bottom:0.6rem;"><label style="display:inline;"><input type="checkbox" checked> 接受轉車選項</label></div>
                <div class="form-group"><button class="btn btn-primary" style="width:100%" onclick="simulateSearch()">即時動態查詢</button></div>
              </div>
              <div id="search-results" style="display:none; margin-top:2rem;">
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                  <thead><tr style="border-bottom: 2px solid var(--border);"><th style="padding: 8px;">車種</th><th>車次</th><th>時間 (總計)</th><th>剩餘座位</th><th>操作</th></tr></thead>
                  <tbody id="train-table-body"></tbody>
                </table>
              </div>
            </div>

            <div class="card" id="stage-booking" style="display:none;">
              <div class="train-header" style="display:flex; justify-content:space-between; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                <div style="display:flex; align-items:center; gap: 12px;">
                  <span class="badge badge-confirmed" id="sel-train-badge"></span>
                  <span style="font-weight: bold; color: var(--primary);" id="sel-train-time"></span>
                </div>
                <button class="btn btn-outline" onclick="goBookingStage(1)">← 重選車次</button>
              </div>
              <h4 style="margin-bottom: 12px;">訂票聯絡人資料</h4>
              <div class="form-row">
                <div class="form-group"><label>身分證字號 <span style="color:red">*</span></label><input type="text" class="form-control" id="user-id" value="A123456789"></div>
                <div class="form-group"><label>聯絡電話 <span style="color:red">*</span></label><input type="text" class="form-control" id="user-phone" value="0912-345-678"></div>
                <div class="form-group"><label>電子信箱</label><input type="email" class="form-control" placeholder="your@email.com"></div>
              </div>
              <h4 style="margin: 20px 0 12px 0;">票種選擇 (統一套用)</h4>
              <div class="ticket-selector" id="ticket-selector">
                <div class="ticket-card-sel active" onclick="selectTicketType('normal', 1.0, '一般票', this)"><div style="font-weight:bold;">一般票</div><div style="font-size:0.8rem; color:var(--muted);">全額</div></div>
                <div class="ticket-card-sel" onclick="selectTicketType('student', 0.88, '學生票 88 折', this)"><div style="font-weight:bold;">學生票</div><div style="font-size:0.8rem; color:var(--muted);">88折</div></div>
                <div class="ticket-card-sel" onclick="selectTicketType('senior', 0.6, '敬老票 6 折', this)"><div style="font-weight:bold;">敬老票</div><div style="font-size:0.8rem; color:var(--muted);">6折</div></div>
                <div class="ticket-card-sel" onclick="selectTicketType('love', 0.6, '愛心票 6 折', this)"><div style="font-weight:bold;">愛心票</div><div style="font-size:0.8rem; color:var(--muted);">6折</div></div>
                <div class="ticket-card-sel" onclick="selectTicketType('child', 0.7, '兒童票 7 折', this)"><div style="font-weight:bold;">兒童票</div><div style="font-size:0.8rem; color:var(--muted);">7折</div></div>
              </div>
              <h4 style="margin: 20px 0 12px 0;">人數與劃位設定</h4>
              <div class="form-row">
                <div class="form-group"><label>乘車人數</label>
                  <select id="passenger-count" class="form-control" onchange="clearSeats()">
                    <option value="1">1 人</option><option value="2">2 人</option><option value="3">3 人</option><option value="4">4 人</option>
                  </select>
                </div>
                <div class="form-group" style="flex:2;"><label>劃位方式</label>
                  <div style="display:flex; gap:1.5rem; padding-top:0.5rem;">
                    <label style="cursor:pointer;"><input type="radio" name="seat-method" value="auto" checked onchange="toggleSeatMap()"> 系統自動安排 (隨機配位)</label>
                    <label style="cursor:pointer;"><input type="radio" name="seat-method" value="manual" onchange="toggleSeatMap()"> 手動挑選座位</label>
                  </div>
                </div>
              </div>
              <div id="manual-seat-section" style="display:none; margin-bottom:1.5rem;">
                <div class="train-car"><div id="seat-map-container"></div></div>
                <div style="margin-top:0.5rem; color:var(--primary); font-weight:bold; background:var(--bg); padding:1rem; border-radius:6px;">
                  已選座位：<span id="selected-seats-display" style="color:var(--secondary);">尚未選擇</span>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top:2rem;">
                <button class="btn btn-outline" onclick="goBookingStage(1)">← 上一步</button>
                <button class="btn btn-primary" onclick="goBookingStage(3)">下一步：確認訂單 →</button>
              </div>
            </div>

            <div class="card" id="stage-confirm" style="display:none;">
              <h3 style="margin-bottom: 1rem;">核對車票資訊</h3>
              <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 1.5rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>行駛路線</span><strong id="conf-route"></strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>搭乘車次</span><strong id="conf-train"></strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>乘車時間</span><strong id="conf-time"></strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>總乘車人數</span><strong id="conf-count"></strong></div>
                <div style="display:flex; justify-content:space-between;"><span>座位分配</span><strong id="conf-seats" style="color:var(--secondary);"></strong></div>
              </div>
              
              <h3 style="margin-bottom: 1rem;">票價計算與優惠邏輯</h3>
              <div style="border: 1px solid var(--border); padding: 16px; border-radius: 8px; margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>單人原始票價</span><span id="calc-orig-price"></span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>套用最優惠折扣</span><strong id="calc-best-desc" style="color:var(--warning);"></strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom: 1px dashed var(--border); padding-bottom: 8px;"><span>單人優惠票價</span><span id="calc-single-price"></span></div>
                <div style="display:flex; justify-content:space-between; font-size: 1.2rem; font-weight: bold; margin-top: 12px;"><span>總計票價 <span id="calc-multiplier" style="font-size:0.9rem; color:var(--muted); font-weight:normal;"></span></span><span id="calc-final-price" style="color:var(--danger);"></span></div>
              </div>
              
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-outline" onclick="goBookingStage(2)">← 上一步 (修改細節)</button>
                <button class="btn btn-primary" onclick="executeBooking()">確認無誤，前往付款 →</button>
              </div>
            </div>
          </div>

          <div id="main-flow-4" class="flow-view" style="display:none;"><div class="card"><h2>付款與取票追蹤</h2><div id="flow-4-orders"></div></div></div>
          <div id="main-flow-5" class="flow-view" style="display:none;"><div class="card"><h2>票券分票管理</h2><div id="flow-5-orders"></div></div></div>
          <div id="main-flow-6" class="flow-view" style="display:none;"><div class="card"><h2>售後服務 (退/改票)</h2><div id="flow-6-orders"></div></div></div>
          
        </div>
      </div>
    `);
    },

    /* ─── API 對接邏輯 ─── */
    doSearch() {
        const depId = UI.val('c-dep'), arrId = UI.val('c-arr');
        const date = UI.val('c-date'), trainType = UI.val('c-type') || null;
        if (!depId || !arrId || !date) { UI.toast('請填寫所有查詢條件', 'error'); return; }
        if (depId === arrId) { UI.toast('出發站與到達站不能相同', 'error'); return; }

        const results = trainService.searchSchedules({ departureStationId: depId, arrivalStationId: arrId, date, trainType });
        const ticketTypes = ticketTypeRepo.getAll();
        const typeLabels = { high_speed: '高鐵', express: '自強號', local: '區間車' };

        const html = results.length === 0
            ? '<div class="empty-state"><div class="empty-icon"></div><p>無符合條件的班次</p></div>'
            : results.map(s => {
                const fare = trainService.calculateFare(s.id, ticketTypes[0]?.id);
                const delayMsg = '誤點 ' + s.delayMinutes + '分';
                return `
            <div class="schedule-item">
              <div class="schedule-time">
                <div class="time">${s.departureTime ? s.departureTime.split('T')[1]?.slice(0, 5) || s.departureTime : '—'}</div>
                <div class="station">${s.departureStation?.name || '—'}</div>
              </div>
              <div class="schedule-arrow">
                <div>${typeLabels[s.trainType] || s.trainType} ${s.trainNumber}</div>
                <div>→</div>
                ${UI.badge(s.status, { on_time: '準點', delayed: delayMsg, cancelled: '停駛' })}
              </div>
              <div class="schedule-time">
                <div class="time">${s.arrivalTime ? s.arrivalTime.split('T')[1]?.slice(0, 5) || s.arrivalTime : '—'}</div>
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

    showBookModal(scheduleId) {
        if (!Store.isLoggedIn()) { UI.toast('請先登入', 'error'); return; }
        const ticketTypes = ticketTypeRepo.getAll();
        const schedule = scheduleRepo.getById(scheduleId);
        const fare = trainService.calculateFare(scheduleId, ticketTypes[0]?.id);

        // 安全地拼接選項 HTML
        const optionsHtml = ticketTypes.map(t => {
            return `<option value="${t.id}">${t.name}（折扣率 ${t.discountRate}）</option>`;
        }).join('');

        UI.showModal(`
      <div class="modal-header"><h3>訂票 — ${schedule?.trainNumber}</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>票種</label>
          <select id="tk-type" class="form-control" onchange="ModuleCView.updateFare('${scheduleId}')">
            ${optionsHtml}
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

        trainService.payOrder(result.order.id, 'credit_card');
        UI.closeModal();
        UI.toast('訂票成功！已模擬付款');
        Router.navigate('/my-tickets');
    },

    renderMyTickets() {
        UI.setActiveTab('nav-c');
        const user = Store.getUser();
        if (!user) { Router.navigate('/'); return; }
        const orders = ticketOrderRepo.findByPassengerId(user.id);

        UI.render(`
      <div class="page-header">
        <h1 class="page-title">我的票券</h1>
        <button class="btn btn-outline" onclick="Router.navigate('/trains')">← 返回查詢</button>
      </div>
      ${orders.length === 0 ? '<div class="empty-state"><div class="empty-icon"></div><p>尚無票券</p></div>' :
                orders.map(o => {
                    const sch = scheduleRepo.getById(o.scheduleId);
                    const dep = sch ? stationRepo.getById(sch.departureStationId) : null;
                    const arr = sch ? stationRepo.getById(sch.arrivalStationId) : null;
                    const tt = ticketTypeRepo.getById(o.ticketTypeId);
                    const typeLabels = { high_speed: '高鐵', express: '自強號', local: '區間車' };

                    let btnHtml = '';
                    if (o.status === 'paid') {
                        btnHtml = `
                <button class="btn btn-sm btn-outline" onclick="ModuleCView.showTransferModal('${o.id}')">分票</button>
                <button class="btn btn-sm btn-outline" onclick="ModuleCView.showChangeModal('${o.id}')">改票</button>
                <button class="btn btn-sm btn-danger" onclick="ModuleCView.doRefund('${o.id}')">退票</button>
              `;
                    }

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
                ${UI.badge(o.status, { paid: '已付款', pending: '待付款', transferred: '已轉讓', refunded: '已退票', collected: '已取票' })}
              </div>
              <div class="flex gap-8">
                ${btnHtml}
              </div>
            </div>
          `;
                }).join('')
            }
    `);
    },

    showTransferModal(orderId) {
        UI.showModal(`
      <div class="modal-header"><h3>分票給其他使用者</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
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

        // 安全的字串拼接
        const successMsg = '票券已轉移給 ' + email;
        UI.toast(result.success ? successMsg : result.errors[0], result.success ? 'success' : 'error');
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

        let altHtml = '<p class="text-sm text-muted">同日期無其他可用班次</p>';
        if (alternatives.length > 0) {
            altHtml = alternatives.map(s => {
                return `
            <div class="list-item" style="cursor:pointer" onclick="ModuleCView.doChange('${orderId}','${s.id}')">
              <div class="list-item-content">
                <div class="list-item-title">${s.trainNumber}</div>
                <div class="list-item-subtitle">${UI.formatDateTime(s.departureTime)} · 剩餘 ${s.availableSeats} 座</div>
              </div>
              <button class="btn btn-sm btn-primary">改搭此班</button>
            </div>
            `;
            }).join('');
        }

        UI.showModal(`
      <div class="modal-header"><h3>改票</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <p class="text-sm text-muted mb-16">原班次：${dep?.name} → ${arr?.name} ${UI.formatDateTime(sch.departureTime)}</p>
        ${altHtml}
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

            // 安全的字串拼接
            const successMsg = '退票成功，退款 $' + result.refundAmount;
            UI.toast(result.success ? successMsg : result.errors[0], result.success ? 'success' : 'error');

            this.renderMyTickets();
        });
    },

    renderManagerPanel() {
        UI.setActiveTab('nav-c');
        const user = Store.getUser();
        if (!user || user.role !== 'manager') { UI.toast('需要平台經理權限', 'error'); return; }
        const today = new Date().toISOString().split('T')[0];
        const schedules = scheduleRepo.findByDate(today);

        let scheduleHtml = '<div class="empty-state"><div class="empty-icon"></div><p>今日無班次</p></div>';
        if (schedules.length > 0) {
            scheduleHtml = schedules.map(s => {
                const dep = stationRepo.getById(s.departureStationId);
                const arr = stationRepo.getById(s.arrivalStationId);
                const delayMsg = '誤點 ' + s.delayMinutes + ' 分';
                return `
            <div class="schedule-item">
              <div class="schedule-time">
                <div class="time">${s.departureTime?.split('T')[1]?.slice(0, 5) || s.departureTime}</div>
                <div class="station">${dep?.name || '—'}</div>
              </div>
              <div class="schedule-arrow">
                <div>${s.trainNumber}</div>
                ${UI.badge(s.status, { on_time: '準點', delayed: delayMsg, cancelled: '停駛' })}
              </div>
              <div class="schedule-time">
                <div class="time">${s.arrivalTime?.split('T')[1]?.slice(0, 5) || s.arrivalTime}</div>
                <div class="station">${arr?.name || '—'}</div>
              </div>
              <div class="schedule-info">
                <div class="schedule-seats">剩 ${s.availableSeats} 座</div>
                <button class="btn btn-sm btn-warning mt-8" onclick="ModuleCView.showNotifModal('${s.id}')">發送通知</button>
              </div>
            </div>
          `;
            }).join('');
        }

        const ticketTypeHtml = ticketTypeRepo.getAll().map(tt => {
            return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${tt.name}</div>
              <div class="list-item-subtitle">折扣率：${tt.discountRate}</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="ModuleCView.showEditTicketTypeModal('${tt.id}')">編輯</button>
          </div>
        `;
        }).join('');

        UI.render(`
      <div class="page-header">
        <h1 class="page-title">班次管理</h1>
      </div>
      <div class="card mb-16">
        <div class="card-header"><span class="card-title">票種折扣設定</span></div>
        ${ticketTypeHtml}
      </div>
      <div class="card-header mb-8"><span class="card-title">今日班次 (${today})</span></div>
      ${scheduleHtml}
    `);
    },

    showEditTicketTypeModal(typeId) {
        const tt = ticketTypeRepo.getById(typeId);
        UI.showModal(`
      <div class="modal-header"><h3>編輯票種：${tt.name}</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
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
      <div class="modal-header"><h3>發送異常通知</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
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