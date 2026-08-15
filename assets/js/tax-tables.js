/* 세율·공제 기준표: 표가 주인공이고 JS는 구간 강조 + 간단 계산만 담당 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* 종합소득세 누진세율 (과세표준 상한, 세율, 누진공제) — 2025년 귀속 */
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
    toc: $('toc'),
    taxBase: $('taxBase'),
    incTax: $('incTax'), incTaxSub: $('incTaxSub'), incEff: $('incEff'),
    incRate: $('incRate'), incRateSub: $('incRateSub'), incLocal: $('incLocal'),
    tblIncome: $('tblIncome'),
    grossPay: $('grossPay'),
    eidAmt: $('eidAmt'), eidSub: $('eidSub'), eidIncome: $('eidIncome'), eidRate: $('eidRate'),
    tblEarned: $('tblEarned'),
    calcTax: $('calcTax'), creditGross: $('creditGross'),
    ctFinal: $('ctFinal'), ctFinalSub: $('ctFinalSub'), ctRaw: $('ctRaw'),
    ctCap: $('ctCap'), ctCapSub: $('ctCapSub'),
    tblCreditRate: $('tblCreditRate'), tblCreditCap: $('tblCreditCap')
  };

  /* ── 표 행 강조 ─────────────────────────────────────
     각 행의 data-upper(구간 상한)를 읽어 값이 속한 첫 행을 강조한다.
     data-upper가 없는 행은 마지막 구간(상한 없음)으로 본다. */
  function markRow(tr, on) {
    for (var j = 0; j < tr.cells.length; j++) {
      tr.cells[j].style.background = on ? 'var(--accent-soft)' : '';
    }
    if (on) tr.classList.add('year-mark');
    else tr.classList.remove('year-mark');
  }

  function highlight(table, value) {
    if (!table || !table.tBodies.length) return -1;
    var rows = table.tBodies[0].rows, hit = -1, i, up, upper;
    for (i = 0; i < rows.length; i++) {
      up = rows[i].getAttribute('data-upper');
      upper = (up === null || up === '') ? Infinity : parseFloat(up);
      if (hit < 0 && value <= upper) hit = i;
    }
    for (i = 0; i < rows.length; i++) markRow(rows[i], i === hit);
    return hit;
  }

  /* ── ① 종합소득세 ──────────────────────────────────── */
  function bracketOf(base) {
    for (var i = 0; i < BRACKETS.length; i++) {
      if (base <= BRACKETS[i][0]) return BRACKETS[i];
    }
    return BRACKETS[BRACKETS.length - 1];
  }

  function progressiveTax(base) {
    if (base <= 0) return 0;
    var b = bracketOf(base);
    return Math.max(0, base * b[1] - b[2]);
  }

  function renderIncome() {
    var base = Math.max(0, UI.parseNum(el.taxBase.value));
    highlight(el.tblIncome, base);

    if (!base) {
      el.incTax.textContent = el.incEff.textContent = el.incRate.textContent = el.incLocal.textContent = '–';
      el.incTaxSub.textContent = '과세표준을 입력하세요';
      el.incRateSub.textContent = '';
      return;
    }

    var b = bracketOf(base);
    var tax = progressiveTax(base);

    el.incTax.textContent = UI.korWon(tax);
    el.incTaxSub.textContent = UI.comma(base) + '원 × ' + UI.pct(b[1], 0) +
      (b[2] ? ' − ' + UI.korWon(b[2]) : '');
    el.incEff.textContent = UI.pct(tax / base, 2);
    el.incRate.textContent = UI.pct(b[1], 0);
    el.incRateSub.textContent = '누진공제 ' + (b[2] ? UI.korWon(b[2]) : '없음');
    el.incLocal.textContent = UI.korWon(tax * 1.1);
  }

  /* ── ② 근로소득공제 (한도 2,000만원) ───────────────── */
  /* 한도 적용 전 구간 계산값 */
  function earnedDeductionRaw(gross) {
    if (gross <= 5000000) return gross * 0.7;
    if (gross <= 15000000) return 3500000 + (gross - 5000000) * 0.4;
    if (gross <= 45000000) return 7500000 + (gross - 15000000) * 0.15;
    if (gross <= 100000000) return 12000000 + (gross - 45000000) * 0.05;
    return 14750000 + (gross - 100000000) * 0.02;
  }

  function renderEarned() {
    var gross = Math.max(0, UI.parseNum(el.grossPay.value));
    highlight(el.tblEarned, gross);

    if (!gross) {
      el.eidAmt.textContent = el.eidIncome.textContent = el.eidRate.textContent = '–';
      el.eidSub.textContent = '총급여를 입력하세요';
      return;
    }

    var raw = earnedDeductionRaw(gross);
    var ded = Math.min(raw, 20000000);

    el.eidAmt.textContent = UI.korWon(ded);
    el.eidSub.textContent = raw > ded
      ? '계산값 ' + UI.korWon(raw) + ' → 한도 2,000만원 적용'
      : '한도(2,000만원) 이내';
    el.eidIncome.textContent = UI.korWon(gross - ded);
    el.eidRate.textContent = UI.pct(ded / gross, 1);
  }

  /* ── ③ 근로소득 세액공제 ───────────────────────────── */
  function creditRaw(tax) {
    if (tax <= 0) return 0;
    return tax <= 1300000 ? tax * 0.55 : 715000 + (tax - 1300000) * 0.30;
  }

  function creditCap(gross) {
    if (gross <= 33000000) return 740000;
    if (gross <= 70000000) return Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    if (gross <= 120000000) return Math.max(500000, 660000 - (gross - 70000000) * 0.5);
    return Math.max(200000, 500000 - (gross - 120000000) * 0.5);
  }

  function renderCredit() {
    var tax = Math.max(0, UI.parseNum(el.calcTax.value));
    var gross = Math.max(0, UI.parseNum(el.creditGross.value));
    highlight(el.tblCreditRate, tax);
    highlight(el.tblCreditCap, gross);

    if (!tax) {
      el.ctFinal.textContent = el.ctRaw.textContent = el.ctCap.textContent = '–';
      el.ctFinalSub.textContent = '산출세액을 입력하세요';
      el.ctCapSub.textContent = '';
      return;
    }

    var raw = creditRaw(tax);
    var cap = creditCap(gross);
    var applied = Math.min(raw, cap);

    el.ctFinal.textContent = UI.korWon(applied);
    el.ctFinalSub.textContent = raw > cap ? '한도에 걸려 깎임' : '산출액 그대로 적용';
    el.ctRaw.textContent = UI.korWon(raw);
    el.ctCap.textContent = UI.korWon(cap);
    el.ctCapSub.textContent = '총급여 ' + UI.korWon(gross) + ' 기준';
  }

  /* ── 목차 이동 (sticky 헤더 높이만큼 보정) ─────────── */
  if (el.toc) {
    el.toc.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-go]') : null;
      if (!btn) return;
      var sec = document.getElementById(btn.getAttribute('data-go'));
      if (!sec) return;
      var top = sec.getBoundingClientRect().top + window.pageYOffset - 68;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  }

  /* ── 이벤트 연결 ───────────────────────────────────── */
  el.taxBase.addEventListener('input', renderIncome);
  el.grossPay.addEventListener('input', renderEarned);
  el.calcTax.addEventListener('input', renderCredit);
  el.creditGross.addEventListener('input', renderCredit);

  document.querySelectorAll('.chips button[data-base]').forEach(function (b) {
    b.addEventListener('click', function () {
      el.taxBase.value = b.getAttribute('data-base');
      renderIncome();
    });
  });
  document.querySelectorAll('.chips button[data-gross]').forEach(function (b) {
    b.addEventListener('click', function () {
      el.grossPay.value = b.getAttribute('data-gross');
      el.creditGross.value = b.getAttribute('data-gross');
      renderEarned();
      renderCredit();
    });
  });

  renderIncome();
  renderEarned();
  renderCredit();
})();
