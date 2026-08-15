/* 연봉 실수령액 계산 코어: 4대보험 + 근로소득세(연간 추정).
   salary.js(계산기)와 salary-table.js(구간별 표)가 같은 결과를 내도록 공용화. */
(function (global) {
  'use strict';

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

  /* 요율 기본값: salary.html · salary-table.html이 같은 값을 쓰도록 한 곳에 모아둔다.
     국민연금 상·하한은 2025년 7월 적용분(월 637만 / 40만). */
  var DEFAULT_RATES = {
    rPension: 4.5, rHealth: 3.545, rCare: 12.95, rEmploy: 0.9,
    pensionMax: 6370000, pensionMin: 400000
  };

  global.SalaryCore = {
    BRACKETS: BRACKETS,
    earnedIncomeDeduction: earnedIncomeDeduction,
    earnedIncomeTaxCredit: earnedIncomeTaxCredit,
    childCredit: childCredit,
    progressiveTax: progressiveTax,
    calc: calc,
    DEFAULT_RATES: DEFAULT_RATES
  };
})(window);
