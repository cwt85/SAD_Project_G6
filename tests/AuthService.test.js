/**
 * Unit Tests — AuthService
 * 測試註冊 / 登入 / 驗證邏輯
 */
describe('UserModel.validate()', () => {
  it('名稱不足 2 字應回傳錯誤', () => {
    const errs = UserModel.validate({ name: 'A', email: 'a@b.com', password: '123456' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('Email 格式錯誤應回傳錯誤', () => {
    const errs = UserModel.validate({ name: 'Alice', email: 'not-email', password: '123456' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('密碼不足 6 字元應回傳錯誤', () => {
    const errs = UserModel.validate({ name: 'Alice', email: 'a@b.com', password: '123' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('合法資料應回傳空陣列', () => {
    const errs = UserModel.validate({ name: 'Alice', email: 'alice@test.com', password: '123456' });
    expect(errs.length).toBe(0);
  });
});

describe('AuthService — register()', () => {
  // 使用獨立 repo 避免影響主資料
  const testRepo = new BaseRepository('test_auth_users');
  testRepo.clear();

  // 覆蓋 findByEmail 讓 authService 測試使用乾淨資料
  const origFind = userRepo.findByEmail.bind(userRepo);
  const origCreate = userRepo.create.bind(userRepo);

  it('重複 email 不可再次註冊', () => {
    // 先建一個使用者
    userRepo.create(UserModel.create({ name: 'Test', email: 'dup@test.com', password: 'aaaaaa' }));
    const result = authService.register({ name: 'Other', email: 'dup@test.com', phone: '', password: 'aaaaaa' });
    expect(result.success).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('缺少必填欄位應回傳 success:false', () => {
    const result = authService.register({ name: '', email: '', phone: '', password: '' });
    expect(result.success).toBeFalsy();
  });
});

describe('AuthService — login()', () => {
  it('正確帳密應成功登入', () => {
    // 確保帳號存在（Seed 已建立）
    const result = authService.login({ email: 'user@demo.com', password: '123456' });
    expect(result.success).toBeTruthy();
    expect(result.user.name).toBeTruthy();
  });

  it('錯誤密碼應失敗', () => {
    const result = authService.login({ email: 'user@demo.com', password: 'wrong' });
    expect(result.success).toBeFalsy();
  });

  it('不存在的帳號應失敗', () => {
    const result = authService.login({ email: 'nobody@nowhere.com', password: '123456' });
    expect(result.success).toBeFalsy();
  });
});
