/**
 * 全域應用狀態管理（簡易版 Flux Store）
 * 結合 Observer Pattern，讓 UI 元件可以訂閱狀態變更。
 */
class AppStore {
  constructor() {
    this._state = {
      currentUser: null,   // 登入中的使用者
      activeModule: 'auth' // 'auth' | 'A' | 'B' | 'C'
    };
  }

  getState() {
    return { ...this._state }; // 回傳副本，防止外部直接修改
  }

  /** 更新狀態並發布事件 */
  setState(updates) {
    const prev = { ...this._state };
    this._state = { ...this._state, ...updates };
    window.EventBus.emit('store:changed', { prev, next: this._state });
    // 若特定 key 有變更，也發布 key-specific 事件
    Object.keys(updates).forEach(key => {
      if (prev[key] !== this._state[key]) {
        window.EventBus.emit(`store:${key}`, this._state[key]);
      }
    });
  }

  /** 取得目前登入使用者（方便存取） */
  getUser() { return this._state.currentUser; }

  /** 是否已登入 */
  isLoggedIn() { return !!this._state.currentUser; }

  /** 是否為管理員 */
  isAdmin() {
    const u = this._state.currentUser;
    return u && (u.role === 'admin' || u.role === 'manager');
  }
}

// Singleton
window.Store = new AppStore();
