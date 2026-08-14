/* 연봉 실수령액 추정: 4대보험 + 근로소득세(연간 추정) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* 종합소득세 누진세율 (과세표준, 세율, 누진공제) */
  var BRACKETS = [
    [14000000, 0.06, 0],
    [50000000, 0.15, 1260000],
    [88000000, 0.24, 5760000],
    [150000000, 0.35, 15440000],
    [300000000, 0.38, 19940000],
    [500000000, 0.40, 25940000],
    [1000000000, 0.42, 35940000],
    [Infinity, 0.45, 65940000]
  ];

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

  /* 근로소득공제 (총급여 기준, 한도 2,000만원) */
  function earnedIncomeDeduction(gross) {
    var d;
    if (gross <= 5000000) d = gross * 0.7;
    else if (gross <= 15000000) d = 3500000 + (gross - 5000000) * 0.4;
    else if (gross <= 45000000) d = 7500000 + (gross - 15000000) * 0.15;
    else if (gross <= 100000000) d = 12000000 + (gross - 45000000) * 0.05;
    else d = 14750000 + (gross - 100000000) * 0.02;
    return Math.min(d, 20000000);
  }

  /* 근로소득 세액공제 (총급여 구간별 한도) */
  function earnedIncomeTaxCredit(calcTax, gross) {
    var credit = calcTax <= 1300000
      ? calcTax * 0.55
      : 715000 + (calcTax - 1300000) * 0.30;
    var cap;
    if (gross <= 33000000) cap = 740000;
    else if (gross <= 70000000) cap = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    else if (gross <= 120000000) cap = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
    else cap = Math.max(200000, 500000 - (gross - 120000000) * 0.5);
    return Math.min(credit, cap);
  }

  function childCredit(n) {
    if (n <= 0) return 0;
    if (n === 1) return 150000;
    if (n === 2) return 350000;
    return 350000 + (n - 2) * 300000;
  }

  function progressiveTax(base) {
    if (base <= 0) return 0;
    for (var i = 0; i < BRACKETS.length; i++) {
      if (base <= BRACKETS[i][0]) return base * BRACKETS[i][1] - BRACKETS[i][2];
    }
    return 0;
  }

  function calc(o) {
    var monthlyGross = o.annual / 12;
    var payBase = Math.max(0, monthlyGross - o.nontax);          // 보수월액(비과세 제외)
    var pensionBase = Math.min(Math.max(payBase, o.pensionMin), o.pensionMax);

    var pension = pensionBase * o.rPension / 100;
    var health = payBase * o.rHealth / 100;
    var care = health * o.rCare / 100;
    var employ = payBase * o.rEmploy / 100;
    var insuranceYear = (pension + health + care + employ) * 12;

    var gross = Math.max(0, o.annual - o.nontax * 12);           // 총급여(비과세 제외)
    var incomeAmount = gross - earnedIncomeDeduction(gross);     // 근로소득금액
    var deductions = 1500000 * o.family + insuranceYear;         // 인적공제 + 보험료공제
    var taxBase = Math.max(0, incomeAmount - deductions);        // 과세표준
    var calcTax = progressiveTax(taxBase);
    var credit = earnedIncomeTaxCredit(calcTax, gross) + childCredit(o.children);
    var incomeTax = Math.max(0, calcTax - credit);               // 결정세액(연)
    var localTax = incomeTax * 0.1;

    var items = [
      { name: '국민연금', month: pension },
      { name: '건강보험', month: health },
      { name: '장기요양', month: care },
      { name: '고용보험', month: employ },
      { name: '소득세', month: incomeTax / 12 },
      { name: '지방소득세', month: localTax / 12 }
    ];
    var totalMonth = items.reduce(function (a, b) { return a + b.month; }, 0);

    return {
      items: items,
      monthlyGross: monthlyGross,
      insuranceMonth: pension + health + care + employ,
      taxMonth: (incomeTax + localTax) / 12,
      totalMonth: totalMonth,
      netMonth: monthlyGross - totalMonth,
      netYear: o.annual - totalMonth * 12,
      taxBase: taxBase, calcTax: calcTax, credit: credit
    };
  }

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
