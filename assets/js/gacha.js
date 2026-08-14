/* 가챠(뽑기) 확률 시뮬레이터: 천장 + 픽업 보정 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    prob: $('prob'), probHelp: $('probHelp'), pity: $('pity'), pickup: $('pickup'),
    target: $('target'), cost: $('cost'), budget: $('budget'), sims: $('sims'),
    runBtn: $('runBtn'), sumHint: $('sumHint'),
    meanPulls: $('meanPulls'), meanCost: $('meanCost'),
    medPulls: $('medPulls'), medCost: $('medCost'),
    p90Pulls: $('p90Pulls'), p90Cost: $('p90Cost'),
    budgetStat: $('budgetStat'), budgetRate: $('budgetRate'), budgetSub: $('budgetSub'),
    cdfChart: $('cdfChart'), histChart: $('histChart'),
    pctBody: document.querySelector('#pctTable tbody')
  };

  function readInput() {
    return {
      p: Math.min(1, Math.max(0.00001, UI.parseNum(el.prob.value) / 100)),
      pity: Math.max(0, Math.floor(UI.parseNum(el.pity.value))),
      pickup: Math.min(1, Math.max(0.01, UI.parseNum(el.pickup.value) / 100)),
      target: Math.max(1, Math.floor(UI.parseNum(el.target.value) || 1)),
      cost: Math.max(0, UI.parseNum(el.cost.value)),
      budget: Math.max(0, UI.parseNum(el.budget.value)),
      sims: +el.sims.value
    };
  }

  function simulate(i) {
    var sims = i.sims;
    var out = new Int32Array(sims);
    var cap = i.pity > 0 ? i.pity * i.target * 4 + 1000 : 200000;  // 안전 상한

    for (var s = 0; s < sims; s++) {
      var pity = 0, got = 0, pulls = 0, guaranteed = false;
      while (got < i.target && pulls < cap) {
        pulls++; pity++;
        var hit = (i.pity > 0 && pity >= i.pity) || Math.random() < i.p;
        if (hit) {
          pity = 0;
          if (guaranteed || Math.random() < i.pickup) { got++; guaranteed = false; }
          else guaranteed = true;                     // 픽뚫 → 다음 획득은 확정
        }
      }
      out[s] = pulls;
    }
    var sorted = out.slice().sort();
    var sum = 0;
    for (var k = 0; k < sims; k++) sum += out[k];
    return { pulls: out, sorted: sorted, mean: sum / sims, sims: sims };
  }

  function pct(sorted, p) {
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }

  function countBelow(sorted, v) {
    var lo = 0, hi = sorted.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (sorted[mid] <= v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  var current = null, currentInput = null;

  function run() {
    var i = readInput();
    currentInput = i;

    /* 이론값: 천장 없을 때 기대 뽑기 = 1/p, 픽업 보정 포함 */
    var expectPerHit = 1 / i.p;
    var expectPerTarget = expectPerHit * (2 - i.pickup) / 1;  // 픽업 실패 시 한 번 더 필요
    el.probHelp.textContent = '천장이 없다면 평균 ' + Math.round(expectPerHit) + '회에 1개' +
      (i.pickup < 1 ? ', 픽업 보정까지 넣으면 목표 1개당 ' + Math.round(expectPerTarget) + '회' : '') +
      ' 필요합니다.';

    var r = simulate(i);
    current = r;

    el.sumHint.textContent = (i.p * 100).toFixed(2) + '% · 천장 ' +
      (i.pity ? i.pity + '회' : '없음') + ' · 픽업 ' + (i.pickup * 100).toFixed(0) + '% · 목표 ' +
      i.target + '개 · ' + UI.comma(r.sims) + '회 시뮬';

    var med = pct(r.sorted, 0.5), p90 = pct(r.sorted, 0.9);
    el.meanPulls.textContent = UI.comma(r.mean) + '회';
    el.meanCost.textContent = UI.korWon(r.mean * i.cost);
    el.medPulls.textContent = UI.comma(med) + '회';
    el.medCost.textContent = UI.korWon(med * i.cost);
    el.p90Pulls.textContent = UI.comma(p90) + '회';
    el.p90Cost.textContent = UI.korWon(p90 * i.cost);

    if (i.budget > 0 && i.cost > 0) {
      var affordable = Math.floor(i.budget / i.cost);
      var rate = countBelow(r.sorted, affordable) / r.sims;
      el.budgetRate.textContent = UI.pct(rate, 1);
      el.budgetSub.textContent = UI.korWon(i.budget) + ' = ' + UI.comma(affordable) + '회 가능';
      el.budgetStat.className = 'stat ' + (rate >= 0.5 ? 'good' : 'bad');
    } else {
      el.budgetRate.textContent = '–';
      el.budgetSub.textContent = '예산과 1회 비용을 입력하세요';
      el.budgetStat.className = 'stat';
    }

    renderCharts(r, i);
    renderTable(r, i);
  }

  function renderCharts(r, i) {
    var s1 = css('--s1');
    var maxShow = pct(r.sorted, 0.99);

    /* CDF */
    var xs = [], ys = [], stepN = Math.max(1, Math.ceil(maxShow / 60));
    for (var n = 0; n <= maxShow; n += stepN) {
      xs.push(n);
      ys.push(countBelow(r.sorted, n) / r.sims);
    }
    Chart.line(el.cdfChart, {
      height: 250,
      x: xs,
      xFmt: function (v) { return UI.comma(v) + '회'; },
      xLabel: '뽑기 횟수',
      yFmt: function (v) { return (v * 100).toFixed(0) + '%'; },
      yMax: 1,
      fill: true,
      endLabels: false,
      series: [{ name: '달성 확률', color: s1, values: ys }],
      tip: function (idx) {
        return '<div class="tt">' + UI.comma(xs[idx]) + '회 이내</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">달성 확률</span>' +
          '<span class="tv">' + UI.pct(ys[idx], 1) + '</span></div>' +
          '<div class="tr"><span class="tn">누적 비용</span><span class="tv">' +
          UI.korWon(xs[idx] * i.cost) + '</span></div>';
      }
    });

    /* 히스토그램 */
    var bins = 20, hi = maxShow || 1, w = Math.max(1, Math.ceil(hi / bins));
    var counts = [], labels = [];
    for (var b = 0; b < bins; b++) {
      counts.push(0);
      labels.push((b * w + 1) + '~' + ((b + 1) * w));
    }
    for (var k = 0; k < r.pulls.length; k++) {
      var idx = Math.min(bins - 1, Math.floor((r.pulls[k] - 1) / w));
      if (idx >= 0) counts[idx]++;
    }
    Chart.bar(el.histChart, {
      height: 220,
      x: labels,
      xLabel: '뽑기 횟수 구간',
      series: [{ name: '시뮬 건수', color: s1, values: counts }],
      yFmt: function (v) { return UI.comma(v); },
      tip: function (idx) {
        return '<div class="tt">' + labels[idx] + '회</div>' +
          '<div class="tr"><span class="tn">건수</span><span class="tv">' + UI.comma(counts[idx]) + '</span></div>' +
          '<div class="tr"><span class="tn">비율</span><span class="tv">' + UI.pct(counts[idx] / r.sims, 1) + '</span></div>';
      }
    });
  }

  function renderTable(r, i) {
    var rows = [
      [0.1, '운 좋은 상위 10%'],
      [0.25, '상위 25%'],
      [0.5, '중앙값 — 절반은 여기까지'],
      [0.75, '하위 25%'],
      [0.9, '운 나쁜 10%'],
      [0.99, '극악 1%']
    ].map(function (t) {
      var v = pct(r.sorted, t[0]);
      return '<tr' + (t[0] === 0.5 ? ' class="year-mark"' : '') + '><td>p' + (t[0] * 100) + '</td>' +
        '<td>' + UI.comma(v) + '회</td><td>' + UI.korWon(v * i.cost) + '</td>' +
        '<td style="text-align:left" class="t-muted">' + t[1] + '</td></tr>';
    });
    rows.push('<tr><td>최댓값</td><td>' + UI.comma(r.sorted[r.sorted.length - 1]) + '회</td><td>' +
      UI.korWon(r.sorted[r.sorted.length - 1] * i.cost) +
      '</td><td style="text-align:left" class="t-muted">' + UI.comma(r.sims) + '번 중 최악</td></tr>');
    el.pctBody.innerHTML = rows.join('');
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }

  ['prob', 'pity', 'pickup', 'target', 'cost', 'budget'].forEach(function (k) {
    el[k].addEventListener('input', schedule);
  });
  el.sims.addEventListener('change', run);
  el.runBtn.addEventListener('click', run);
  document.querySelectorAll('.chips button[data-p]').forEach(function (b) {
    b.addEventListener('click', function () { el.prob.value = b.dataset.p; run(); });
  });
  document.addEventListener('themechange', function () {
    if (current) renderCharts(current, currentInput);
  });

  run();
})();
