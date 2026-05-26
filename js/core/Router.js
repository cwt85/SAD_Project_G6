/**
 * Hash-based SPA Router
 * 使用 URL hash (#/path) 做頁面切換，不需要後端支援。
 */
class _Router {
  constructor() {
    this._routes = {};   // { path: handler }
    this._current = null;
    window.addEventListener('hashchange', () => this._resolve());
  }

  /** 註冊一條路由 */
  register(path, handler) {
    this._routes[path] = handler;
    return this; // 支援 chaining
  }

  /** 導航至某路由 */
  navigate(path) {
    window.location.hash = path;
  }

  /** 啟動 Router，處理當前 hash */
  init() {
    this._resolve();
  }

  _resolve() {
    const hash = window.location.hash.replace('#', '') || '/';
    // 先嘗試精確比對，再嘗試帶參數的路徑
    let handler = this._routes[hash];
    let params = {};

    if (!handler) {
      for (const [pattern, fn] of Object.entries(this._routes)) {
        const match = this._matchPath(pattern, hash);
        if (match) { handler = fn; params = match; break; }
      }
    }

    if (handler) {
      this._current = hash;
      handler(params);
      window.EventBus.emit('route:changed', { path: hash, params });
    } else {
      // 找不到路由，導回首頁
      this.navigate('/');
    }
  }

  /** 簡單路徑參數比對，例如 /trip/:id */
  _matchPath(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }
}

window.Router = new _Router();
