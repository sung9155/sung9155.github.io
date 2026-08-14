/* 은퇴 자산 소진 시뮬레이터 (몬테카를로) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    ageNow: $('ageNow'), ageRetire: $('ageRetire'), ageEnd: $('ageEnd'),
    assets: $('assets'), assetsHelp: $('assetsHelp'),
    saveMonthly: $('saveMonthly'), spendMonthly: $('spendMonthly'),
    ret: $('ret'), vol: $('vol'), infl: $('infl'), sims: $('sims'),
    pension: $('pension'), pensionAge: $('pensionAge'), runBtn: $('runBtn'),
    sumHint: $('sumHint'), successRate: $('successRate'), successSub: $('successSub'),
    atRetire: $('atRetire'), atRetireSub: $('atRetireSub'),
    ruinAge: $('ruinAge'), ruinSub: $('ruinSub'),
    firstSpend: $('firstSpend'), firstSpendSub: $('firstSpendSub'),
    pathChart: $('pathChart'), ruinChart: $('ruinChart'),
    ageBody: document.querySelector('#ageTable tbody')
  };

  /* 표준정규 난수 (Box-Muller, 값 하나는 캐시) */
  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u, v, s2;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s2 = u * u + v * v;
    } while (s2 >= 1 || s2 === 0);
    var mul = Math.sqrt(-2 * Math.log(s2) / s2);
    spare = v * mul;
    return u * mul;
  }

  function readInput() {
    var n = function (node, min) { var v = UI.parseNum(node.value); return min !== undefined ? Math.max(min, v) : v; };
    var ageNow = Math.floor(n(el.ageNow, 18));
    var ageRetire = Math.max(ageNow, Math.floor(n(el.ageRetire, 18)));
    var ageEnd = Math.max(ageRetire + 1, Math.floor(n(el.ageEnd, 30)));
    return {
      ageNow: ageNow, ageRetire: ageRetire, ageEnd: ageEnd,
      assets: n(el.assets, 0), save: n(el.saveMonthly, 0), spend: n(el.spendMonthly, 0),
      ret: n(el.ret) / 100, vol: Math.max(0, n(el.vol)) / 100, infl: n(el.infl, 0) / 100,
      sims: +el.sims.value,
      pension: n(el.pension, 0), pensionAge: Math.floor(n(el.pensionAge, 50))
    };
  }

  function simulate(i) {
    var months = (i.ageEnd - i.ageNow) * 12;
    var mRet = Math.pow(1 + i.ret, 1 / 12) - 1;
    var mVol = i.vol / Math.sqrt(12);
    var mInfl = Math.pow(1 + i.infl, 1 / 12) - 1;
    var sims = i.sims;

    var paths = new Float64Array(sims * (months + 1));
    var ruin = new Int16Array(sims);      // 소진 개월(없으면 -1)
    var retireIdx = (i.ageRetire - i.ageNow) * 12;

    for (var s = 0; s < sims; s++) {
      var bal = i.assets;
      var infFactor = 1;
      paths[s * (months + 1)] = bal;
      ruin[s] = -1;
      for (var m = 1; m <= months; m++) {
        var age = i.ageNow + (m - 1) / 12;
        var r = mVol > 0 ? mRet + mVol * gauss() : mRet;
        bal *= (1 + r);
        infFactor *= (1 + mInfl);
        if (m <= retireIdx) {
          bal += i.save * infFactor;                       // 은퇴 전: 저축
        } else {
          bal -= i.spend * infFactor;                      // 은퇴 후: 생활비
          if (age >= i.pensionAge) bal += i.pension * infFactor;
        }
        if (bal <= 0) {
          bal = 0;
          if (ruin[s] < 0) ruin[s] = m;
        }
        paths[s * (months + 1) + m] = bal;
      }
    }

    /* 월별 백분위 */
    var p10 = new Float64Array(months + 1), p50 = new Float64Array(months + 1), p90 = new Float64Array(months + 1);
    var col = new Float64Array(sims);
    for (var m2 = 0; m2 <= months; m2++) {
      for (var s2 = 0; s2 < sims; s2++) col[s2] = paths[s2 * (months + 1) + m2];
      var sorted = col.slice().sort();      // Float64Array.sort는 기본이 숫자 오름차순
      p10[m2] = sorted[Math.floor(sims * 0.1)];
      p50[m2] = sorted[Math.floor(sims * 0.5)];
      p90[m2] = sorted[Math.floor(sims * 0.9)];
    }

    var ruinAges = [], success = 0;
    for (var s3 = 0; s3 < sims; s3++) {
      if (ruin[s3] < 0) success++;
      else ruinAges.push(i.ageNow + ruin[s3] / 12);
    }
    ruinAges.sort(function (a, b) { return a - b; });

    return {
      months: months, retireIdx: retireIdx,
      p10: p10, p50: p50, p90: p90,
      successRate: success / sims, ruinAges: ruinAges, sims: sims,
      atRetire: p50[retireIdx],
      atRetireLow: p10[retireIdx], atRetireHigh: p90[retireIdx],
      inflAtRetire: Math.pow(1 + i.infl, i.ageRetire - i.ageNow)
    };
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  var current = null, currentInput = null;

  function run() {
    var i = readInput();
    currentInput = i;
    el.assetsHelp.textContent = i.assets ? UI.korWon(i.assets) : '';

    var r = simulate(i);
    current = r;

    el.sumHint.textContent = i.ageNow + '세 → ' + i.ageRetire + '세 은퇴 → ' + i.ageEnd + '세 · ' +
      '수익률 ' + (i.ret * 100).toFixed(1) + '% ± ' + (i.vol * 100).toFixed(0) + '% · ' +
      UI.comma(r.sims) + '회 시뮬';

    el.successRate.textContent = UI.pct(r.successRate, 1);
    el.successSub.textContent = i.ageEnd + '세까지 자산이 남을 확률';
    el.atRetire.textContent = UI.korWon(r.atRetire);
    el.atRetireSub.textContent = '하위10% ' + UI.korWon(r.atRetireLow) + ' · 상위10% ' + UI.korWon(r.atRetireHigh);

    if (r.ruinAges.length === 0) {
      el.ruinAge.textContent = '없음';
      el.ruinSub.textContent = '모든 경로에서 자산 유지';
    } else {
      var med = r.ruinAges[Math.floor(r.ruinAges.length / 2)];
      el.ruinAge.textContent = med.toFixed(1) + '세';
      el.ruinSub.textContent = '소진 경로 ' + UI.comma(r.ruinAges.length) + '건 · 최빈 구간 ' +
        Math.floor(r.ruinAges[0]) + '~' + Math.ceil(r.ruinAges[r.ruinAges.length - 1]) + '세';
    }

    var firstSpend = i.spend * r.inflAtRetire;
    el.firstSpend.textContent = UI.korWon(firstSpend);
    el.firstSpendSub.textContent = '현재가치 ' + UI.korWon(i.spend) + ' · 물가 ' +
      ((r.inflAtRetire - 1) * 100).toFixed(0) + '% 상승 반영';

    renderCharts(r, i);
    renderTable(r, i);
  }

  function renderCharts(r, i) {
    var s1 = css('--s1'), s2 = css('--s2'), s3 = css('--s3');
    var ages = [], p10 = [], p50 = [], p90 = [];
    for (var m = 0; m <= r.months; m += 3) {           // 분기 단위로 표본
      ages.push(i.ageNow + m / 12);
      p10.push(r.p10[m]); p50.push(r.p50[m]); p90.push(r.p90[m]);
    }

    Chart.line(el.pathChart, {
      height: 270,
      x: ages,
      xFmt: function (v) { return v.toFixed(0) + '세'; },
      xLabel: '나이',
      yFmt: Chart.fmtShort,
      series: [
        { name: '상위 10%', color: s3, values: p90 },
        { name: '중앙값', color: s1, values: p50 },
        { name: '하위 10%', color: s2, values: p10 }
      ],
      tip: function (idx) {
        return '<div class="tt">' + ages[idx].toFixed(1) + '세' +
          (ages[idx] >= i.ageRetire ? ' (은퇴 후)' : ' (은퇴 전)') + '</div>' +
          '<div class="tr"><span class="sw" style="background:' + s3 + '"></span><span class="tn">상위 10%</span>' +
          '<span class="tv">' + UI.korWon(p90[idx]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">중앙값</span>' +
          '<span class="tv">' + UI.korWon(p50[idx]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">하위 10%</span>' +
          '<span class="tv">' + UI.korWon(p10[idx]) + '</span></div>';
      }
    });

    /* 소진 나이 히스토그램 (5세 단위) */
    var start = Math.floor(i.ageRetire / 5) * 5;
    var buckets = [], labels = [];
    for (var a = start; a < i.ageEnd; a += 5) {
      labels.push(a + '~' + (a + 4));
      buckets.push(0);
    }
    r.ruinAges.forEach(function (age) {
      var idx = Math.floor((age - start) / 5);
      if (idx >= 0 && idx < buckets.length) buckets[idx]++;
    });
    labels.push('유지');
    buckets.push(r.sims - r.ruinAges.length);

    Chart.bar(el.ruinChart, {
      height: 220,
      x: labels,
      series: [{ name: '경로 수', color: s1, values: buckets }],
      yFmt: function (v) { return UI.comma(v); },
      xLabel: '자산 소진 나이',
      tip: function (idx) {
        return '<div class="tt">' + labels[idx] + (idx === labels.length - 1 ? '' : '세') + '</div>' +
          '<div class="tr"><span class="tn">경로</span><span class="tv">' + UI.comma(buckets[idx]) + '건</span></div>' +
          '<div class="tr"><span class="tn">비율</span><span class="tv">' + UI.pct(buckets[idx] / r.sims, 1) + '</span></div>';
      }
    });
  }

  function renderTable(r, i) {
    var out = [];
    for (var age = i.ageNow; age <= i.ageEnd; age++) {
      var m = (age - i.ageNow) * 12;
      if (m > r.months) break;
      var spend = age >= i.ageRetire ? i.spend * Math.pow(1 + i.infl, age - i.ageNow) * 12 : 0;
      var state = age < i.ageRetire ? '적립'
        : (r.p50[m] > 0 ? '인출' : '소진');
      out.push('<tr' + (age === i.ageRetire ? ' class="year-mark"' : '') + '><td>' + age + '세' +
        (age === i.ageRetire ? ' <span class="badge r5">은퇴</span>' : '') + '</td>' +
        '<td>' + UI.korWon(r.p10[m]) + '</td><td>' + UI.korWon(r.p50[m]) + '</td>' +
        '<td>' + UI.korWon(r.p90[m]) + '</td>' +
        '<td>' + (spend ? UI.korWon(spend) : '–') + '</td>' +
        '<td class="' + (state === '소진' ? 't-muted' : '') + '">' + state + '</td></tr>');
    }
    el.ageBody.innerHTML = out.join('');
  }

  var timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  ['ageNow', 'ageRetire', 'ageEnd', 'assets', 'saveMonthly', 'spendMonthly',
    'ret', 'vol', 'infl', 'pension', 'pensionAge'].forEach(function (k) {
      el[k].addEventListener('input', schedule);
    });
  el.sims.addEventListener('change', run);
  el.runBtn.addEventListener('click', run);
  document.addEventListener('themechange', function () {
    if (current) renderCharts(current, currentInput);
  });

  run();
})();
