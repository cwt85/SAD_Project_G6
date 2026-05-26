/** Module B — 訂房系統 View */
const ModuleBView = {

  /* ─── 顧客：搜尋房源 ─── */
  renderSearch() {
    UI.setActiveTab('nav-b');
    UI.render(`
      <div class="page-header">
        <h1 class="page-title">🏨 住宿搜尋</h1>
        <button class="btn btn-outline" onclick="Router.navigate('/bookings')">📋 我的訂單</button>
      </div>
      <div class="filter-bar">
        <input id="b-keyword" class="form-control" placeholder="搜尋住宿名稱或地點…" style="flex:2">
        <input id="b-dist" class="form-control" type="number" placeholder="最遠距車站(km)" style="max-width:160px">
        <button class="btn btn-primary" onclick="ModuleBView.doSearch()">搜尋</button>
      </div>
      <div id="acc-results">
        ${this._renderAccList(bookingService.searchAccommodations())}
      </div>
    `);
  },

  doSearch() {
    const keyword = UI.val('b-keyword');
    const maxDistance = parseFloat(UI.val('b-dist')) || 999;
    const results = bookingService.searchAccommodations({ keyword, maxDistance });
    document.getElementById('acc-results').innerHTML = this._renderAccList(results);
  },

  _renderAccList(list) {
    if (!list.length) return '<div class="empty-state"><div class="empty-icon">🏨</div><p>無符合條件的房源</p></div>';
    return `<div class="acc-grid">${list.map(acc => `
      <div class="acc-card" onclick="Router.navigate('/accommodation/${acc.id}')">
        <div class="acc-card-img">🏨</div>
        <div class="acc-card-body">
          <div class="acc-card-title">${acc.name}</div>
          <div class="acc-card-meta">
            <span>📍 ${acc.address}</span>
            <span>🚉 ${acc.distanceFromStation}km</span>
            ${acc.avgRating ? `<span class="stars">${UI.stars(acc.avgRating)}</span>` : ''}
          </div>
          <div class="flex-center justify-between">
            <span class="acc-card-price">查看定價</span>
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();ModuleBView.toggleFav('${acc.id}',this)">
              ${favoriteRepo.findOne(Store.getUser()?.id, acc.id) ? '❤️' : '🤍'} 收藏
            </button>
          </div>
        </div>
      </div>
    `).join('')}</div>`;
  },

  toggleFav(accId, btn) {
    if (!Store.isLoggedIn()) { UI.toast('請先登入', 'error'); return; }
    const result = bookingService.toggleFavorite(accId);
    btn.innerHTML = result.isFavorited ? '❤️ 收藏' : '🤍 收藏';
    UI.toast(result.isFavorited ? '已加入收藏' : '已移除收藏');
  },

  /* ─── 房源詳細頁 ─── */
  renderAccommodationDetail(accId) {
    UI.setActiveTab('nav-b');
    const detail = bookingService.getAccommodationDetail(accId);
    if (!detail) { UI.toast('找不到此房源', 'error'); Router.navigate('/accommodations'); return; }
    const user = Store.getUser();
    const isFav = user && favoriteRepo.findOne(user.id, accId);

    UI.render(`
      <button class="btn btn-sm btn-outline mb-16" onclick="Router.navigate('/accommodations')">← 返回搜尋</button>
      <div class="card">
        <div style="height:200px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:4rem;margin-bottom:16px">🏨</div>
        <div class="flex-center justify-between mb-8">
          <h2 style="font-size:1.4rem;font-weight:700">${detail.name}</h2>
          <div class="flex gap-8">
            <button class="btn btn-outline" onclick="ModuleBView.toggleFav('${accId}',this)">${isFav ? '❤️' : '🤍'} 收藏</button>
          </div>
        </div>
        <p class="text-muted text-sm mb-8">📍 ${detail.address} · 🚉 距車站 ${detail.distanceFromStation}km</p>
        <p class="text-sm mb-16">${detail.description}</p>
        <div class="form-row" style="margin-bottom:16px">
          <div><strong>入住時間：</strong>${detail.checkInTime}</div>
          <div><strong>退房時間：</strong>${detail.checkOutTime}</div>
          <div><strong>最多入住：</strong>${detail.maxGuests} 人</div>
        </div>
        <div class="text-sm text-muted">
          ${detail.policyNoSmoking ? '🚭 禁菸 ' : ''}
          ${detail.policyNoPets ? '🐾 禁寵物 ' : ''}
          ${detail.policyOthers ? detail.policyOthers : ''}
        </div>
      </div>

      <!-- 房型 -->
      <h3 style="font-size:1rem;font-weight:600;margin:16px 0 8px">可訂房型</h3>
      ${detail.roomTypes.map(rt => {
        const rules = pricingRuleRepo.findByRoomTypeId(rt.id);
        const weekdayRule = rules.find(r => r.priceType === 'weekday');
        return `
          <div class="card" style="margin-bottom:12px">
            <div class="flex-center justify-between">
              <div>
                <div style="font-weight:600">${rt.name}</div>
                <div class="text-sm text-muted">最多 ${rt.capacity} 人 · 共 ${rt.totalRooms} 間</div>
                <div class="text-sm text-muted mt-8">${(rt.amenities||[]).join(' · ')}</div>
              </div>
              <div class="text-right">
                ${weekdayRule ? `<div class="acc-card-price">平日 $${weekdayRule.pricePerNight.toLocaleString()}/晚</div>` : ''}
                <button class="btn btn-primary mt-8" onclick="ModuleBView.showBookingModal('${rt.id}','${accId}')">立即預訂</button>
                <button class="btn btn-outline btn-sm mt-8" onclick="ModuleBView.addToCart('${rt.id}','${accId}')">加入購物車</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}

      <!-- 評價 -->
      <h3 style="font-size:1rem;font-weight:600;margin:16px 0 8px">旅客評價 (${detail.reviews.length})</h3>
      ${detail.reviews.length === 0 ? '<p class="text-sm text-muted">尚無評價</p>' :
        detail.reviews.map(r => {
          const reviewer = userRepo.getById(r.customerId);
          return `
            <div class="card" style="margin-bottom:8px">
              <div class="flex-center gap-8 mb-8">
                ${UI.avatar(reviewer?.name || '?')}
                <div>
                  <div style="font-weight:500">${reviewer?.name || '匿名'}</div>
                  <div class="stars text-sm">${UI.stars(r.rating)}</div>
                </div>
              </div>
              <p class="text-sm">${r.content}</p>
            </div>
          `;
        }).join('')
      }

      <!-- 聊天室 -->
      <h3 style="font-size:1rem;font-weight:600;margin:16px 0 8px">💬 聯絡房東</h3>
      <div class="card">
        <div class="chat-container">
          <div class="chat-messages" id="b-chat-msgs">
            ${user ? (() => {
              const adminId = detail.adminId;
              return chatMessageRepo.findConversation(user.id, adminId).map(m => {
                const isMine = m.senderId === user.id;
                return `<div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
                  <div>${m.content}</div>
                  <div class="msg-meta">${UI.formatDateTime(m.createdAt)}</div>
                </div>`;
              }).join('') || '<p class="text-sm text-muted" style="text-align:center;padding:20px">開始與房東溝通…</p>';
            })() : '<p class="text-sm text-muted" style="text-align:center;padding:20px">請先登入以使用聊天功能</p>'}
          </div>
          ${user ? `
            <div class="chat-input-row">
              <input id="b-chat-input" placeholder="輸入訊息…" onkeydown="if(event.key==='Enter')ModuleBView.sendMsg('${detail.adminId}','${accId}')">
              <button onclick="ModuleBView.sendMsg('${detail.adminId}','${accId}')">送出</button>
            </div>
          ` : ''}
        </div>
      </div>
    `);
    const el = document.getElementById('b-chat-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  },

  sendMsg(receiverId, accId) {
    const input = document.getElementById('b-chat-input');
    const content = input?.value.trim();
    if (!content) return;
    bookingService.sendMessage(receiverId, content, accId);
    input.value = '';
    this.renderAccommodationDetail(accId);
  },

  addToCart(roomTypeId, accId) {
    if (!Store.isLoggedIn()) { UI.toast('請先登入', 'error'); return; }
    const user = Store.getUser();
    const today = new Date().toISOString().split('T')[0];
    const result = bookingService.addToCart({ userId: user.id, accommodationId: accId, roomTypeId,
      checkInDate: today, checkOutDate: today, guestCount: 1 });
    UI.toast(result.success ? '已加入購物車' : result.errors[0], result.success ? 'success' : 'error');
  },

  showBookingModal(roomTypeId, accId) {
    if (!Store.isLoggedIn()) { UI.toast('請先登入', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    const roomType = roomTypeRepo.getById(roomTypeId);
    UI.showModal(`
      <div class="modal-header"><h3>預訂 ${roomType?.name}</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>入住日期</label><input id="bk-in" class="form-control" type="date" value="${today}" onchange="ModuleBView.calcPrice('${roomTypeId}')"></div>
          <div class="form-group"><label>退房日期</label><input id="bk-out" class="form-control" type="date" onchange="ModuleBView.calcPrice('${roomTypeId}')"></div>
        </div>
        <div class="form-group"><label>入住人數</label><input id="bk-guests" class="form-control" type="number" value="1" min="1" max="${roomType?.capacity||2}"></div>
        <div id="bk-price-info" class="text-sm text-muted"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleBView.doBook('${roomTypeId}','${accId}')">確認預訂</button>
      </div>
    `);
  },

  calcPrice(roomTypeId) {
    const checkIn = UI.val('bk-in'), checkOut = UI.val('bk-out');
    if (!checkIn || !checkOut) return;
    const { total, nights } = bookingService.calculatePrice(roomTypeId, checkIn, checkOut);
    const el = document.getElementById('bk-price-info');
    if (el) el.innerHTML = `住宿 ${nights} 晚 · 預估總價：<strong style="color:var(--primary)">$${total.toLocaleString()}</strong>`;
  },

  doBook(roomTypeId, accId) {
    const checkInDate = UI.val('bk-in'), checkOutDate = UI.val('bk-out');
    const guestCount = parseInt(UI.val('bk-guests')) || 1;
    const result = bookingService.createBooking({ roomTypeId, accommodationId: accId, checkInDate, checkOutDate, guestCount });
    if (!result.success) { UI.toast(result.errors.join('、'), 'error'); return; }
    bookingService.confirmPayment(result.booking.id); // 模擬即時確認
    UI.closeModal();
    UI.toast('訂單建立成功！已模擬付款確認');
    Router.navigate('/bookings');
  },

  /* ─── 顧客：歷史訂單 ─── */
  renderBookings() {
    UI.setActiveTab('nav-b');
    const user = Store.getUser();
    if (!user) { Router.navigate('/'); return; }
    const bookings = bookingRepo.findByCustomerId(user.id);

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">📋 我的訂單</h1>
        <button class="btn btn-outline" onclick="Router.navigate('/accommodations')">← 返回搜尋</button>
      </div>
      ${bookings.length === 0 ? '<div class="empty-state"><div class="empty-icon">📋</div><p>尚無訂單紀錄</p></div>' :
        bookings.map(b => {
          const acc = accommodationRepo.getById(b.accommodationId);
          const rt = roomTypeRepo.getById(b.roomTypeId);
          const hasReview = reviewRepo.findByBookingId(b.id);
          return `
            <div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">${acc?.name || '未知房源'} — ${rt?.name || ''}</div>
                  <div class="text-sm text-muted">${UI.formatDate(b.checkInDate)} ~ ${UI.formatDate(b.checkOutDate)} · ${b.guestCount} 人</div>
                </div>
                ${UI.badge(b.status)}
              </div>
              <div class="flex-center justify-between">
                <div>
                  <div class="text-sm">總金額：<strong>$${b.finalPrice?.toLocaleString()}</strong></div>
                  ${b.refundAmount ? `<div class="text-sm text-muted">退款：$${b.refundAmount.toLocaleString()}</div>` : ''}
                </div>
                <div class="flex gap-8">
                  ${['confirmed','pending'].includes(b.status) ? `
                    <button class="btn btn-sm btn-danger" onclick="ModuleBView.cancelBooking('${b.id}')">取消訂單</button>
                  ` : ''}
                  ${b.status === 'confirmed' && !hasReview ? `
                    <button class="btn btn-sm btn-outline" onclick="ModuleBView.showReviewModal('${b.id}')">撰寫評價</button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')
      }
    `);
  },

  cancelBooking(bookingId) {
    UI.confirm('確定要取消此訂單？').then(ok => {
      if (!ok) return;
      const result = bookingService.cancelBooking(bookingId, '顧客主動取消');
      if (result.success) {
        UI.toast(`訂單已取消。${result.refundAmount > 0 ? `退款 $${result.refundAmount}（${result.strategyName}）` : '不予退款'}`);
      } else {
        UI.toast(result.errors.join('、'), 'error');
      }
      this.renderBookings();
    });
  },

  showReviewModal(bookingId) {
    UI.showModal(`
      <div class="modal-header"><h3>撰寫評價</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label>評分</label>
          <select id="rv-rating" class="form-control">
            <option value="5">★★★★★ 非常滿意</option>
            <option value="4">★★★★☆ 滿意</option>
            <option value="3">★★★☆☆ 普通</option>
            <option value="2">★★☆☆☆ 不滿意</option>
            <option value="1">★☆☆☆☆ 非常不滿意</option>
          </select>
        </div>
        <div class="form-group"><label>入住體驗</label><textarea id="rv-content" class="form-control" rows="3" placeholder="分享您的入住體驗…"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleBView.doReview('${bookingId}')">提交評價</button>
      </div>
    `);
  },

  doReview(bookingId) {
    const rating = UI.val('rv-rating'), content = UI.val('rv-content');
    if (!content) { UI.toast('請填寫評價內容', 'error'); return; }
    const result = bookingService.submitReview(bookingId, { rating, content });
    UI.closeModal();
    UI.toast(result.success ? '評價提交成功！' : result.errors[0], result.success ? 'success' : 'error');
    this.renderBookings();
  },

  /* ─── 管理員：房源管理 ─── */
  renderAdminPanel() {
    UI.setActiveTab('nav-b');
    const user = Store.getUser();
    if (!user || !Store.isAdmin()) { UI.toast('無權限存取', 'error'); return; }
    const myAccs = accommodationRepo.findByAdminId(user.id);

    UI.render(`
      <div class="page-header">
        <h1 class="page-title">🛠️ 房源管理</h1>
        <button class="btn btn-primary" onclick="ModuleBView.showCreateAccModal()">＋ 新增房源</button>
      </div>
      ${myAccs.length === 0 ? '<div class="empty-state"><div class="empty-icon">🏨</div><p>尚未建立任何房源</p></div>' :
        myAccs.map(acc => {
          const roomTypes = roomTypeRepo.findByAccommodationId(acc.id);
          return `
            <div class="card">
              <div class="card-header">
                <div>
                  <div class="card-title">${acc.name}</div>
                  <div class="text-sm text-muted">📍 ${acc.address} · ${roomTypes.length} 個房型</div>
                </div>
                <div class="flex gap-8">
                  <button class="btn btn-sm btn-outline" onclick="ModuleBView.showAddRoomTypeModal('${acc.id}')">＋ 房型</button>
                  <button class="btn btn-sm btn-outline" onclick="Router.navigate('/admin/pricing/${acc.id}')">定價設定</button>
                </div>
              </div>
              ${roomTypes.map(rt => `
                <div class="list-item">
                  <div class="list-item-content">
                    <div class="list-item-title">${rt.name} · ${rt.capacity} 人</div>
                    <div class="list-item-subtitle">共 ${rt.totalRooms} 間</div>
                  </div>
                  <button class="btn btn-sm btn-outline" onclick="ModuleBView.showSetPricingModal('${rt.id}','${acc.id}')">設定定價</button>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')
      }
    `);
  },

  showCreateAccModal() {
    UI.showModal(`
      <div class="modal-header"><h3>新增房源</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label>房源名稱</label><input id="na-name" class="form-control" placeholder="台東民宿"></div>
        <div class="form-group"><label>地址</label><input id="na-addr" class="form-control" placeholder="台東縣台東市…"></div>
        <div class="form-row">
          <div class="form-group"><label>距車站(km)</label><input id="na-dist" class="form-control" type="number" value="1" step="0.1"></div>
          <div class="form-group"><label>最多入住人數</label><input id="na-max" class="form-control" type="number" value="4"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>入住時間</label><input id="na-in" class="form-control" type="time" value="15:00"></div>
          <div class="form-group"><label>退房時間</label><input id="na-out" class="form-control" type="time" value="11:00"></div>
        </div>
        <div class="form-group"><label>描述</label><textarea id="na-desc" class="form-control" rows="2" placeholder="房源描述…"></textarea></div>
        <div class="flex gap-12">
          <label><input type="checkbox" id="na-nosm" checked> 禁菸</label>
          <label><input type="checkbox" id="na-nopt"> 禁寵物</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleBView.doCreateAcc()">新增</button>
      </div>
    `);
  },

  doCreateAcc() {
    const user = Store.getUser();
    const name = UI.val('na-name'), address = UI.val('na-addr');
    if (!name || !address) { UI.toast('請填寫名稱與地址', 'error'); return; }
    const data = AccommodationModel.create({
      adminId: user.id, name, address, description: UI.val('na-desc'),
      distanceFromStation: parseFloat(UI.val('na-dist')) || 1,
      maxGuests: parseInt(UI.val('na-max')) || 4,
      checkInTime: UI.val('na-in') || '15:00', checkOutTime: UI.val('na-out') || '11:00',
      policyNoSmoking: document.getElementById('na-nosm')?.checked,
      policyNoPets: document.getElementById('na-nopt')?.checked
    });
    accommodationRepo.create(data);
    UI.closeModal();
    UI.toast('房源新增成功！');
    this.renderAdminPanel();
  },

  showAddRoomTypeModal(accId) {
    UI.showModal(`
      <div class="modal-header"><h3>新增房型</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label>房型名稱</label><input id="rt-name" class="form-control" placeholder="標準雙人房"></div>
        <div class="form-row">
          <div class="form-group"><label>容納人數</label><input id="rt-cap" class="form-control" type="number" value="2"></div>
          <div class="form-group"><label>總間數</label><input id="rt-rooms" class="form-control" type="number" value="3"></div>
        </div>
        <div class="form-group"><label>設備（逗號分隔）</label><input id="rt-amen" class="form-control" placeholder="冷氣,WiFi,電視"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleBView.doAddRoomType('${accId}')">新增</button>
      </div>
    `);
  },

  doAddRoomType(accId) {
    const name = UI.val('rt-name');
    if (!name) { UI.toast('請輸入房型名稱', 'error'); return; }
    const amenities = UI.val('rt-amen').split(',').map(s => s.trim()).filter(Boolean);
    roomTypeRepo.create(RoomTypeModel.create({
      accommodationId: accId, name, capacity: parseInt(UI.val('rt-cap')) || 2,
      totalRooms: parseInt(UI.val('rt-rooms')) || 1, amenities
    }));
    UI.closeModal();
    UI.toast('房型新增成功！');
    this.renderAdminPanel();
  },

  showSetPricingModal(roomTypeId, accId) {
    const existing = pricingRuleRepo.findByRoomTypeId(roomTypeId);
    const getPrice = type => existing.find(r => r.priceType === type)?.pricePerNight || '';
    UI.showModal(`
      <div class="modal-header"><h3>設定定價</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label>平日價格/晚</label><input id="pr-wd" class="form-control" type="number" value="${getPrice('weekday')}"></div>
          <div class="form-group"><label>假日價格/晚</label><input id="pr-we" class="form-control" type="number" value="${getPrice('weekend')}"></div>
        </div>
        <div class="form-group"><label>特殊節日價格/晚</label><input id="pr-hol" class="form-control" type="number" value="${getPrice('holiday')}"></div>
        <p class="text-sm text-muted mt-8">注意：新價格將覆蓋舊設定，並記錄於歷史定價紀錄中</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="ModuleBView.doSetPricing('${roomTypeId}','${accId}')">儲存</button>
      </div>
    `);
  },

  doSetPricing(roomTypeId, accId) {
    const user = Store.getUser();
    const types = [['weekday', 'pr-wd'], ['weekend', 'pr-we'], ['holiday', 'pr-hol']];
    types.forEach(([type, inputId]) => {
      const val = parseFloat(UI.val(inputId));
      if (!val) return;
      // 記錄歷史
      const existing = pricingRuleRepo.findByRoomTypeId(roomTypeId).find(r => r.priceType === type);
      if (existing) {
        pricingHistoryRepo.create({
          roomTypeId, priceType: type, oldPrice: existing.pricePerNight, newPrice: val,
          effectiveStart: new Date().toISOString().split('T')[0],
          effectiveEnd: '2099-12-31', modifiedBy: user.id, reason: '管理員調整'
        });
        pricingRuleRepo.delete(existing.id);
      }
      pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId, priceType: type, pricePerNight: val }));
    });
    UI.closeModal();
    UI.toast('定價設定已儲存');
    this.renderAdminPanel();
  },

  renderPricingHistory(accId) {
    UI.setActiveTab('nav-b');
    const acc = accommodationRepo.getById(accId);
    const roomTypes = roomTypeRepo.findByAccommodationId(accId);
    const history = roomTypes.flatMap(rt =>
      pricingHistoryRepo.findByRoomTypeId(rt.id).map(h => ({ ...h, roomTypeName: rt.name }))
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    UI.render(`
      <button class="btn btn-sm btn-outline mb-16" onclick="Router.navigate('/admin/b')">← 返回</button>
      <h1 class="page-title mb-16">📊 ${acc?.name} — 歷史定價紀錄</h1>
      ${history.length === 0 ? '<div class="empty-state"><div class="empty-icon">📊</div><p>尚無定價調整紀錄</p></div>' :
        history.map(h => `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${h.roomTypeName} · ${h.priceType}</div>
              <div class="list-item-subtitle">
                $${h.oldPrice} → $${h.newPrice} · 修改原因：${h.reason || '—'} · ${UI.formatDate(h.createdAt)}
              </div>
            </div>
          </div>
        `).join('')
      }
    `);
  }
};

window.ModuleBView = ModuleBView;
