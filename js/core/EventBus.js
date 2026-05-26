/**
 * Observer Pattern — 事件匯流排
 * 讓各模組之間解耦合（loosely coupled），
 * 任何地方都可以發布 / 訂閱事件，不需要直接互相引用。
 */
class _EventBus {
  constructor() {
    this._events = {}; // { eventName: [callback, ...] }
  }

  /** 訂閱事件，回傳取消訂閱的函式 */
  on(event, callback) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);
    return () => this.off(event, callback);
  }

  /** 取消訂閱 */
  off(event, callback) {
    if (this._events[event]) {
      this._events[event] = this._events[event].filter(cb => cb !== callback);
    }
  }

  /** 發布事件 */
  emit(event, data) {
    (this._events[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error(`EventBus error on "${event}":`, e); }
    });
  }

  /** 只訂閱一次，觸發後自動移除 */
  once(event, callback) {
    const wrapper = (data) => { callback(data); this.off(event, wrapper); };
    this.on(event, wrapper);
  }
}

// Singleton — 全域唯一實例
window.EventBus = new _EventBus();
