/**
 * Repository Pattern — localStorage 存取抽象層
 * 所有對 localStorage 的 CRUD 操作都透過此基礎類別，
 * 讓上層 Service 不需要知道資料如何儲存。
 */
class BaseRepository {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  /** 取得所有資料 */
  getAll() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** 依 ID 取得單筆 */
  getById(id) {
    return this.getAll().find(item => item.id === id) || null;
  }

  /** 依條件查詢（Strategy-like 篩選） */
  find(predicate) {
    return this.getAll().filter(predicate);
  }

  /** 新增一筆（自動產生 ID + 時間戳記） */
  create(data) {
    const item = { ...data, id: this._generateId(), createdAt: new Date().toISOString() };
    const items = this.getAll();
    items.push(item);
    this._persist(items);
    return item;
  }

  /** 更新一筆 */
  update(id, data) {
    const items = this.getAll();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`[${this.storageKey}] id=${id} not found`);
    items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
    this._persist(items);
    return items[idx];
  }

  /** 刪除一筆 */
  delete(id) {
    const items = this.getAll().filter(i => i.id !== id);
    this._persist(items);
  }

  /** 清空所有資料（測試用） */
  clear() {
    localStorage.removeItem(this.storageKey);
  }

  /** 整批覆蓋（seed data 使用） */
  seed(dataArray) {
    this._persist(dataArray);
  }

  _persist(items) {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}

window.BaseRepository = BaseRepository;
