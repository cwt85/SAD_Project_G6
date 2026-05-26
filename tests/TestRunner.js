/**
 * 輕量級測試框架（無需外部依賴）
 * 使用方法：
 *   describe('群組名稱', () => {
 *     it('測試描述', () => {
 *       expect(actual).toBe(expected);
 *     });
 *   });
 */

window.TestRunner = (() => {
  const results = [];
  let _currentSuite = '';

  const expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected)
        throw new Error(`expect ${JSON.stringify(actual)} toBe ${JSON.stringify(expected)}`);
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`expect ${JSON.stringify(actual)} toEqual ${JSON.stringify(expected)}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`expect ${JSON.stringify(actual)} toBeTruthy`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`expect ${JSON.stringify(actual)} toBeFalsy`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`expect ${JSON.stringify(actual)} toBeNull`);
    },
    toBeGreaterThan: (n) => {
      if (actual <= n) throw new Error(`expect ${actual} toBeGreaterThan ${n}`);
    },
    toBeLessThan: (n) => {
      if (actual >= n) throw new Error(`expect ${actual} toBeLessThan ${n}`);
    },
    toContain: (item) => {
      if (!actual.includes(item))
        throw new Error(`expect array to contain ${JSON.stringify(item)}`);
    },
    toHaveLength: (len) => {
      if (actual.length !== len)
        throw new Error(`expect length ${actual.length} toHaveLength ${len}`);
    },
    toThrow: () => {
      if (typeof actual !== 'function') throw new Error('toThrow requires a function');
      try { actual(); throw new Error('did not throw'); }
      catch (e) { if (e.message === 'did not throw') throw e; }
    }
  });

  const it = (desc, fn) => {
    try {
      fn();
      results.push({ suite: _currentSuite, desc, passed: true });
    } catch (e) {
      results.push({ suite: _currentSuite, desc, passed: false, error: e.message });
    }
  };

  const describe = (suiteName, fn) => {
    _currentSuite = suiteName;
    fn();
    _currentSuite = '';
  };

  const run = () => {
    const total  = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    return { results, total, passed, failed };
  };

  const reset = () => { results.length = 0; };

  // 暴露全域方便各 test 檔案使用
  window.describe = describe;
  window.it = it;
  window.expect = expect;

  return { run, reset };
})();
