/* 로또 6/45 구매 시뮬레이터 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var COMB = 8145060;                         // C(45,6)
  var WAYS = [0, 1, 6, 228, 11115, 182780];   // 등수별 조합 수
  var RANK_NAME = ['낙첨', '1등', '2등', '3등', '4등', '5등'];

  /* ── 난수 ──────────────────────────────────────────────── */
  var rbuf = new Uint32Array(2048), ri = rbuf.length;
  function rnd() {
    if (ri >= rbuf.length) { crypto.getRandomValues(rbuf); ri = 0; }
    return rbuf[ri++] / 4294967296;
  }
  function randInt(n) { return Math.floor(rnd() * n); }

  /* 1~45 풀에서 부분 셔플로 k개 뽑기 (풀은 재사용) */
  function makePool() {
    var p = new Uint8Array(45);
    for (var i = 0; i < 45; i++) p[i] = i + 1;
    return p;
  }
  var drawPool = makePool(), ticketPool = makePool();

  function takeFrom(pool, k, out) {
    for (var i = 0; i < k; i++) {
      var j = i + randInt(45 - i);
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      out[i] = pool[i];
    }
    return out;
  }

  var flag = new Uint8Array(46);
  var winNums = new Uint8Array(7);   // 0~5: 당첨번호, 6: 보너스
  var myNums = new Uint8Array(6);

  function drawWin() {
    takeFrom(drawPool, 7, winNums);
    return winNums;
  }

  function rankOf(match, bonusHit) {
    if (match === 6) return 1;
    if (match === 5) return bonusHit ? 2 : 3;
    if (match === 4) return 4;
    if (match === 3) return 5;
    return 0;
  }

  /* ── 상태 ──────────────────────────────────────────────── */
  var st = null;
  function freshState() {
    return {
      total: 0, bought: 0, spent: 0, won: 0,
      counts: [0, 0, 0, 0, 0, 0], sums: [0, 0, 0, 0, 0, 0],
      best: 0, logs: [], startedAt: 0, elapsed: 0,
      sx: [], sSpent: [], sWon: [], sampleEvery: 1,
      fixed: [], mode: 'auto', drawMode: 'perTicket',
      price: 1000, prize: [0, 2e9, 6e7, 1.5e6, 5e4, 5e3],
      singleWin: null
    };
  }

  var running = false, rafId = 0, lastTs = 0, acc = 0;
  var lastChartAt = 0, lastLogAt = 0, logDirty = false;

  /* ── DOM 참조 ─────────────────────────────────────────── */
  var el = {
    qty: $('qty'), qtyHelp: $('qtyHelp'),
    fixedWrap: $('fixedWrap'), fixedNums: $('fixedNums'), fixedRule: $('fixedRule'),
    fixedHelp: $('fixedHelp'), fillRand: $('fillRand'),
    drawHelp: $('drawHelp'),
    startBtn: $('startBtn'), resetBtn: $('resetBtn'),
    progText: $('progText'), progBar: $('progBar'),
    winBalls: $('winBalls'), myBalls: $('myBalls'), ticketNo: $('ticketNo'), hitLine: $('hitLine'),
    best: $('best'), bestSub: $('bestSub'), spent: $('spent'), spentSub: $('spentSub'),
    wonAmt: $('wonAmt'), wonSub: $('wonSub'), net: $('net'), roi: $('roi'), netStat: $('netStat'),
    rankChart: $('rankChart'), cumChart: $('cumChart'),
    probBody: document.querySelector('#probTable tbody'),
    logBody: document.querySelector('#logTable tbody'),
    price: $('price')
  };

  var segPick = UI.segment($('pickMode'), onPickMode);
  var segDraw = UI.segment($('drawMode'), function (v) {
    el.drawHelp.textContent = v === 'perTicket'
      ? '장마다 새 당첨번호를 뽑습니다(여러 회차에 걸쳐 산 것과 동일).'
      : '당첨번호를 한 번만 뽑고 모든 장을 그 회차에 응모합니다(한 회차에 몰아산 경우).';
  });
  var segSpeed = UI.segment($('speed'), function () { updateQtyHelp(); });

  function prizeInputs() {
    return [0, +$('p1').value || 0, +$('p2').value || 0, +$('p3').value || 0,
      +$('p4').value || 0, +$('p5').value || 0];
  }

  function onPickMode(v) {
    el.fixedWrap.hidden = (v === 'auto');
    el.fixedRule.textContent = v === 'manual' ? '(6개 필요)' : '(1~5개, 나머지는 자동)';
  }

  function parseFixed() {
    var raw = (el.fixedNums.value || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    var seen = {}, out = [];
    raw.forEach(function (n) {
      if (n >= 1 && n <= 45 && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.sort(function (a, b) { return a - b; });
  }

  function updateQtyHelp() {
    var n = Math.max(1, Math.floor(+el.qty.value || 0));
    var price = +el.price.value || 0;
    var iv = +segSpeed.get();
    var txt = UI.comma(n) + '장 = ' + UI.korWon(n * price);
    if (iv > 0) {
      var sec = n * iv / 1000;
      txt += ' · ' + fmtDur(sec) + ' 소요';
    } else {
      txt += ' · 즉시 계산';
    }
    el.qtyHelp.textContent = txt;
  }

  function fmtDur(sec) {
    if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + '초';
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (m < 60) return m + '분 ' + s + '초';
    var h = Math.floor(m / 60);
    return h + '시간 ' + (m % 60) + '분';
  }

  function ballClass(n) {
    return n <= 10 ? 'c1' : n <= 20 ? 'c2' : n <= 30 ? 'c3' : n <= 40 ? 'c4' : 'c5';
  }
  function ballHtml(n, opts) {
    opts = opts || {};
    return '<span class="ball ' + (opts.sm ? 'sm ' : '') + ballClass(n) +
      (opts.hit ? ' hit' : '') + (opts.dim ? ' dim' : '') + '">' + n + '</span>';
  }

  /* ── 시뮬레이션 ───────────────────────────────────────── */
  function buyOne() {
    var i;
    /* 티켓 번호 만들기 */
    if (st.mode === 'auto') {
      takeFrom(ticketPool, 6, myNums);
    } else if (st.mode === 'manual') {
      for (i = 0; i < 6; i++) myNums[i] = st.fixed[i];
    } else {
      var k = st.fixed.length;
      for (i = 0; i < k; i++) myNums[i] = st.fixed[i];
      var used = flag; /* 임시 사용 후 아래에서 초기화 */
      for (i = 0; i < k; i++) used[st.fixed[i]] = 2;
      var c = k;
      while (c < 6) {
        var v = 1 + randInt(45);
        if (used[v] !== 2) { used[v] = 2; myNums[c++] = v; }
      }
      for (i = 0; i < 6; i++) used[myNums[i]] = 0;
    }

    /* 당첨번호 */
    var w = st.drawMode === 'single' ? st.singleWin : drawWin();

    /* 일치 수 */
    for (i = 0; i < 7; i++) flag[w[i]] = i === 6 ? 2 : 1;
    var match = 0, bonusHit = false;
    for (i = 0; i < 6; i++) {
      var f = flag[myNums[i]];
      if (f === 1) match++;
      else if (f === 2) bonusHit = true;
    }
    for (i = 0; i < 7; i++) flag[w[i]] = 0;

    var rank = rankOf(match, bonusHit);
    var prize = st.prize[rank] || 0;

    st.bought++;
    st.spent += st.price;
    st.counts[rank]++;
    if (rank) {
      st.won += prize;
      st.sums[rank] += prize;
      if (st.best === 0 || rank < st.best) st.best = rank;
      st.logs.push({
        no: st.bought, rank: rank, nums: Array.prototype.slice.call(myNums),
        match: match, bonus: bonusHit, prize: prize
      });
      if (st.logs.length > 200) st.logs.shift();
      logDirty = true;
    }

    if (st.bought % st.sampleEvery === 0 || st.bought === st.total) {
      st.sx.push(st.bought);
      st.sSpent.push(st.spent);
      st.sWon.push(st.won);
    }
    return { rank: rank, match: match, bonus: bonusHit, win: w };
  }

  function loop(ts) {
    if (!running) return;
    var iv = +segSpeed.get();
    var remain = st.total - st.bought;
    var toBuy;
    if (iv === 0) {
      toBuy = Math.min(remain, 30000);
    } else {
      if (!lastTs) lastTs = ts;
      acc += ts - lastTs;
      toBuy = Math.floor(acc / iv);
      if (toBuy > 20000) toBuy = 20000;
      acc -= toBuy * iv;
      if (toBuy > remain) toBuy = remain;
    }
    lastTs = ts;

    var last = null;
    for (var i = 0; i < toBuy; i++) last = buyOne();
    st.elapsed = performance.now() - st.startedAt;

    if (last) paintTicket(last);
    paintStats();

    if (ts - lastChartAt > 260) { lastChartAt = ts; paintCharts(); }
    if (logDirty && ts - lastLogAt > 260) { lastLogAt = ts; logDirty = false; paintLog(); }

    if (st.bought >= st.total) { stop(true); return; }
    rafId = requestAnimationFrame(loop);
  }

  /* ── 그리기 ───────────────────────────────────────────── */
  function paintTicket(res) {
    var w = res.win;
    var winSet = {};
    for (var i = 0; i < 6; i++) winSet[w[i]] = 1;
    var bonus = w[6];
    var wsorted = Array.prototype.slice.call(w, 0, 6).sort(function (a, b) { return a - b; });
    el.winBalls.innerHTML = wsorted.map(function (n) { return ballHtml(n); }).join('') +
      '<span class="plus">+</span>' + ballHtml(bonus, { sm: true });
    var mine = Array.prototype.slice.call(myNums).sort(function (a, b) { return a - b; });
    el.myBalls.innerHTML = mine.map(function (n) {
      return ballHtml(n, { hit: !!winSet[n] || n === bonus, dim: !winSet[n] && n !== bonus });
    }).join('');
    el.ticketNo.textContent = '#' + UI.comma(st.bought);
    el.hitLine.innerHTML = '일치 ' + res.match + '개' + (res.bonus ? ' + 보너스' : '') +
      ' → ' + (res.rank ? '<b>' + RANK_NAME[res.rank] + '</b> ' + UI.won(st.prize[res.rank]) : '낙첨');
  }

  function paintStats() {
    var p = st.total ? st.bought / st.total : 0;
    el.progBar.style.width = (p * 100).toFixed(2) + '%';
    el.progText.textContent = UI.comma(st.bought) + ' / ' + UI.comma(st.total) + '장 · 경과 ' +
      fmtDur(st.elapsed / 1000) + (running ? '' : ' · 정지');

    el.spent.textContent = UI.korWon(st.spent);
    el.spentSub.textContent = UI.comma(st.bought) + '장';
    el.wonAmt.textContent = UI.korWon(st.won);
    var wins = st.counts[1] + st.counts[2] + st.counts[3] + st.counts[4] + st.counts[5];
    el.wonSub.textContent = '당첨 ' + UI.comma(wins) + '건';

    var net = st.won - st.spent;
    el.net.textContent = (net >= 0 ? '+' : '') + UI.korWon(net);
    el.netStat.className = 'stat ' + (net >= 0 ? 'good' : 'bad');
    el.roi.textContent = '회수율 ' + (st.spent ? UI.pct(st.won / st.spent) : '–');

    el.best.textContent = st.best ? RANK_NAME[st.best] : '–';
    el.bestSub.textContent = st.best
      ? UI.comma(st.counts[st.best]) + '회 · ' + UI.korWon(st.sums[st.best])
      : (st.bought ? '아직 당첨 없음' : '시작 전');

    paintProb();
  }

  function paintProb() {
    var rows = '';
    for (var r = 1; r <= 5; r++) {
      var pr = WAYS[r] / COMB;
      var expected = st.bought * pr;
      var cnt = st.counts[r];
      rows += '<tr>' +
        '<td><span class="badge r' + r + '">' + RANK_NAME[r] + '</span></td>' +
        '<td>1 / ' + UI.comma(COMB / WAYS[r]) + '</td>' +
        '<td class="t-muted">' + (expected >= 100 ? UI.comma(expected) : expected.toFixed(2)) + '건</td>' +
        '<td><b>' + UI.comma(cnt) + '</b>건</td>' +
        '<td>' + (cnt && st.bought ? '1 / ' + UI.comma(st.bought / cnt) : '–') + '</td>' +
        '<td>' + UI.korWon(st.sums[r]) + '</td></tr>';
    }
    rows += '<tr><td class="t-muted">낙첨</td><td class="t-muted">' +
      UI.pct(1 - (WAYS[1] + WAYS[2] + WAYS[3] + WAYS[4] + WAYS[5]) / COMB, 2) + '</td>' +
      '<td class="t-muted">–</td><td>' + UI.comma(st.counts[0]) + '건</td>' +
      '<td class="t-muted">' + (st.bought ? UI.pct(st.counts[0] / st.bought, 2) : '–') + '</td>' +
      '<td class="t-muted">0원</td></tr>';
    el.probBody.innerHTML = rows;
  }

  function paintLog() {
    if (!st.logs.length) {
      el.logBody.innerHTML = '<tr><td colspan="5" class="t-muted">아직 당첨 기록이 없습니다.</td></tr>';
      return;
    }
    var out = [];
    for (var i = st.logs.length - 1; i >= 0; i--) {
      var g = st.logs[i];
      out.push('<tr><td>#' + UI.comma(g.no) + '</td>' +
        '<td><span class="badge r' + g.rank + '">' + RANK_NAME[g.rank] + '</span></td>' +
        '<td style="text-align:left"><span class="balls">' +
        g.nums.slice().sort(function (a, b) { return a - b; })
          .map(function (n) { return ballHtml(n, { sm: true }); }).join('') + '</span></td>' +
        '<td>' + g.match + '개' + (g.bonus ? '+B' : '') + '</td>' +
        '<td>' + UI.won(g.prize) + '</td></tr>');
    }
    el.logBody.innerHTML = out.join('');
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function paintCharts() {
    var s1 = css('--s1'), s2 = css('--s2');

    if (st.bought === 0) {
      Chart.empty(el.rankChart, { emptyText: '시작하면 등수별 당첨금이 쌓입니다' });
      Chart.empty(el.cumChart, { emptyText: '시작하면 누적 곡선이 그려집니다' });
      return;
    }

    Chart.bar(el.rankChart, {
      height: 220,
      x: ['1등', '2등', '3등', '4등', '5등'],
      series: [{ name: '당첨금 합계', color: s1, values: st.sums.slice(1, 6) }],
      yFmt: Chart.fmtShort,
      tip: function (i) {
        var r = i + 1;
        return '<div class="tt">' + RANK_NAME[r] + '</div>' +
          '<div class="tr"><span class="tn">당첨</span><span class="tv">' + UI.comma(st.counts[r]) + '건</span></div>' +
          '<div class="tr"><span class="tn">합계</span><span class="tv">' + UI.korWon(st.sums[r]) + '</span></div>';
      }
    });

    Chart.line(el.cumChart, {
      height: 260,
      x: st.sx,
      xFmt: function (v) { return UI.comma(v) + '장'; },
      xLabel: '구입 매수',
      yFmt: Chart.fmtShort,
      fill: true,
      series: [
        { name: '누적 구입액', color: s2, values: st.sSpent },
        { name: '누적 당첨금', color: s1, values: st.sWon }
      ],
      tip: function (i) {
        var sp = st.sSpent[i], wo = st.sWon[i];
        return '<div class="tt">' + UI.comma(st.sx[i]) + '장째</div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">구입액</span>' +
          '<span class="tv">' + UI.korWon(sp) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">당첨금</span>' +
          '<span class="tv">' + UI.korWon(wo) + '</span></div>' +
          '<div class="tr"><span class="tn">회수율</span><span class="tv">' + UI.pct(wo / sp) + '</span></div>';
      }
    });
  }

  /* ── 제어 ─────────────────────────────────────────────── */
  function lockInputs(lock) {
    [el.qty, $('p1'), $('p2'), $('p3'), $('p4'), $('p5'), el.price, el.fixedNums, el.fillRand]
      .forEach(function (n) { if (n) n.disabled = lock; });
    document.querySelectorAll('#pickMode button, #drawMode button, .chips button')
      .forEach(function (b) { b.disabled = lock; });
  }

  function start() {
    var total = Math.floor(+el.qty.value || 0);
    if (!(total >= 1)) { alertHelp('구입 매수를 1장 이상 입력하세요.'); return; }
    if (total > 5000000) { alertHelp('최대 500만 장까지 시뮬레이션할 수 있습니다.'); return; }

    var mode = segPick.get();
    var fixed = parseFixed();
    if (mode === 'manual' && fixed.length !== 6) {
      alertHelp('수동(고정) 모드는 서로 다른 번호 6개가 필요합니다. 현재 ' + fixed.length + '개.');
      return;
    }
    if (mode === 'semi' && (fixed.length < 1 || fixed.length > 5)) {
      alertHelp('반자동 모드는 고정 번호 1~5개가 필요합니다. 현재 ' + fixed.length + '개.');
      return;
    }

    st = freshState();
    st.total = total;
    st.mode = mode;
    st.fixed = fixed;
    st.drawMode = segDraw.get();
    st.price = +el.price.value || 0;
    st.prize = prizeInputs();
    st.sampleEvery = Math.max(1, Math.ceil(total / 300));
    st.startedAt = performance.now();
    if (st.drawMode === 'single') {
      st.singleWin = new Uint8Array(drawWin());
      paintSingleWin();
    }

    lockInputs(true);
    el.logBody.innerHTML = '<tr><td colspan="5" class="t-muted">아직 당첨 기록이 없습니다.</td></tr>';
    resume();
  }

  function paintSingleWin() {
    var w = st.singleWin;
    var ws = Array.prototype.slice.call(w, 0, 6).sort(function (a, b) { return a - b; });
    el.winBalls.innerHTML = ws.map(function (n) { return ballHtml(n); }).join('') +
      '<span class="plus">+</span>' + ballHtml(w[6], { sm: true });
  }

  function resume() {
    running = true;
    lastTs = 0; acc = 0;
    st.startedAt = performance.now() - st.elapsed;
    el.startBtn.textContent = '일시정지';
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(rafId);
    el.startBtn.textContent = '재개';
    paintStats(); paintCharts(); paintLog();
  }

  function stop(done) {
    running = false;
    cancelAnimationFrame(rafId);
    el.startBtn.textContent = done ? '다시 시작' : '시작';
    lockInputs(false);
    paintStats(); paintCharts(); paintLog();
  }

  function reset() {
    running = false;
    cancelAnimationFrame(rafId);
    st = freshState();
    lockInputs(false);
    el.startBtn.textContent = '시작';
    el.progBar.style.width = '0';
    el.progText.textContent = '대기 중';
    el.winBalls.innerHTML = '<span class="t-muted">시작 전</span>';
    el.myBalls.innerHTML = '<span class="t-muted">시작 전</span>';
    el.ticketNo.textContent = '';
    el.hitLine.textContent = '일치 0개';
    paintStats();
    paintCharts();
    paintLog();
  }

  function alertHelp(msg) {
    el.fixedHelp.textContent = msg;
    el.fixedHelp.style.color = 'var(--critical)';
    setTimeout(function () {
      el.fixedHelp.style.color = '';
      el.fixedHelp.textContent = '1~45 사이 서로 다른 숫자를 콤마로 구분해 입력하세요.';
    }, 4000);
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  el.startBtn.addEventListener('click', function () {
    if (running) { pause(); return; }
    if (st && st.bought > 0 && st.bought < st.total) { resume(); return; }
    start();
  });
  el.resetBtn.addEventListener('click', reset);

  document.querySelectorAll('.chips button[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () {
      el.qty.value = b.dataset.qty;
      updateQtyHelp();
    });
  });

  el.fillRand.addEventListener('click', function () {
    var k = segPick.get() === 'semi' ? 3 : 6;
    var out = new Uint8Array(6);
    takeFrom(ticketPool, k, out);
    el.fixedNums.value = Array.prototype.slice.call(out, 0, k)
      .sort(function (a, b) { return a - b; }).join(', ');
  });

  el.qty.addEventListener('input', updateQtyHelp);
  el.price.addEventListener('input', updateQtyHelp);
  document.addEventListener('themechange', function () { if (st) paintCharts(); });

  /* 초기화 */
  onPickMode(segPick.get());
  updateQtyHelp();
  reset();
})();
