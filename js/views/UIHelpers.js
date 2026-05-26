/**
 * UI 工具函式 — 所有 View 共用
 */
const UI = {
  /** 渲染主要內容區 */
  render(html) {
    document.getElementById('view-container').innerHTML = html;
  },

  /** 顯示 Modal */
  showModal(html) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) UI.closeModal(); });
    document.body.appendChild(overlay);
  },

  closeModal() {
    const el = document.getElementById('modal-overlay');
    if (el) el.remove();
  },

  /** Toast 通知 */
  toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  },

  /** 確認對話框（Promise-based） */
  confirm(msg) {
    return new Promise(resolve => {
      UI.showModal(`
        <div class="modal-header"><h3>確認操作</h3><button class="close-btn" onclick="UI.closeModal()">✕</button></div>
        <div class="modal-body"><p>${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="UI.closeModal()">取消</button>
          <button class="btn btn-danger" id="confirm-yes">確認</button>
        </div>
      `);
      document.getElementById('confirm-yes').onclick = () => { UI.closeModal(); resolve(true); };
    });
  },

  /** 格式化日期顯示 */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  },

  formatDateTime(str) {
    if (!str) return '';
    const d = new Date(str);
    return `${UI.formatDate(str)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  /** 狀態 Badge */
  badge(status, labelMap = {}) {
    const labels = { planning:'規劃中', completed:'已完成', cancelled:'已取消', pending:'待付款',
                     confirmed:'已確認', paid:'已付款', on_time:'準點', delayed:'誤點', ...labelMap };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
  },

  /** 星星評分 */
  stars(rating, max = 5) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(max - full);
  },

  /** 取得使用者頭像顏色（依姓名第一字） */
  avatar(name) {
    const colors = ['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
    const idx = (name || '?').charCodeAt(0) % colors.length;
    return `<div class="avatar" style="background:${colors[idx]}">${(name || '?')[0].toUpperCase()}</div>`;
  },

  /** 取得 form 欄位值 */
  val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  },

  /** 設定 form 欄位值 */
  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  },

  /** 切換 hidden class */
  show(id) { document.getElementById(id)?.classList.remove('hidden'); },
  hide(id) { document.getElementById(id)?.classList.add('hidden'); },

  /** 更新 navbar */
  updateNavbar() {
    const user = Store.getUser();
    const userInfo = document.getElementById('nav-user-info');
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (!userInfo) return;
    if (user) {
      userInfo.textContent = `👤 ${user.name}`;
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      userInfo.textContent = '';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
    // 更新 module tabs 顯示
    const moduleNav = document.getElementById('module-nav');
    if (moduleNav) moduleNav.style.display = user ? 'flex' : 'none';
  },

  /** 標記 active tab */
  setActiveTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const el = document.getElementById(tabId);
    if (el) el.classList.add('active');
  }
};

window.UI = UI;
