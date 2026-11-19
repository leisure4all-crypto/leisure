/* Claude 대시보드 런타임(dash) 대신 쓰는 최소 호환 코드.
   데이터는 data.js(window.FITT_DATA)에서 읽고, 입력값은 메모리에만 둡니다. */
(function () {
  var DATA = window.FITT_DATA || {};
  var DEFAULTS = {};
  var params = {};
  var subs = [];
  var queued = false;
  var colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

  function run() {
    queued = false;
    subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(run); }
  }

  window.dash = {
    colors: colors,
    data: function (id) {
      if (!(id in DATA)) return { status: 'missing', data: [], message: 'missing', refreshing: false, meta: [] };
      return { status: 'ok', data: DATA[id], rows: DATA[id], message: '', refreshing: false, meta: [] };
    },
    onData: function (fn) { subs.push(fn); fn(); },
    params: function () { return Object.assign({}, params); },
    setParams: function (p) { Object.keys(p).forEach(function (k) { params[k] = p[k]; }); schedule(); },
    resetParams: function () { params = Object.assign({}, DEFAULTS); schedule(); },
    setLink: function () {},
    refresh: function () {},
    calc: function () {},
    loader: function () {}
  };

  var lastW = 0;
  window.addEventListener('resize', function () {
    var w = Math.round(window.innerWidth / 8);
    if (w !== lastW) { lastW = w; schedule(); }
  });
})();
