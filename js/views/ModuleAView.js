/** Module A — 行程規劃 View */
const ModuleAView = {

  /* ─── 行程列表 ─── */
  renderTripList() {
    UI.setActiveTab('nav-a');
    const user = Store.getUser();
    if (!user) { Router.navigate('/'); return; }

    const myMemberships = tripMemberRepo.findByUserId(user.id);
    const tripIds = myMemberships.map(m => m.tripId);
    let trips = tripIds.map(id => tripRepo.getById(id)).filter(Boolean);

    const filterStatus = UI.val('trip-filter') || 'all';
    if (filterStatus !== 'all') trips = trips.filter(t => t.status === filterStatus);

    const isHost = t => t.hostId === user.id;

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">我的行程</h1>
        <button class="btn btn-primary" onclick="ModuleAView.showCreateTripModal()">＋ 建立行程</button>
      </div>
      <div class="filter-bar">
        <select class="form-control" id="trip-filter" onchange="ModuleAView.renderTripList()" style="max-width:160px">
          <option value="all">全部狀態</option>
          <option value="planning">規劃中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      ${trips.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"></div>
          <p>還沒有行程，馬上建立第一個吧！</p>
        </div>
      ` : trips.map(t => `
        <div class="trip-card" onclick="Router.navigate('/trip/${t.id}')">
          <div class="trip-card-header">
            <div>
              <div class="trip-card-title">${t.title}</div>
              <div class="trip-card-meta">
                <span>${t.destination}</span>
                <span>${UI.formatDate(t.startDate)} ~ ${UI.formatDate(t.endDate)}</span>
                <span>${t.totalDays} 天</span>
                ${t.budgetLimit ? `<span>預算 $${t.budgetLimit.toLocaleString()}</span>` : ''}
              </div>
            </div>
            ${UI.badge(t.status)}
          </div>
          <div class="trip-card-actions" onclick="event.stopPropagation()">
            ${isHost(t) ? `
              <button class="btn btn-sm btn-outline" onclick="ModuleAView.showCopyTripModal('${t.id}')">複製</button>
              <button class="btn btn-sm btn-success" onclick="ModuleAView.setStatus('${t.id}','completed')">完成</button>
              <button class="btn btn-sm btn-danger" onclick="ModuleAView.setStatus('${t.id}','cancelled')">取消</button>
            ` : `<span class="text-sm text-muted">旅伴</span>`}
            <span class="text-sm text-muted" style="margin-left:auto;"><a href="javascript:void(0)" onclick="ModuleAView.copyShareLink('${t.id}')">分享連結</a></span>
          </div>
        </div>
      `).join('')}
    `);

    // 還原篩選值
    if (filterStatus !== 'all') document.getElementById('trip-filter').value = filterStatus;
  },

  showCreateTripModal() {
    const today = new Date().toISOString().split('T')[0];
    UI.showModal(`
      <div class="modal-header"><h3>建立新行程</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group"><label>行程名稱</label><input id="c-title" class="form-control" placeholder="台東三日遊"></div>
        <div class="form-group"><label>目的地</label><input id="c-dest" class="form-control" placeholder="台東縣"></div>
        <div class="form-row">
          <div class="form-group"><label>出發日期</label><input id="c-start" class="form-control" type="date" value="${today}"></div>
          <div class="form-group"><label>結束日期</label><input id="c-end" class="form-control" type="date"></div>
        </div>
        <div class="form-group"><label>預算上限（選填）</label><input id="c-budget" class="form-control" type="number" placeholder="10000"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.doCreateTrip()">建立</button>
      </div>
    `);
  },

  doCreateTrip() {
    const title = UI.val('c-title'), dest = UI.val('c-dest');
    const startDate = UI.val('c-start'), endDate = UI.val('c-end');
    if (!title || !dest || !startDate || !endDate) { UI.toast('請填寫所有必填欄位', 'error'); return; }
    if (new Date(endDate) < new Date(startDate)) { UI.toast('結束日期不可早於出發日期', 'error'); return; }
    const budgetLimit = parseFloat(UI.val('c-budget')) || null;
    tripService.createTrip({ title, destination: dest, startDate, endDate, budgetLimit });
    UI.closeModal();
    UI.toast('行程建立成功！');
    this.renderTripList();
  },

  showCopyTripModal(tripId) {
    tripService.copyTrip(tripId);
    UI.toast('行程已複製！');
    this.renderTripList();
  },

  setStatus(tripId, status) {
    tripService.updateTripStatus(tripId, status);
    UI.toast('行程狀態已更新');
    this.renderTripList();
  },

  copyShareLink(tripId) {
    const link = tripService.getShareLink(tripId);
    navigator.clipboard?.writeText(link).catch(() => {});
    UI.toast('分享連結已複製！');
  },

  /* ─── 分享連結檢視（不需登入，唯讀） ─── */
  renderSharedTrip(token) {
    UI.setActiveTab('');
    const trip = tripRepo.findByShareToken(token);
    if (!trip) {
      UI.render(`<div class="empty-state"><div class="empty-icon"></div><p>找不到此分享連結，可能已失效。</p></div>`);
      return;
    }
    const days = tripDayRepo.findByTripId(trip.id);
    const members = tripMemberRepo.findByTripId(trip.id);
    const expenses = expenseRepo.findByTripId(trip.id);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    const daysHtml = days.map(day => {
      const spots = tripSpotItemRepo.findByDayId(day.id);
      return `
        <div class="card" style="margin-bottom:12px">
          <div style="font-weight:700;margin-bottom:8px">Day ${day.dayNumber}　<span class="text-muted text-sm">${UI.formatDate(day.date)}</span></div>
          ${spots.length === 0 ? `<p class="text-muted text-sm">尚無景點</p>` : spots.map(s => `
            <div class="list-item">
              <span>${s.customName || s.spotId}</span>
              ${s.isMustGoCandidate ? `<span class="badge badge-warning">必去</span>` : ''}
            </div>
          `).join('')}
        </div>`;
    }).join('');

    UI.render(`
      <div class="page-header">
        <div>
          <h1 class="page-title">${trip.title}</h1>
          <div class="text-muted text-sm">${trip.destination}　${UI.formatDate(trip.startDate)} ~ ${UI.formatDate(trip.endDate)}　${trip.totalDays} 天</div>
        </div>
        ${UI.badge(trip.status)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div class="card">
          <div class="text-sm text-muted">旅伴（${members.length} 人）</div>
          ${members.map(m => `<div class="list-item text-sm">${UI.avatar(userRepo.getById(m.userId)?.name || '?')} ${userRepo.getById(m.userId)?.name || '未知'}</div>`).join('')}
        </div>
        <div class="card">
          <div class="text-sm text-muted">總花費</div>
          <div style="font-size:1.4rem;font-weight:700;color:var(--primary)">$${totalExpense.toLocaleString()}</div>
          ${trip.budgetLimit ? `<div class="text-sm text-muted">預算上限 $${trip.budgetLimit.toLocaleString()}</div>` : ''}
        </div>
      </div>
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:12px">每日行程</h2>
      ${daysHtml}
      <div style="text-align:center;margin-top:24px">
        <a href="#/" class="btn btn-outline">登入 Agent TT</a>
      </div>
    `);
  },

  /* ─── 行程詳細頁 ─── */
  renderTripDetail(tripId) {
    UI.setActiveTab('nav-a');
    const trip = tripRepo.getById(tripId);
    if (!trip) { UI.toast('找不到行程', 'error'); Router.navigate('/trips'); return; }

    const days = tripDayRepo.findByTripId(tripId);
    const members = tripMemberRepo.findByTripId(tripId);
    const memberUsers = members.map(m => ({ ...m, user: userRepo.getById(m.userId) }));
    const expenses = expenseRepo.findByTripId(tripId);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const budgetPct = trip.budgetLimit ? Math.min(100, (totalExpense / trip.budgetLimit) * 100) : 0;
    const user = Store.getUser();
    const isHost = trip.hostId === user.id;

    UI.render(`
      <div class="flex-center justify-between mb-16">
        <div>
          <button class="btn btn-sm btn-outline" onclick="Router.navigate('/trips')">← 返回</button>
          <span class="ml-8 text-muted">/ ${trip.title}</span>
        </div>
        ${UI.badge(trip.status)}
      </div>

      <div class="tabs">
        <button class="tab-btn active" onclick="ModuleAView.switchTab('tab-days','${tripId}',this)">每日行程</button>
        <button class="tab-btn" onclick="ModuleAView.switchTab('tab-collab','${tripId}',this)">協作</button>
        <button class="tab-btn" onclick="ModuleAView.switchTab('tab-budget','${tripId}',this)">預算</button>
        <button class="tab-btn" onclick="ModuleAView.switchTab('tab-vote','${tripId}',this)">投票</button>
      </div>

      <!-- 每日行程 -->
      <div id="tab-days">
        <div class="flex-center justify-between mb-16">
          <span class="text-sm text-muted">${trip.destination} · ${UI.formatDate(trip.startDate)} ~ ${UI.formatDate(trip.endDate)}</span>
          ${isHost ? `<button class="btn btn-sm btn-outline" onclick="ModuleAView.undoEdit('${tripId}')">↩ 撤銷</button>` : ''}
        </div>
        ${days.map(day => {
          const items = tripSpotItemRepo.findByDayId(day.id);
          return `
            <div class="day-section">
              <div class="day-header">
                <div class="day-number">D${day.dayNumber}</div>
                <strong>第 ${day.dayNumber} 天</strong>
                <span class="text-sm text-muted">${UI.formatDate(day.date)}</span>
                <span class="text-sm text-muted" style="margin-left:auto;">${day.notes||''}</span>
                <button class="btn btn-sm btn-primary" onclick="ModuleAView.showAddSpotModal('${day.id}','${tripId}')">＋ 景點</button>
              </div>
              ${items.length === 0 ? '<p class="text-sm text-muted" style="padding:8px 14px;">尚未加入景點</p>' :
                items.map((item, idx) => `
                  <div class="spot-item ${item.isMustGoCandidate ? 'must-go' : ''}">
                    <span class="spot-item-order">${idx+1}.</span>
                    <div class="spot-item-content">
                      <div class="spot-item-name">
                        ${item.customName || (item.spotId ? spotRepo.getById(item.spotId)?.name || '' : '')}
                        ${item.isMustGoCandidate ? ' [必去]' : ''}
                      </div>
                      <div class="spot-item-meta">
                        ${item.departureTime ? `出發：${item.departureTime}` : ''}
                        ${item.durationMinutes ? `· ${item.durationMinutes}分鐘` : ''}
                        ${item.notes ? `· ${item.notes}` : ''}
                      </div>
                    </div>
                    <div class="spot-item-actions">
                      <button class="btn-icon" title="標記必去" onclick="ModuleAView.toggleMustGo('${item.id}','${tripId}')">必去</button>
                      <button class="btn-icon" title="備註" onclick="ModuleAView.showNoteModal('${item.id}','${tripId}')">備註</button>
                      <button class="btn-icon" title="刪除" onclick="ModuleAView.deleteSpot('${item.id}','${tripId}')">刪除</button>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          `;
        }).join('')}
      </div>

      <!-- 協作 -->
      <div id="tab-collab" class="hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">成員列表</span>
            ${isHost ? `<button class="btn btn-sm btn-primary" onclick="ModuleAView.showInviteModal('${tripId}')">邀請旅伴</button>` : ''}
          </div>
          ${memberUsers.map(m => `
            <div class="list-item">
              ${UI.avatar(m.user?.name || '?')}
              <div class="list-item-content">
                <div class="list-item-title">${m.user?.name || '未知使用者'}</div>
                <div class="list-item-subtitle">${m.user?.email || ''} · ${m.role === 'host' ? '主邀約人' : '旅伴'}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">留言討論</span></div>
          <div class="chat-container">
            <div class="chat-messages" id="chat-msgs">
              ${tripCommentRepo.findByTripId(tripId).map(c => {
                const sender = userRepo.getById(c.userId);
                const isMine = c.userId === user.id;
                return `<div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
                  <div>${c.content}</div>
                  <div class="msg-meta">${isMine ? '我' : (sender?.name || '?')} · ${UI.formatDateTime(c.createdAt)}</div>
                </div>`;
              }).join('')}
            </div>
            <div class="chat-input-row">
              <input id="chat-input" placeholder="輸入訊息…" onkeydown="if(event.key==='Enter')ModuleAView.sendComment('${tripId}')">
              <button onclick="ModuleAView.sendComment('${tripId}')">送出</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 預算 -->
      <div id="tab-budget" class="hidden">
        <div class="card">
          <div class="card-header">
            <span class="card-title">費用總覽</span>
            <button class="btn btn-sm btn-primary" onclick="ModuleAView.showAddExpenseModal('${tripId}')">＋ 新增費用</button>
          </div>
          ${trip.budgetLimit ? `
            <div class="flex-center justify-between text-sm mb-8">
              <span>已花費 <strong>$${totalExpense.toLocaleString()}</strong></span>
              <span>預算 <strong>$${trip.budgetLimit.toLocaleString()}</strong></span>
            </div>
            <div class="budget-bar">
              <div class="budget-fill ${budgetPct >= 100 ? 'over' : budgetPct >= 80 ? 'warning' : ''}" style="width:${budgetPct}%"></div>
            </div>
          ` : `<p class="text-sm text-muted mb-8">總花費：<strong>$${totalExpense.toLocaleString()}</strong></p>`}
          ${expenses.length === 0 ? '<p class="text-sm text-muted">尚無費用紀錄</p>' :
            expenses.map(e => `
              <div class="expense-row">
                <div>
                  <div class="text-sm font-medium">${e.description || e.category}</div>
                  <div class="text-sm text-muted">${e.expenseDate} · ${e.category}</div>
                </div>
                <span class="expense-amount">$${e.amount.toLocaleString()}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- 投票 -->
      <div id="tab-vote" class="hidden">
        <div class="flex-center justify-between mb-16">
          <span class="card-title">景點投票</span>
          <button class="btn btn-sm btn-primary" onclick="ModuleAView.showCreatePollModal('${tripId}')">＋ 建立投票</button>
        </div>
        ${pollRepo.findByTripId(tripId).map(poll => {
          const opts = pollOptionRepo.findByPollId(poll.id);
          const totalVotes = opts.reduce((s, o) => s + pollVoteRepo.countByOptionId(o.id), 0);
          return `
            <div class="card">
              <div class="card-header">
                <span class="card-title">${poll.title}</span>
                <button class="btn btn-sm btn-outline" onclick="ModuleAView.showAddOptionModal('${poll.id}','${tripId}')">＋ 選項</button>
              </div>
              ${opts.map(opt => {
                const votes = pollVoteRepo.countByOptionId(opt.id);
                const voted = pollVoteRepo.findByUserAndOption(user.id, opt.id);
                const pct = totalVotes ? Math.round(votes / totalVotes * 100) : 0;
                return `
                  <div class="poll-option">
                    <button class="btn btn-sm ${voted ? 'btn-primary' : 'btn-outline'}" onclick="ModuleAView.doVote('${opt.id}','${tripId}')">${voted ? '已投' : '投票'}</button>
                    <span style="flex:1">${opt.label}</span>
                    <div class="poll-bar"><div class="poll-bar-fill" style="width:${pct}%"></div></div>
                    <span class="poll-count">${votes} 票</span>
                    ${isHost ? `<button class="btn-icon" onclick="ModuleAView.deletePollOption('${opt.id}','${tripId}')">刪除</button>` : ''}
                  </div>
                `;
              }).join('')}
              ${opts.length === 0 ? '<p class="text-sm text-muted">尚無選項</p>' : ''}
            </div>
          `;
        }).join('')}
        ${pollRepo.findByTripId(tripId).length === 0 ? '<div class="empty-state"><div class="empty-icon"></div><p>尚未建立投票</p></div>' : ''}
      </div>
    `);

    // 滾到最新留言
    const chatMsgs = document.getElementById('chat-msgs');
    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
  },

  switchTab(tabId, tripId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['tab-days','tab-collab','tab-budget','tab-vote'].forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', id !== tabId);
    });
  },

  showAddSpotModal(dayId, tripId) {
    const recommended = spotRepo.findRecommended();
    UI.showModal(`
      <div class="modal-header"><h3>新增景點</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>搜尋景點</label>
          <input id="spot-search" class="form-control" placeholder="輸入景點名稱…" oninput="ModuleAView.searchSpots(this.value,'${dayId}','${tripId}')">
        </div>
        <div id="spot-results">
          <p class="text-sm text-muted mb-8">推薦景點：</p>
          ${recommended.map(s => `
            <div class="list-item" style="cursor:pointer" onclick="ModuleAView.selectSpot('${s.id}','${dayId}','${tripId}')">
              <div class="list-item-content">
                <div class="list-item-title">${s.name}</div>
                <div class="list-item-subtitle">${s.address} · 距車站 ${s.distanceFromStation}km · ${s.category}</div>
              </div>
              <button class="btn btn-sm btn-primary">加入</button>
            </div>
          `).join('')}
        </div>
        <hr style="margin:16px 0">
        <p class="text-sm font-medium mb-8">手動新增</p>
        <div class="form-group"><label>景點名稱</label><input id="custom-spot-name" class="form-control" placeholder="自訂景點"></div>
        <div class="form-row">
          <div class="form-group"><label>出發時間</label><input id="custom-spot-time" class="form-control" type="time"></div>
          <div class="form-group"><label>停留時間（分鐘）</label><input id="custom-spot-dur" class="form-control" type="number" value="60"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.addCustomSpot('${dayId}','${tripId}')">手動新增</button>
      </div>
    `);
  },

  searchSpots(keyword, dayId, tripId) {
    const results = keyword ? spotRepo.search(keyword) : spotRepo.findRecommended();
    document.getElementById('spot-results').innerHTML = results.map(s => `
      <div class="list-item" style="cursor:pointer">
        <div class="list-item-content">
          <div class="list-item-title">${s.name}</div>
          <div class="list-item-subtitle">${s.address}</div>
        </div>
        <button class="btn btn-sm btn-primary" onclick="ModuleAView.selectSpot('${s.id}','${dayId}','${tripId}')">加入</button>
      </div>
    `).join('') || '<p class="text-sm text-muted">無搜尋結果</p>';
  },

  selectSpot(spotId, dayId, tripId) {
    const spot = spotRepo.getById(spotId);
    tripService.addSpotToDay(dayId, { spotId, customName: spot.name });
    UI.closeModal();
    UI.toast(`已新增景點：${spot.name}`);
    this.renderTripDetail(tripId);
  },

  addCustomSpot(dayId, tripId) {
    const name = UI.val('custom-spot-name');
    if (!name) { UI.toast('請輸入景點名稱', 'error'); return; }
    tripService.addSpotToDay(dayId, {
      customName: name,
      departureTime: UI.val('custom-spot-time'),
      durationMinutes: parseInt(UI.val('custom-spot-dur')) || 60
    });
    UI.closeModal();
    UI.toast(`已新增景點：${name}`);
    this.renderTripDetail(tripId);
  },

  deleteSpot(itemId, tripId) {
    UI.confirm('確定刪除此景點？').then(ok => {
      if (!ok) return;
      tripService.deleteSpotItem(itemId);
      UI.toast('景點已刪除');
      this.renderTripDetail(tripId);
    });
  },

  toggleMustGo(itemId, tripId) {
    const item = tripService.toggleMustGo(itemId);
    UI.toast(item.isMustGoCandidate ? '已標記為必去候選' : '已取消必去標記');
    this.renderTripDetail(tripId);
  },

  showNoteModal(itemId, tripId) {
    const item = tripSpotItemRepo.getById(itemId);
    UI.showModal(`
      <div class="modal-header"><h3>景點備註</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>${item.customName || '景點'}</label>
          <textarea id="note-input" class="form-control" rows="3" placeholder="輸入注意事項…">${item.notes||''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.saveNote('${itemId}','${tripId}')">儲存</button>
      </div>
    `);
  },

  saveNote(itemId, tripId) {
    tripService.updateSpotNote(itemId, UI.val('note-input'));
    UI.closeModal();
    UI.toast('備註已儲存');
    this.renderTripDetail(tripId);
  },

  undoEdit(tripId) {
    const ok = tripService.undoLastEdit(tripId);
    UI.toast(ok ? '已撤銷上一個操作' : '沒有可撤銷的操作', ok ? 'success' : 'warning');
    if (ok) this.renderTripDetail(tripId);
  },

  showInviteModal(tripId) {
    UI.showModal(`
      <div class="modal-header"><h3>邀請旅伴</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>旅伴 Email</label>
          <input id="invite-email" class="form-control" type="email" placeholder="friend@email.com">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.doInvite('${tripId}')">邀請</button>
      </div>
    `);
  },

  doInvite(tripId) {
    const email = UI.val('invite-email');
    const result = tripService.inviteMember(tripId, email);
    UI.closeModal();
    UI.toast(result.success ? `已邀請 ${email}` : result.error, result.success ? 'success' : 'error');
    this.renderTripDetail(tripId);
  },

  sendComment(tripId) {
    const input = document.getElementById('chat-input');
    const content = input?.value.trim();
    if (!content) return;
    tripService.addComment(tripId, content);
    input.value = '';
    this.renderTripDetail(tripId);
    // 切回留言 tab
    document.querySelector('[onclick*="tab-collab"]')?.click();
  },

  showAddExpenseModal(tripId) {
    const today = new Date().toISOString().split('T')[0];
    const members = tripMemberRepo.findByTripId(tripId);
    const memberOptions = members.map(m => {
      const u = userRepo.getById(m.userId);
      return `<option value="${m.userId}">${u?.name || '未知'}</option>`;
    }).join('');

    UI.showModal(`
      <div class="modal-header"><h3>新增費用</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>金額</label><input id="exp-amount" class="form-control" type="number" placeholder="0"></div>
          <div class="form-group"><label>日期</label><input id="exp-date" class="form-control" type="date" value="${today}"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>類別</label>
            <select id="exp-cat" class="form-control">
              <option value="transport">交通</option><option value="food">餐飲</option>
              <option value="accommodation">住宿</option><option value="activity">活動</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="form-group"><label>付款人</label><select id="exp-payer" class="form-control">${memberOptions}</select></div>
        </div>
        <div class="form-group"><label>說明</label><input id="exp-desc" class="form-control" placeholder="例如：午餐"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.doAddExpense('${tripId}')">新增</button>
      </div>
    `);
  },

  doAddExpense(tripId) {
    const amount = parseFloat(UI.val('exp-amount'));
    if (!amount || amount <= 0) { UI.toast('請輸入有效金額', 'error'); return; }
    tripService.addExpense(tripId, {
      amount, category: UI.val('exp-cat'),
      description: UI.val('exp-desc'), expenseDate: UI.val('exp-date'),
      paidBy: UI.val('exp-payer')
    });
    UI.closeModal();
    UI.toast('費用已新增');
    this.renderTripDetail(tripId);
    document.querySelector('[onclick*="tab-budget"]')?.click();
  },

  showCreatePollModal(tripId) {
    UI.showModal(`
      <div class="modal-header"><h3>建立投票</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group"><label>投票主題</label><input id="poll-title" class="form-control" placeholder="下午去哪裡？"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.doCreatePoll('${tripId}')">建立</button>
      </div>
    `);
  },

  doCreatePoll(tripId) {
    const title = UI.val('poll-title');
    if (!title) { UI.toast('請輸入主題', 'error'); return; }
    tripService.createPoll(tripId, title);
    UI.closeModal();
    UI.toast('投票建立成功');
    this.renderTripDetail(tripId);
    document.querySelector('[onclick*="tab-vote"]')?.click();
  },

  showAddOptionModal(pollId, tripId) {
    UI.showModal(`
      <div class="modal-header"><h3>新增投票選項</h3><button class="close-btn" onclick="UI.closeModal()">X</button></div>
      <div class="modal-body">
        <div class="form-group"><label>選項名稱</label><input id="opt-label" class="form-control" placeholder="知本溫泉"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleAView.doAddOption('${pollId}','${tripId}')">新增</button>
      </div>
    `);
  },

  doAddOption(pollId, tripId) {
    const label = UI.val('opt-label');
    if (!label) { UI.toast('請輸入選項名稱', 'error'); return; }
    tripService.addPollOption(pollId, label);
    UI.closeModal();
    this.renderTripDetail(tripId);
    document.querySelector('[onclick*="tab-vote"]')?.click();
  },

  doVote(optionId, tripId) {
    tripService.vote(optionId);
    this.renderTripDetail(tripId);
    document.querySelector('[onclick*="tab-vote"]')?.click();
  },

  deletePollOption(optionId, tripId) {
    tripService.deletePollOption(optionId);
    UI.toast('選項已刪除');
    this.renderTripDetail(tripId);
    document.querySelector('[onclick*="tab-vote"]')?.click();
  }
};

window.ModuleAView = ModuleAView;
