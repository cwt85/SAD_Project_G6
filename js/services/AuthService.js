/**
 * AuthService — 身分驗證服務
 * 負責 登入 / 註冊 / 登出，並維護 sessionStorage 的登入狀態。
 */
class AuthService {
  constructor() {
    // 從 sessionStorage 還原登入狀態
    const saved = sessionStorage.getItem('agenttt_session');
    if (saved) {
      try { Store.setState({ currentUser: JSON.parse(saved) }); } catch {}
    }
  }

  /** 註冊新使用者 */
  register({ name, email, phone, password, role = 'customer' }) {
    const errors = UserModel.validate({ name, email, password });
    if (errors.length) return { success: false, errors };

    if (userRepo.findByEmail(email)) {
      return { success: false, errors: ['此 Email 已被註冊'] };
    }

    const data = UserModel.create({ name, email, phone, password, role });
    const user = userRepo.create(data);
    this._setSession(user);
    return { success: true, user };
  }

  /** 登入 */
  login({ email, password }) {
    const user = userRepo.findByEmailAndPassword(email, password);
    if (!user) return { success: false, errors: ['Email 或密碼錯誤'] };
    this._setSession(user);
    return { success: true, user };
  }

  /** 登出 */
  logout() {
    sessionStorage.removeItem('agenttt_session');
    Store.setState({ currentUser: null, activeModule: 'auth' });
    EventBus.emit('auth:logout');
    Router.navigate('/');
  }

  _setSession(user) {
    // 不儲存密碼到 session
    const safe = { ...user, password: undefined };
    sessionStorage.setItem('agenttt_session', JSON.stringify(safe));
    Store.setState({ currentUser: safe });
    EventBus.emit('auth:login', safe);
  }
}

window.authService = new AuthService();
