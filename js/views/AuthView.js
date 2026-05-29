/** 登入 / 註冊 View */
const AuthView = {
  renderLogin() {
    UI.render(`
      <div class="auth-container">
        <div class="auth-card">
          <h1 class="auth-title">Agent TT</h1>
          <p class="auth-subtitle">智慧旅遊平台 — 登入帳號</p>
          <div class="form-group">
            <label>Email</label>
            <input id="login-email" class="form-control" type="email" placeholder="your@email.com">
          </div>
          <div class="form-group">
            <label>密碼</label>
            <input id="login-password" class="form-control" type="password" placeholder="••••••">
          </div>
          <p id="login-error" class="text-sm" style="color:var(--danger);margin-bottom:8px;"></p>
          <button class="btn btn-primary w-full" onclick="AuthView.doLogin()">登入</button>
          <div class="auth-switch">沒有帳號？<a href="#/register">立即註冊</a></div>
          <div class="mt-16 text-sm text-muted" style="border-top:1px solid var(--border);padding-top:12px;">
            <strong>示範帳號：</strong><br>
            管理員：admin@demo.com / 123456<br>
            顧客：user@demo.com / 123456
          </div>
        </div>
      </div>
    `);
    UI.setActiveTab('');
  },

  renderRegister() {
    UI.render(`
      <div class="auth-container">
        <div class="auth-card">
          <h1 class="auth-title">Agent TT</h1>
          <p class="auth-subtitle">建立新帳號</p>
          <div class="form-group">
            <label>姓名</label>
            <input id="reg-name" class="form-control" placeholder="請輸入姓名">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input id="reg-email" class="form-control" type="email" placeholder="your@email.com">
            </div>
            <div class="form-group">
              <label>手機號碼</label>
              <input id="reg-phone" class="form-control" placeholder="0912345678">
            </div>
          </div>
          <div class="form-group">
            <label>密碼（至少 6 字元）</label>
            <input id="reg-password" class="form-control" type="password" placeholder="••••••">
          </div>
          <div class="form-group">
            <label>角色</label>
            <select id="reg-role" class="form-control">
              <option value="customer">一般顧客</option>
              <option value="admin">住宿管理員</option>
              <option value="manager">平台經理（C模組）</option>
            </select>
          </div>
          <p id="reg-error" class="text-sm" style="color:var(--danger);margin-bottom:8px;"></p>
          <button class="btn btn-primary w-full" onclick="AuthView.doRegister()">註冊</button>
          <div class="auth-switch">已有帳號？<a href="#/">立即登入</a></div>
        </div>
      </div>
    `);
  },

  doLogin() {
    const email = UI.val('login-email');
    const password = UI.val('login-password');
    const result = authService.login({ email, password });
    if (!result.success) {
      document.getElementById('login-error').textContent = result.errors.join('、');
      return;
    }
    UI.updateNavbar();
    UI.toast(`歡迎回來，${result.user.name}！`);
    Router.navigate('/trips');
  },

  doRegister() {
    const result = authService.register({
      name: UI.val('reg-name'), email: UI.val('reg-email'),
      phone: UI.val('reg-phone'), password: UI.val('reg-password'),
      role: UI.val('reg-role')
    });
    if (!result.success) {
      document.getElementById('reg-error').textContent = result.errors.join('、');
      return;
    }
    UI.updateNavbar();
    UI.toast('註冊成功！歡迎加入 Agent TT');
    Router.navigate('/trips');
  }
};

window.AuthView = AuthView;
