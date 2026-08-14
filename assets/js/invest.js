/* 적립식(분할매수) vs 거치식(일시투자) 몬테카를로 비교 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    total: $('total'), totalHelp: $('totalHelp'),
    months: $('months'), monthsHelp: $('monthsHelp'), horizon: $('horizon'),
    ret: $('ret'), vol: $('vol'), cash: $('cash'), sims: $('sims'), runBtn: $('runBtn'),
    sumHint: $('sumHint'), winRate: $('winRate'), winSub: $('winSub'),
    lumpMed: $('lumpMed'), lumpSub: $('lumpSub'),
    dcaMed: $('dcaMed'), dcaSub: $('dcaSub'), worstGap: $('worstGap'),
    pathChart: $('pathChart'), cdfChart: $('cdfChart'),
    statBody: document.querySelector('#statTable tbody')
  };

  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u, v, q;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; q = u * u + v * v; }
    while (q >= 1 || q === 0);
    var mul = Math.sqrt(-2 * Math.log(q) / q);
    spare = v * mul;
    return u * mul;
  }

  function readInput() {
    var months = Math.max(1, Math.floor(UI.parseNum(el.months.value) || 1));
    var horizon = Math.max(months, Math.floor(UI.parseNum(el.horizon.value) || months));
    return {
      total: Math.max(0, UI.parseNum(el.total.value)),
      months: months, horizon: horizon,
      ret: UI.parseNum(el.ret.value) / 100,
      vol: Math.max(0, UI.parseNum(el.vol.value)) / 100,
      cash: Math.max(0, UI.parseNum(el.cash.value)) / 100,
      sims: +el.sims.value
    };
  }

  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 0;
    var idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
    return sortedArr[idx];
  }

  function simulate(i) {
    var n = i.horizon;
    var mRet = Math.pow(1 + i.ret, 1 / 12) - 1;
    var mVol = i.vol / Math.sqrt(12);
    var mCash = Math.pow(1 + i.cash, 1 / 12) - 1;
    var per = i.total / i.months;
    var sims = i.sims;

    var lumpFinal = new Float64Array(sims), dcaFinal = new Float64Array(sims);
    var lumpWin = 0;
    /* 경로 중앙값용 누적(메모리 절약: 월별 표본을 모아 정렬) */
    var sample = [];
    var step = Math.max(1, Math.ceil(n / 60));
    for (var k = 0; k <= n; k += step) sample.push(k);
    if (sample[sample.length - 1] !== n) sample.push(n);
    var lumpPaths = new Float64Array(sims * sample.length);
    var dcaPaths = new Float64Array(sims * sample.length);

    for (var s = 0; s < sims; s++) {
      var lump = i.total, invested = 0, cashLeft = i.total, si = 0;
      if (sample[0] === 0) {
        lumpPaths[s * sample.length] = lump;
        dcaPaths[s * sample.length] = cashLeft;
        si = 1;
      }
      for (var m = 1; m <= n; m++) {
        var r = mVol > 0 ? mRet + mVol * gauss() : mRet;
        lump *= (1 + r);
        if (m <= i.months) {
          var put = Math.min(per, cashLeft);
          invested += put;
          cashLeft -= put;
        }
        invested *= (1 + r);
        cashLeft *= (1 + mCash);
        if (si < sample.length && sample[si] === m) {
          lumpPaths[s * sample.length + si] = lump;
          dcaPaths[s * sample.length + si] = invested + cashLeft;
          si++;
        }
      }
      lumpFinal[s] = lump;
      dcaFinal[s] = invested + cashLeft;
      if (lump > dcaFinal[s]) lumpWin++;
    }

    var lumpSorted = lumpFinal.slice().sort();
    var dcaSorted = dcaFinal.slice().sort();

    /* 표본 시점별 중앙값 */
    var lumpMedPath = [], dcaMedPath = [], col = new Float64Array(sims);
    for (var t = 0; t < sample.length; t++) {
      for (var s2 = 0; s2 < sims; s2++) col[s2] = lumpPaths[s2 * sample.length + t];
      lumpMedPath.push(percentile(col.slice().sort(), 0.5));
      for (var s3 = 0; s3 < sims; s3++) col[s3] = dcaPaths[s3 * sample.length + t];
      dcaMedPath.push(percentile(col.slice().sort(), 0.5));
    }

    return {
      sims: sims, sample: sample,
      lumpSorted: lumpSorted, dcaSorted: dcaSorted,
      lumpMedPath: lumpMedPath, dcaMedPath: dcaMedPath,
      lumpWinRate: lumpWin / sims,
      lumpMean: mean(lumpFinal), dcaMean: mean(dcaFinal)
    };
  }

  function mean(arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return arr.length ? s / arr.length : 0;
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  var current = null, currentInput = null;

  function run() {
    var i = readInput();
    currentInput = i;
    el.totalHelp.textContent = i.total ? UI.korWon(i.total) : '';
    el.monthsHelp.textContent = i.total
      ? '적립식은 매월 ' + UI.korWon(i.total / i.months) + '씩 ' + i.months + '회 투입' : '';

    var r = simulate(i);
    current = r;

    el.sumHint.textContent = '연 ' + (i.ret * 100).toFixed(1) + '% ± ' + (i.vol * 100).toFixed(0) +
      '% · ' + i.horizon + '개월 보유 · ' + UI.comma(r.sims) + '회';

    el.winRate.textContent = UI.pct(r.lumpWinRate, 1);
    el.winSub.textContent = '적립식이 이길 확률 ' + UI.pct(1 - r.lumpWinRate, 1);

    var lumpMed = percentile(r.lumpSorted, 0.5), dcaMed = percentile(r.dcaSorted, 0.5);
    el.lumpMed.textContent = UI.korWon(lumpMed);
    el.lumpSub.textContent = '원금 대비 ' + UI.pct(lumpMed / i.total - 1, 1);
    el.dcaMed.textContent = UI.korWon(dcaMed);
    el.dcaSub.textContent = '원금 대비 ' + UI.pct(dcaMed / i.total - 1, 1);

    var lumpLow = percentile(r.lumpSorted, 0.1), dcaLow = percentile(r.dcaSorted, 0.1);
    el.worstGap.textContent = (dcaLow >= lumpLow ? '적립식 +' : '거치식 +') +
      UI.korWon(Math.abs(dcaLow - lumpLow));

    renderCharts(r, i);
    renderTable(r, i);
  }

  function renderCharts(r, i) {
    var s1 = css('--s1'), s2 = css('--s2');

    Chart.line(el.pathChart, {
      height: 260,
      x: r.sample,
      xFmt: function (v) { return v + '개월'; },
      xLabel: '경과 개월',
      yFmt: Chart.fmtShort,
      series: [
        { name: '거치식', color: s1, values: r.lumpMedPath },
        { name: '적립식', color: s2, values: r.dcaMedPath }
      ],
      tip: function (idx) {
        return '<div class="tt">' + r.sample[idx] + '개월</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">거치식</span>' +
          '<span class="tv">' + UI.korWon(r.lumpMedPath[idx]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">적립식</span>' +
          '<span class="tv">' + UI.korWon(r.dcaMedPath[idx]) + '</span></div>';
      }
    });

    /* 누적분포(CDF): 공통 x축 20구간 */
    var lo = Math.min(r.lumpSorted[0], r.dcaSorted[0]);
    var hi = Math.max(percentile(r.lumpSorted, 0.98), percentile(r.dcaSorted, 0.98));
    var bins = 24, xs = [], lumpCdf = [], dcaCdf = [];
    for (var b = 0; b <= bins; b++) {
      var v = lo + (hi - lo) * b / bins;
      xs.push(v);
      lumpCdf.push(countBelow(r.lumpSorted, v) / r.sims);
      dcaCdf.push(countBelow(r.dcaSorted, v) / r.sims);
    }
    Chart.line(el.cdfChart, {
      height: 240,
      x: xs,
      xFmt: function (v) { return Chart.fmtShort(v); },
      xLabel: '최종 금액',
      yFmt: function (v) { return (v * 100).toFixed(0) + '%'; },
      yMax: 1,
      series: [
        { name: '거치식', color: s1, values: lumpCdf },
        { name: '적립식', color: s2, values: dcaCdf }
      ],
      tip: function (idx) {
        return '<div class="tt">' + UI.korWon(xs[idx]) + ' 이하일 확률</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">거치식</span>' +
          '<span class="tv">' + UI.pct(lumpCdf[idx], 1) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">적립식</span>' +
          '<span class="tv">' + UI.pct(dcaCdf[idx], 1) + '</span></div>';
      }
    });
  }

  function countBelow(sorted, v) {
    var lo = 0, hi = sorted.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (sorted[mid] <= v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function renderTable(r, i) {
    function row(name, a, b, fmt) {
      var f = fmt || UI.korWon;
      var d = b - a;
      return '<tr><td>' + name + '</td><td>' + f(a) + '</td><td>' + f(b) + '</td>' +
        '<td>' + (d >= 0 ? '+' : '−') + f(Math.abs(d)) + '</td></tr>';
    }
    var rows = [
      row('평균', r.lumpMean, r.dcaMean),
      row('중앙값 (p50)', percentile(r.lumpSorted, 0.5), percentile(r.dcaSorted, 0.5)),
      row('하위 10% (p10)', percentile(r.lumpSorted, 0.1), percentile(r.dcaSorted, 0.1)),
      row('상위 10% (p90)', percentile(r.lumpSorted, 0.9), percentile(r.dcaSorted, 0.9)),
      row('최저', r.lumpSorted[0], r.dcaSorted[0]),
      row('최고', r.lumpSorted[r.lumpSorted.length - 1], r.dcaSorted[r.dcaSorted.length - 1])
    ];
    var lumpLoss = countBelow(r.lumpSorted, i.total) / r.sims;
    var dcaLoss = countBelow(r.dcaSorted, i.total) / r.sims;
    rows.push('<tr class="year-mark"><td>원금 손실 확률</td><td>' + UI.pct(lumpLoss, 1) +
      '</td><td>' + UI.pct(dcaLoss, 1) + '</td><td>' +
      ((dcaLoss - lumpLoss) >= 0 ? '+' : '−') + UI.pct(Math.abs(dcaLoss - lumpLoss), 1) + '</td></tr>');
    el.statBody.innerHTML = rows.join('');
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }

  ['total', 'months', 'horizon', 'ret', 'vol', 'cash'].forEach(function (k) {
    el[k].addEventListener('input', schedule);
  });
  el.sims.addEventListener('change', run);
  el.runBtn.addEventListener('click', run);
  document.querySelectorAll('.chips button[data-months]').forEach(function (b) {
    b.addEventListener('click', function () { el.months.value = b.dataset.months; run(); });
  });
  document.addEventListener('themechange', function () {
    if (current) renderCharts(current, currentInput);
  });

  run();
})();
