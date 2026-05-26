/**
 * Unit Tests — BaseRepository (Repository Pattern)
 * 測試 localStorage CRUD 基本操作
 */
describe('BaseRepository — CRUD', () => {
  // 每次使用獨立 key，避免污染其他測試
  const repo = new BaseRepository('test_repo_crud');
  repo.clear();

  it('create() 應回傳含 id 和 createdAt 的物件', () => {
    const item = repo.create({ name: 'Alice', age: 30 });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('Alice');
    expect(item.age).toBe(30);
    expect(item.createdAt).toBeTruthy();
  });

  it('getAll() 應回傳所有已建立的項目', () => {
    repo.clear();
    repo.create({ name: 'A' });
    repo.create({ name: 'B' });
    const all = repo.getAll();
    expect(all.length).toBe(2);
  });

  it('getById() 應依 ID 找到正確項目', () => {
    repo.clear();
    const created = repo.create({ name: 'Bob' });
    const found = repo.getById(created.id);
    expect(found.name).toBe('Bob');
  });

  it('getById() 找不到時應回傳 null', () => {
    const result = repo.getById('non-existent-id');
    expect(result).toBeNull();
  });

  it('update() 應更新指定欄位並保留其他欄位', () => {
    repo.clear();
    const item = repo.create({ name: 'Carol', score: 80 });
    const updated = repo.update(item.id, { score: 95 });
    expect(updated.name).toBe('Carol');
    expect(updated.score).toBe(95);
    expect(updated.updatedAt).toBeTruthy();
  });

  it('update() 找不到 id 時應拋出錯誤', () => {
    expect(() => repo.update('bad-id', { name: 'x' })).toThrow();
  });

  it('delete() 應移除指定項目', () => {
    repo.clear();
    const item = repo.create({ name: 'Dave' });
    repo.delete(item.id);
    expect(repo.getAll().length).toBe(0);
  });

  it('find() 應依條件篩選', () => {
    repo.clear();
    repo.create({ type: 'a', val: 1 });
    repo.create({ type: 'b', val: 2 });
    repo.create({ type: 'a', val: 3 });
    const results = repo.find(i => i.type === 'a');
    expect(results.length).toBe(2);
  });

  it('clear() 應清空所有資料', () => {
    repo.create({ name: 'temp' });
    repo.clear();
    expect(repo.getAll().length).toBe(0);
  });

  it('_generateId() 應每次產生不同的 ID', () => {
    const id1 = repo._generateId();
    const id2 = repo._generateId();
    expect(id1 === id2).toBeFalsy();
  });
});
