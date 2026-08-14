/* 큰 수의 법칙: 동전/주사위 실시간 시행 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    coinWrap: $('coinWrap'), diceWrap: $('diceWrap'),
    pHead: $('pHead'), pRange: $('pRange'), faces: $('faces'),
    trials: $('trials'), startBtn: $('startBtn'), resetBtn: $('resetBtn'),
    progText: $('progText'), progBar: $('progBar'), lastResult: $('lastResult'),
    ratioKey: $('ratioKey'), ratio: $('ratio'), ratioSub: $('ratioSub'),
    theory: $('theory'), devPct: $('devPct'), devCount: $('devCount'),
    convChart: $('convChart'), distChart: $('distChart'),
    faceBody: document.querySelector('#faceTable tbody'), streakHint: $('streakHint')
  };

  var segMode = UI.segment($('mode'), function (v) {
    el.coinWrap.hidden = v !== 'coin';
    el.diceWrap.hidden = v !== 'dice';
    reset();
  });
  var segSpeed = UI.segment($('speed'), function () { });

  var st = null, running = false, rafId = 0, lastTs = 0, acc = 0, lastPaint = 0;

  function labelsFor(cfg) {
    if (cfg.mode === 'coin') return ['앞면', '뒷면'];
    var out = [];
    for (var i = 1; i <= cfg.faces; i++) out.push(i + '');
    return out;
  }

  function freshState() {
    var mode = segMode.get();
    var faces = Math.max(2, Math.min(20, Math.floor(UI.parseNum(el.faces.value) || 6)));
    var p = Math.min(0.99, Math.max(0.01, UI.parseNum(el.pHead.value) / 100));
    var cfg = { mode: mode, faces: mode === 'coin' ? 2 : faces, p: p };
    var k = cfg.faces;
    var theory = [];
    if (mode === 'coin') theory = [p, 1 - p];
    else for (var i = 0; i < k; i++) theory.push(1 / k);

    return {
      cfg: cfg, labels: labelsFor(cfg), theory: theory,
      counts: new Array(k).fill(0),
      streak: new Array(k).fill(0), curStreak: 0, curFace: -1,
      total: Math.max(1, Math.floor(UI.parseNum(el.trials.value) || 1)),
      done: 0, last: -1,
      sx: [], sy: [], sampleEvery: 1
    };
  }

  function roll() {
    var c = st.cfg;
    var face;
    if (c.mode === 'coin') face = Math.random() < c.p ? 0 : 1;
    else face = Math.floor(Math.random() * c.faces);
    st.counts[face]++;
    st.done++;
    st.last = face;
    if (face === st.curFace) st.curStreak++;
    else { st.curFace = face; st.curStreak = 1; }
    if (st.curStreak > st.streak[face]) st.streak[face] = st.curStreak;
    if (st.done % st.sampleEvery === 0 || st.done === st.total) {
      st.sx.push(st.done);
      st.sy.push(st.counts[0] / st.done);
    }
  }

  function loop(ts) {
    if (!running) return;
    var iv = +segSpeed.get();
    var remain = st.total - st.done;
    var todo;
    if (iv === 0) {
      todo = Math.min(remain, 200000);
    } else {
      if (!lastTs) lastTs = ts;
      acc += ts - lastTs;
      todo = Math.floor(acc / iv);
      if (todo > 50000) todo = 50000;
      acc -= todo * iv;
      if (todo > remain) todo = remain;
    }
    lastTs = ts;
    for (var i = 0; i < todo; i++) roll();

    paintStats();
    if (ts - lastPaint > 250) { lastPaint = ts; paintCharts(); paintTable(); }

    if (st.done >= st.total) { stop(true); return; }
    rafId = requestAnimationFrame(loop);
  }

  function faceHtml(idx) {
    if (st.cfg.mode === 'coin') {
      return '<span class="ball ' + (idx === 0 ? 'c1' : 'c2') + '" style="width:56px;height:56px;font-size:16px">' +
        (idx === 0 ? '앞' : '뒤') + '</span>';
    }
    return '<span class="ball c2" style="width:56px;height:56px;font-size:20px">' + (idx + 1) + '</span>';
  }

  function paintStats() {
    var p = st.total ? st.done / st.total : 0;
    el.progBar.style.width = (p * 100).toFixed(2) + '%';
    el.progText.textContent = UI.comma(st.done) + ' / ' + UI.comma(st.total) + '회' + (running ? '' : ' · 정지');

    if (st.last >= 0) {
      el.lastResult.innerHTML = faceHtml(st.last) +
        '<span class="mono t-muted" style="margin-left:10px">' + st.labels[st.last] +
        ' · 연속 ' + st.curStreak + '회</span>';
    }

    var obs = st.done ? st.counts[0] / st.done : 0;
    el.ratioKey.textContent = st.labels[0] + ' 비율';
    el.ratio.textContent = st.done ? UI.pct(obs, 2) : '–';
    el.ratioSub.textContent = UI.comma(st.counts[0]) + ' / ' + UI.comma(st.done) + '회';
    el.theory.textContent = UI.pct(st.theory[0], 2);
    el.devPct.textContent = st.done ? ((obs - st.theory[0]) * 100 >= 0 ? '+' : '') +
      ((obs - st.theory[0]) * 100).toFixed(2) + '%p' : '–';
    var expected = st.done * st.theory[0];
    var diff = st.counts[0] - expected;
    el.devCount.textContent = st.done ? (diff >= 0 ? '+' : '') + UI.comma(diff) + '회' : '–';
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  function paintCharts() {
    var s1 = css('--s1'), s2 = css('--s2');
    if (!st.done) {
      Chart.empty(el.convChart, { emptyText: '시작하면 수렴 곡선이 그려집니다' });
      Chart.empty(el.distChart, { emptyText: '시작하면 분포가 쌓입니다' });
      return;
    }

    var theoryLine = st.sx.map(function () { return st.theory[0]; });
    var maxY = Math.max(1e-6, Math.max.apply(null, st.sy), st.theory[0]);
    Chart.line(el.convChart, {
      height: 250,
      x: st.sx,
      xFmt: function (v) { return UI.comma(v) + '회'; },
      xLabel: '시행 횟수',
      yFmt: function (v) { return (v * 100).toFixed(0) + '%'; },
      yMax: Math.min(1, maxY * 1.25),
      series: [
        { name: st.labels[0] + ' 관측 비율', color: s1, values: st.sy },
        { name: '이론 확률', color: s2, values: theoryLine }
      ],
      tip: function (i) {
        return '<div class="tt">' + UI.comma(st.sx[i]) + '회째</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">관측</span>' +
          '<span class="tv">' + UI.pct(st.sy[i], 2) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">이론</span>' +
          '<span class="tv">' + UI.pct(st.theory[0], 2) + '</span></div>' +
          '<div class="tr"><span class="tn">편차</span><span class="tv">' +
          ((st.sy[i] - st.theory[0]) * 100).toFixed(2) + '%p</span></div>';
      }
    });

    Chart.bar(el.distChart, {
      height: 220,
      x: st.labels,
      series: [{ name: '횟수', color: s1, values: st.counts.slice() }],
      yFmt: function (v) { return UI.comma(v); },
      tip: function (i) {
        return '<div class="tt">' + st.labels[i] + '</div>' +
          '<div class="tr"><span class="tn">횟수</span><span class="tv">' + UI.comma(st.counts[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">관측</span><span class="tv">' + UI.pct(st.counts[i] / st.done, 2) + '</span></div>' +
          '<div class="tr"><span class="tn">이론</span><span class="tv">' + UI.pct(st.theory[i], 2) + '</span></div>';
      }
    });
  }

  function paintTable() {
    var rows = st.labels.map(function (name, i) {
      var obs = st.done ? st.counts[i] / st.done : 0;
      var dev = (obs - st.theory[i]) * 100;
      return '<tr><td>' + name + '</td><td>' + UI.comma(st.counts[i]) + '</td>' +
        '<td>' + UI.pct(obs, 2) + '</td><td class="t-muted">' + UI.pct(st.theory[i], 2) + '</td>' +
        '<td>' + (dev >= 0 ? '+' : '') + dev.toFixed(2) + '</td>' +
        '<td>' + st.streak[i] + '회</td></tr>';
    });
    el.faceBody.innerHTML = rows.join('');
    var maxStreak = Math.max.apply(null, st.streak);
    el.streakHint.textContent = st.done ? '최장 연속 ' + maxStreak + '회' : '';
  }

  function lock(on) {
    [el.pHead, el.faces, el.trials].forEach(function (n) { n.disabled = on; });
    document.querySelectorAll('#mode button, .chips button').forEach(function (b) { b.disabled = on; });
  }

  function start() {
    st = freshState();
    st.sampleEvery = Math.max(1, Math.ceil(st.total / 300));
    lock(true);
    resume();
  }
  function resume() {
    running = true; lastTs = 0; acc = 0;
    el.startBtn.textContent = '일시정지';
    rafId = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(rafId);
    el.startBtn.textContent = '재개';
    paintStats(); paintCharts(); paintTable();
  }
  function stop(done) {
    running = false;
    cancelAnimationFrame(rafId);
    el.startBtn.textContent = done ? '다시 시작' : '시작';
    lock(false);
    paintStats(); paintCharts(); paintTable();
  }
  function reset() {
    running = false;
    cancelAnimationFrame(rafId);
    st = freshState();
    lock(false);
    el.startBtn.textContent = '시작';
    el.progBar.style.width = '0';
    el.progText.textContent = '대기 중';
    el.lastResult.innerHTML = '<span class="t-muted">시작 전</span>';
    paintStats();
    paintCharts();
    paintTable();
  }

  el.startBtn.addEventListener('click', function () {
    if (running) { pause(); return; }
    if (st && st.done > 0 && st.done < st.total) { resume(); return; }
    start();
  });
  el.resetBtn.addEventListener('click', reset);
  el.pHead.addEventListener('input', function () {
    el.pRange.value = el.pHead.value;
    if (!running) reset();
  });
  el.pRange.addEventListener('input', function () {
    el.pHead.value = el.pRange.value;
    if (!running) reset();
  });
  el.faces.addEventListener('input', function () { if (!running) reset(); });
  el.trials.addEventListener('input', function () {
    if (running || !st) return;
    st.total = Math.max(1, Math.floor(UI.parseNum(el.trials.value) || 1));
    paintStats();
  });
  document.querySelectorAll('.chips button[data-t]').forEach(function (b) {
    b.addEventListener('click', function () { el.trials.value = b.dataset.t; if (!running) reset(); });
  });
  document.addEventListener('themechange', function () { if (st) paintCharts(); });

  reset();
})();
