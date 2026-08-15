/* 연봉 실수령액 추정: 4대보험 + 근로소득세(연간 추정) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* 계산 로직은 salary-core.js와 공유한다(구간별 표 페이지와 결과가 항상 같아야 함) */
  var calc = SalaryCore.calc;

  var el = {
    annual: $('annual'), annualHelp: $('annualHelp'), nontax: $('nontax'),
    family: $('family'), children: $('children'),
    rPension: $('rPension'), rHealth: $('rHealth'), rCare: $('rCare'), rEmploy: $('rEmploy'),
    pensionMax: $('pensionMax'), pensionMin: $('pensionMin'),
    sumHint: $('sumHint'), monthlyNet: $('monthlyNet'), monthlyNetSub: $('monthlyNetSub'),
    annualNet: $('annualNet'), monthlyDeduct: $('monthlyDeduct'), deductRate: $('deductRate'),
    splitVal: $('splitVal'),
    deductChart: $('deductChart'), curveChart: $('curveChart'),
    detailBody: document.querySelector('#detailTable tbody')
  };

  function readInput() {
    return {
      annual: Math.max(0, UI.parseNum(el.annual.value)),
      nontax: Math.max(0, UI.parseNum(el.nontax.value)),
      family: Math.max(1, Math.floor(UI.parseNum(el.family.value) || 1)),
      children: Math.max(0, Math.floor(UI.parseNum(el.children.value))),
      rPension: UI.parseNum(el.rPension.value),
      rHealth: UI.parseNum(el.rHealth.value),
      rCare: UI.parseNum(el.rCare.value),
      rEmploy: UI.parseNum(el.rEmploy.value),
      pensionMax: UI.parseNum(el.pensionMax.value),
      pensionMin: UI.parseNum(el.pensionMin.value)
    };
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  var current = null, currentInput = null;

  function render() {
    var inp = readInput();
    currentInput = inp;
    el.annualHelp.textContent = inp.annual
      ? UI.korWon(inp.annual) + ' · 월 세전 ' + UI.korWon(inp.annual / 12) : '연봉을 입력하세요';

    if (!inp.annual) {
      current = null;
      ['monthlyNet', 'annualNet', 'monthlyDeduct', 'splitVal'].forEach(function (k) { el[k].textContent = '–'; });
      el.monthlyNetSub.textContent = el.deductRate.textContent = el.sumHint.textContent = '';
      Chart.empty(el.deductChart, { emptyText: '연봉을 입력하세요' });
      Chart.empty(el.curveChart, { emptyText: '연봉을 입력하세요' });
      el.detailBody.innerHTML = '';
      return;
    }

    var r = calc(inp);
    current = r;

    el.sumHint.textContent = '부양가족 ' + inp.family + '명' +
      (inp.children ? ' · 자녀 ' + inp.children + '명' : '') +
      ' · 비과세 월 ' + UI.comma(inp.nontax) + '원';
    el.monthlyNet.textContent = UI.korWon(r.netMonth);
    el.monthlyNetSub.textContent = '세전 ' + UI.korWon(r.monthlyGross) + ' 대비 ' +
      UI.pct(r.netMonth / r.monthlyGross);
    el.annualNet.textContent = UI.korWon(r.netYear);
    el.monthlyDeduct.textContent = UI.korWon(r.totalMonth);
    el.deductRate.textContent = '공제율 ' + UI.pct(r.totalMonth / r.monthlyGross);
    el.splitVal.textContent = UI.korWon(r.insuranceMonth) + ' / ' + UI.korWon(r.taxMonth);

    renderCharts(r, inp);
    renderTable(r, inp);
  }

  function renderCharts(r, inp) {
    var s1 = css('--s1');

    Chart.bar(el.deductChart, {
      height: 220,
      x: r.items.map(function (i) { return i.name; }),
      series: [{ name: '월 공제액', color: s1, values: r.items.map(function (i) { return i.month; }) }],
      yFmt: Chart.fmtShort,
      tip: function (i) {
        var it = r.items[i];
        return '<div class="tt">' + it.name + '</div>' +
          '<div class="tr"><span class="tn">월</span><span class="tv">' + UI.won(it.month) + '</span></div>' +
          '<div class="tr"><span class="tn">연</span><span class="tv">' + UI.korWon(it.month * 12) + '</span></div>' +
          '<div class="tr"><span class="tn">공제 중 비중</span><span class="tv">' +
          UI.pct(it.month / r.totalMonth) + '</span></div>';
      }
    });

    /* 연봉 구간별 곡선: 2,000만 ~ 2억 */
    var xs = [], net = [];
    for (var a = 20000000; a <= 200000000; a += 2000000) {
      xs.push(a);
      net.push(calc(Object.assign({}, inp, { annual: a })).netMonth);
    }
    Chart.line(el.curveChart, {
      height: 240,
      x: xs,
      xFmt: function (v) { return (v / 10000000).toFixed(0) + '천만'; },
      xLabel: '연봉',
      yFmt: Chart.fmtShort,
      endLabels: false,
      fill: true,
      series: [{ name: '월 실수령액', color: s1, values: net }],
      tip: function (i) {
        return '<div class="tt">연봉 ' + UI.korWon(xs[i]) + '</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">월 실수령</span>' +
          '<span class="tv">' + UI.korWon(net[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">실수령 비율</span><span class="tv">' +
          UI.pct(net[i] / (xs[i] / 12)) + '</span></div>';
      }
    });
  }

  function renderTable(r, inp) {
    var rows = r.items.map(function (i) {
      return '<tr><td>' + i.name + '</td><td>' + UI.comma(i.month) + '</td><td>' +
        UI.comma(i.month * 12) + '</td><td>' + UI.pct(i.month * 12 / inp.annual, 2) + '</td></tr>';
    });
    rows.push('<tr class="year-mark"><td>공제 합계</td><td>' + UI.comma(r.totalMonth) + '</td><td>' +
      UI.comma(r.totalMonth * 12) + '</td><td>' + UI.pct(r.totalMonth * 12 / inp.annual, 2) + '</td></tr>');
    rows.push('<tr class="year-mark"><td>실수령액</td><td>' + UI.comma(r.netMonth) + '</td><td>' +
      UI.comma(r.netYear) + '</td><td>' + UI.pct(r.netYear / inp.annual, 2) + '</td></tr>');
    rows.push('<tr><td class="t-muted">과세표준 / 산출세액 / 세액공제</td><td colspan="3" class="t-muted" style="text-align:left">' +
      UI.korWon(r.taxBase) + ' / ' + UI.korWon(r.calcTax) + ' / ' + UI.korWon(r.credit) + '</td></tr>');
    el.detailBody.innerHTML = rows.join('');
  }

  ['annual', 'nontax', 'family', 'children', 'rPension', 'rHealth', 'rCare', 'rEmploy',
    'pensionMax', 'pensionMin'].forEach(function (k) {
      el[k].addEventListener('input', render);
    });
  document.querySelectorAll('.chips button[data-a]').forEach(function (b) {
    b.addEventListener('click', function () { el.annual.value = b.dataset.a; render(); });
  });
  document.addEventListener('themechange', function () {
    if (current) renderCharts(current, currentInput);
  });

  render();
})();
