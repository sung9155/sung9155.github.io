/* 대출 월 상환금 표: 금리 × 기간 매트릭스, 1억당 환산, 금리 1%p 충격, 상환방식 비교, DSR 한도 역산 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var YEARS = [10, 15, 20, 25, 30, 35, 40];   // 표의 기간(열)
  var RATE_MIN = 2, RATE_MAX = 8;             // 표의 금리(행) 범위 %
  var EOK = 100000000;
  var CHART_YEARS = 30;                       // 총이자 곡선은 30년 고정
  var METHOD_NAME = { equal: '원리금균등', principal: '원금균등', bullet: '만기일시' };

  var el = {
    amount: $('amount'), amountHelp: $('amountHelp'), amountChips: $('amountChips'),
    mxHint: $('mxHint'), mxHead: $('mxHead'), mxBody: $('mxBody'),
    cellInfo: $('cellInfo'), csvBtn: $('csvBtn'),
    selHint: $('selHint'), selPay: $('selPay'), selPaySub: $('selPaySub'),
    selInterest: $('selInterest'), selInterestSub: $('selInterestSub'),
    selTotal: $('selTotal'), selPerEok: $('selPerEok'),
    perHead: $('perHead'), perBody: $('perBody'),
    shockHint: $('shockHint'), shHead: $('shHead'), shBody: $('shBody'),
    cmpHint: $('cmpHint'), cmpBody: $('cmpBody'),
    dsrIncome: $('dsrIncome'), dsrIncomeHelp: $('dsrIncomeHelp'), dsrExisting: $('dsrExisting'),
    dsrRate: $('dsrRate'), dsrYears: $('dsrYears'), dsrSync: $('dsrSync'), dsrApply: $('dsrApply'),
    dsrRoom: $('dsrRoom'), dsrRoomSub: $('dsrRoomSub'), dsrMonthly: $('dsrMonthly'),
    dsrMax: $('dsrMax'), dsrMaxSub: $('dsrMaxSub'),
    chart: $('interestChart'), chartHint: $('chartHint')
  };

  var sel = { rate: 4.5, months: 360 };   // 매트릭스에서 선택한 조건
  var amount = 300000000;                 // 대출금액 입력값
  var dsrMaxAmount = 0;                   // DSR로 계산한 최대 대출금액

  var segStep = UI.segment($('rateStep'), function () { snapRate(); renderAll(); });
  var segDsr = UI.segment($('dsrLimit'), function () { renderDsr(); });

  /* ── 계산 ─────────────────────────────────────────────── */
  /* 원리금균등 월 납입금: pmt = P * r / (1 - (1+r)^-n). r = 0 예외 처리 */
  function pmtOf(principal, annualPct, n) {
    if (!(principal > 0) || !(n > 0)) return 0;
    var r = annualPct / 100 / 12;
    return r > 0 ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
  }

  function cellStats(principal, annualPct, n) {
    var pmt = pmtOf(principal, annualPct, n);
    var total = pmt * n;
    return { pmt: pmt, total: total, interest: total - principal };
  }

  /* 상환 스케줄. assets/js/loan.js 의 schedule() 과 같은 로직(거치·추가상환 없이 호출) */
  function schedule(o) {
    var r = o.annualPct / 100 / 12;
    var months = Math.max(1, Math.floor(o.months));
    var grace = Math.min(Math.max(0, Math.floor(o.grace || 0)), months - 1);
    var amortN = months - grace;
    var extra = Math.max(0, o.extra || 0);
    var bal = o.principal;
    var rows = [];
    var cumInterest = 0, totalPay = 0;

    var fixedPmt = 0, fixedPrincipal = 0;
    if (o.method === 'equal') {
      fixedPmt = r > 0 ? bal * r / (1 - Math.pow(1 + r, -amortN)) : bal / amortN;
    } else if (o.method === 'principal') {
      fixedPrincipal = bal / amortN;
    }

    for (var m = 1; m <= months && bal > 0.005; m++) {
      var interest = bal * r;
      var princ = 0;
      if (m > grace) {
        if (o.method === 'equal') princ = Math.max(0, fixedPmt - interest);
        else if (o.method === 'principal') princ = fixedPrincipal;
        else if (m === months) princ = bal;
      }
      princ += extra;
      if (princ > bal) princ = bal;
      /* 마지막 회차 잔액 정리 */
      if (m === months && princ < bal) princ = bal;

      var pay = princ + interest;
      bal -= princ;
      if (bal < 0.005) bal = 0;
      cumInterest += interest;
      totalPay += pay;
      rows.push({ m: m, pay: pay, princ: princ, interest: interest, cum: cumInterest, bal: bal });
    }

    var pays = rows.map(function (x) { return x.pay; });
    return {
      months: rows.length,
      totalInterest: cumInterest,
      totalPay: totalPay,
      firstPay: pays[0] || 0,
      lastPay: pays[pays.length - 1] || 0
    };
  }

  /* ── 금리 행 ──────────────────────────────────────────── */
  function stepVal() { return parseFloat(segStep.get()); }

  function rateList() {
    var step = stepVal();
    var out = [];
    for (var v = RATE_MIN; v <= RATE_MAX + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  /* 표의 행 라벨: 간격에 맞춰 소수 자리 고정 */
  function rateLbl(v) { return v.toFixed(stepVal() === 0.25 ? 2 : 1) + '%'; }

  /* 문장 안에서 쓰는 짧은 표기: 4.50 → 4.5, 4.00 → 4 */
  function rateShort(v) { return v.toFixed(2).replace(/\.?0+$/, ''); }

  function near(a, b) { return Math.abs(a - b) < 1e-9; }

  /* 간격을 바꾸면 선택 금리를 가장 가까운 행으로 옮긴다 */
  function snapRate() {
    var best = null;
    rateList().forEach(function (v) {
      if (best === null || Math.abs(v - sel.rate) < Math.abs(best - sel.rate)) best = v;
    });
    if (best !== null) sel.rate = best;
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  /* ── 렌더: 매트릭스 ───────────────────────────────────── */
  function headHtml() {
    return '<th>연 금리</th>' + YEARS.map(function (y) { return '<th>' + y + '년</th>'; }).join('');
  }

  function bodyHtml(principal, clickable) {
    return rateList().map(function (r) {
      var tds = YEARS.map(function (y) {
        var n = y * 12;
        var cls = clickable ? 'cell' : '';
        if (near(r, sel.rate) && n === sel.months) cls += ' sel';
        else if (near(r, sel.rate) || n === sel.months) cls += ' on-line';
        return '<td class="' + cls.trim() + '"' +
          (clickable ? ' data-r="' + r + '" data-m="' + n + '"' : '') +
          '>' + UI.comma(pmtOf(principal, r, n)) + '</td>';
      }).join('');
      var whole = Math.abs(r - Math.round(r)) < 1e-9;   // 정수 금리 행은 눈금처럼 강조
      return '<tr' + (whole ? ' class="year-mark"' : '') + '><td>' + rateLbl(r) + '</td>' + tds + '</tr>';
    }).join('');
  }

  function emptyRow(cols) {
    return '<tr><td colspan="' + cols + '" class="t-muted">대출 금액을 입력하세요.</td></tr>';
  }

  function renderMatrix() {
    el.mxHead.innerHTML = headHtml();
    el.perHead.innerHTML = headHtml();
    el.mxBody.innerHTML = amount > 0 ? bodyHtml(amount, true) : emptyRow(YEARS.length + 1);
    el.perBody.innerHTML = bodyHtml(EOK, false);
    el.mxHint.textContent = (amount > 0 ? UI.korWon(amount) : '금액 미입력') +
      ' · 원리금균등 월 납입금(원) · 금리 ' + RATE_MIN + '~' + RATE_MAX + '%';
  }

  /* ── 렌더: 선택한 조건 ───────────────────────────────── */
  function condText() {
    return '연 ' + rateShort(sel.rate) + '% · ' + (sel.months / 12) + '년(' + sel.months + '개월) · ' +
      (amount > 0 ? UI.korWon(amount) : '금액 미입력');
  }

  function renderSelected() {
    el.selHint.textContent = condText();
    el.cmpHint.textContent = condText();
    el.shockHint.textContent = '연 ' + rateShort(sel.rate) + '% → ' + rateShort(sel.rate + 1) + '%';

    if (amount <= 0) {
      ['selPay', 'selInterest', 'selTotal', 'selPerEok'].forEach(function (k) { el[k].textContent = '–'; });
      el.selPaySub.textContent = el.selInterestSub.textContent = '';
      return;
    }
    var s = cellStats(amount, sel.rate, sel.months);
    el.selPay.textContent = UI.won(s.pmt);
    el.selPaySub.textContent = '매달 같은 금액 · ' + UI.korWon(s.pmt);
    el.selInterest.textContent = UI.korWon(s.interest);
    el.selInterestSub.textContent = '원금 대비 ' + UI.pct(s.interest / amount);
    el.selTotal.textContent = UI.korWon(s.total);
    el.selPerEok.textContent = UI.won(pmtOf(EOK, sel.rate, sel.months));
  }

  function showCellInfo(rate, months) {
    if (amount <= 0) {
      el.cellInfo.textContent = '대출 금액을 입력하면 셀 값이 표시됩니다.';
      return;
    }
    var s = cellStats(amount, rate, months);
    el.cellInfo.innerHTML = '<b>연 ' + rateShort(rate) + '% · ' + (months / 12) + '년(' + months + '개월)</b>' +
      ' · 월 <b>' + UI.won(s.pmt) + '</b>' +
      ' · 총이자 <b>' + UI.korWon(s.interest) + '</b>' +
      ' · 총상환액 <b>' + UI.korWon(s.total) + '</b>' +
      ' · 원금 대비 이자 <b>' + UI.pct(s.interest / amount) + '</b>' +
      ' · 1억당 월 ' + UI.won(pmtOf(EOK, rate, months));
  }

  /* ── 렌더: 금리 1%p 상승 영향 ────────────────────────── */
  function renderShock() {
    var r0 = sel.rate, r1 = sel.rate + 1;
    el.shHead.innerHTML = '<th>기간</th><th>연 ' + rateShort(r0) + '%</th><th>연 ' + rateShort(r1) + '%</th>' +
      '<th>월 증가액</th><th>증가율</th><th>총이자 증가</th>';
    if (amount <= 0) { el.shBody.innerHTML = emptyRow(6); return; }

    el.shBody.innerHTML = YEARS.map(function (y) {
      var n = y * 12;
      var a = cellStats(amount, r0, n), b = cellStats(amount, r1, n);
      var on = n === sel.months;
      return '<tr' + (on ? ' class="year-mark"' : '') + '>' +
        '<td>' + y + '년' + (on ? ' <span class="badge r5">선택</span>' : '') + '</td>' +
        '<td>' + UI.comma(a.pmt) + '</td>' +
        '<td>' + UI.comma(b.pmt) + '</td>' +
        '<td>+' + UI.comma(b.pmt - a.pmt) + '</td>' +
        '<td>+' + UI.pct(a.pmt > 0 ? b.pmt / a.pmt - 1 : 0) + '</td>' +
        '<td>+' + UI.korWon(b.interest - a.interest) + '</td></tr>';
    }).join('');
  }

  /* ── 렌더: 상환방식 비교 ─────────────────────────────── */
  function renderCompare() {
    if (amount <= 0) { el.cmpBody.innerHTML = emptyRow(6); return; }
    var base = { principal: amount, annualPct: sel.rate, months: sel.months, grace: 0, extra: 0 };
    el.cmpBody.innerHTML = ['equal', 'principal', 'bullet'].map(function (m) {
      var r = schedule(Object.assign({}, base, { method: m }));
      var on = m === 'equal';
      return '<tr' + (on ? ' class="year-mark"' : '') + '>' +
        '<td>' + METHOD_NAME[m] + (on ? ' <span class="badge r5">표 기준</span>' : '') + '</td>' +
        '<td>' + UI.comma(r.firstPay) + '</td>' +
        '<td>' + UI.comma(r.lastPay) + '</td>' +
        '<td>' + UI.korWon(r.totalInterest) + '</td>' +
        '<td>' + UI.korWon(r.totalPay) + '</td>' +
        '<td>' + UI.pct(r.totalPay > 0 ? r.totalInterest / r.totalPay : 0) + '</td></tr>';
    }).join('');
  }

  /* ── 렌더: DSR 한도 ──────────────────────────────────── */
  function renderDsr() {
    var income = Math.max(0, UI.parseNum(el.dsrIncome.value));
    var existing = Math.max(0, UI.parseNum(el.dsrExisting.value));
    var limit = parseFloat(segDsr.get()) / 100;
    var rate = Math.max(0, UI.parseNum(el.dsrRate.value));
    var years = Math.max(1, Math.floor(UI.parseNum(el.dsrYears.value) || 1));
    var n = years * 12;
    var r = rate / 100 / 12;

    el.dsrIncomeHelp.textContent = income ? UI.korWon(income) : '연소득을 입력하세요';

    var room = Math.max(0, income * limit - existing);
    var monthly = room / 12;
    /* 원리금균등 역산: P = pmt × (1 − (1+r)^-n) / r */
    var maxP = r > 0 ? monthly * (1 - Math.pow(1 + r, -n)) / r : monthly * n;
    dsrMaxAmount = maxP;

    el.dsrRoom.textContent = UI.korWon(room);
    el.dsrRoomSub.textContent = '연소득의 ' + UI.pct(limit, 0) +
      (existing > 0 ? ' − 기존 ' + UI.korWon(existing) : '');
    el.dsrMonthly.textContent = UI.won(monthly);
    el.dsrMax.textContent = UI.korWon(maxP);
    el.dsrMaxSub.textContent = '연 ' + rateShort(rate) + '% · ' + years + '년 원리금균등 기준';
    el.dsrApply.disabled = !(maxP > 0);
  }

  /* ── 렌더: 금리별 총이자 곡선 (기간 30년 고정) ───────── */
  function renderChart() {
    el.chartHint.textContent = '기간 ' + CHART_YEARS + '년 고정 · ' +
      (amount > 0 ? UI.korWon(amount) : '금액 미입력');
    if (amount <= 0) { Chart.empty(el.chart, { emptyText: '대출 금액을 입력하세요' }); return; }

    var n = CHART_YEARS * 12;
    var xs = [], interests = [], pays = [];
    for (var v = RATE_MIN; v <= RATE_MAX + 1e-9; v += 0.25) {
      var rr = Math.round(v * 100) / 100;
      var s = cellStats(amount, rr, n);
      xs.push(rr); interests.push(s.interest); pays.push(s.pmt);
    }
    var color = css('--s2');

    Chart.line(el.chart, {
      height: 250,
      x: xs,
      xFmt: function (val) { return rateShort(val) + '%'; },
      xLabel: '연 금리',
      yFmt: Chart.fmtShort,
      fill: true,
      endLabels: false,
      series: [{ name: '총이자', color: color, values: interests }],
      tip: function (i) {
        return '<div class="tt">연 ' + rateShort(xs[i]) + '% · ' + CHART_YEARS + '년</div>' +
          '<div class="tr"><span class="sw" style="background:' + color + '"></span><span class="tn">총이자</span>' +
          '<span class="tv">' + UI.korWon(interests[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">월 납입금</span><span class="tv">' + UI.won(pays[i]) + '</span></div>';
      }
    });
  }

  function renderAll() {
    amount = Math.max(0, UI.parseNum(el.amount.value));
    el.amountHelp.textContent = amount ? UI.korWon(amount) : '금액을 입력하세요';
    renderMatrix();
    renderSelected();
    showCellInfo(sel.rate, sel.months);
    renderShock();
    renderCompare();
    renderChart();
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  el.amount.addEventListener('input', renderAll);

  el.amountChips.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      el.amount.value = b.dataset.set;
      renderAll();
    });
  });

  function cellOf(ev) {
    var t = ev.target;
    return t && t.closest ? t.closest('td.cell') : null;
  }

  el.mxBody.addEventListener('mouseover', function (ev) {
    var td = cellOf(ev);
    if (td) showCellInfo(parseFloat(td.dataset.r), parseInt(td.dataset.m, 10));
  });
  el.mxBody.addEventListener('mouseleave', function () { showCellInfo(sel.rate, sel.months); });
  el.mxBody.addEventListener('click', function (ev) {
    var td = cellOf(ev);
    if (!td) return;
    sel.rate = parseFloat(td.dataset.r);
    sel.months = parseInt(td.dataset.m, 10);
    renderAll();
  });

  el.csvBtn.addEventListener('click', function () {
    if (amount <= 0) return;
    var rows = [['연 금리(%)'].concat(YEARS.map(function (y) { return y + '년'; }))];
    rateList().forEach(function (r) {
      rows.push([rateShort(r)].concat(YEARS.map(function (y) {
        return Math.round(pmtOf(amount, r, y * 12));
      })));
    });
    UI.downloadCsv('loan_matrix_' + Math.round(amount / 10000) + 'man.csv', rows);
  });

  ['dsrIncome', 'dsrExisting', 'dsrRate', 'dsrYears'].forEach(function (k) {
    el[k].addEventListener('input', renderDsr);
  });

  el.dsrSync.addEventListener('click', function () {
    el.dsrRate.value = rateShort(sel.rate);
    el.dsrYears.value = sel.months / 12;
    renderDsr();
  });

  el.dsrApply.addEventListener('click', function () {
    if (!(dsrMaxAmount > 0)) return;
    el.amount.value = Math.round(dsrMaxAmount / 10000) * 10000;   // 만원 단위 반올림
    renderAll();
  });

  document.addEventListener('themechange', renderChart);

  renderAll();
  renderDsr();
})();
