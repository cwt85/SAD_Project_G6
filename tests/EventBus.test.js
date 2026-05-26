/**
 * Unit Tests — EventBus (Observer Pattern)
 * 測試訂閱、發布、取消訂閱、once
 */
describe('EventBus — on() / emit()', () => {
  it('訂閱後 emit 應呼叫 callback', () => {
    let called = false;
    const unsub = EventBus.on('test:basic', () => { called = true; });
    EventBus.emit('test:basic');
    expect(called).toBeTruthy();
    unsub();
  });

  it('emit 應將 data 傳給 callback', () => {
    let received = null;
    const unsub = EventBus.on('test:data', (d) => { received = d; });
    EventBus.emit('test:data', { value: 42 });
    expect(received.value).toBe(42);
    unsub();
  });

  it('多個訂閱者應全部收到事件', () => {
    let count = 0;
    const u1 = EventBus.on('test:multi', () => count++);
    const u2 = EventBus.on('test:multi', () => count++);
    EventBus.emit('test:multi');
    expect(count).toBe(2);
    u1(); u2();
  });
});

describe('EventBus — off()', () => {
  it('取消訂閱後不應再收到事件', () => {
    let count = 0;
    const cb = () => count++;
    EventBus.on('test:off', cb);
    EventBus.emit('test:off');
    EventBus.off('test:off', cb);
    EventBus.emit('test:off');
    expect(count).toBe(1); // 只收到一次
  });

  it('on() 回傳的取消函式應正常運作', () => {
    let count = 0;
    const unsub = EventBus.on('test:unsub', () => count++);
    EventBus.emit('test:unsub');
    unsub();
    EventBus.emit('test:unsub');
    expect(count).toBe(1);
  });
});

describe('EventBus — once()', () => {
  it('once 訂閱只應觸發一次', () => {
    let count = 0;
    EventBus.once('test:once', () => count++);
    EventBus.emit('test:once');
    EventBus.emit('test:once');
    EventBus.emit('test:once');
    expect(count).toBe(1);
  });
});

describe('EventBus — 錯誤隔離', () => {
  it('某個 callback 拋出錯誤不應影響其他訂閱者', () => {
    let secondCalled = false;
    EventBus.on('test:error', () => { throw new Error('故意錯誤'); });
    EventBus.on('test:error', () => { secondCalled = true; });
    EventBus.emit('test:error');
    expect(secondCalled).toBeTruthy();
    // 清理
    EventBus._events['test:error'] = [];
  });
});
