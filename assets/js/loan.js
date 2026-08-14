/* 대출 상환 시뮬레이터: 원리금균등 / 원금균등 / 만기일시 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var METHOD_NAME = { equal: '원리금균등', principal: '원금균등', bullet: '만기일시' };
  var METHOD_DESC = {
    equal: '매달 같은 금액(원금+이자)을 납부합니다. 초반에는 이자 비중이 큽니다.',
    principal: '원금을 균등하게 나눠 갚습니다. 첫 달이 가장 무겁고 갈수록 가벼워집니다.',
    bullet: '매달 이자만 내고 만기에 원금 전액을 한 번에 갚습니다.'
  };

  var el = {
    amount: $('amount'), amountHelp: $('amountHelp'),
    rate: $('rate'), rateRange: $('rateRange'),
    months: $('months'), monthsHelp: $('monthsHelp'),
    grace: $('grace'), extra: $('extra'),
    methodHelp: $('methodHelp'), summaryHint: $('summaryHint'),
    firstPay: $('firstPay'), firstPaySub: $('firstPaySub'),
    totalInterest: $('totalInterest'), interestRatio: $('interestRatio'),
    totalPay: $('totalPay'), payoff: $('payoff'), payoffSub: $('payoffSub'),
    payChart: $('payChart'), balChart: $('balChart'),
    cmpBody: document.querySelector('#cmpTable tbody'),
    schedBody: document.querySelector('#schedTable tbody'),
    rowsHint: $('rowsHint'), csvBtn: $('csvBtn')
  };

  var segMethod = UI.segment($('method'), function (v) {
    el.methodHelp.textContent = METHOD_DESC[v];
    render();
  });
  var segView = UI.segment($('tableView'), function () { renderTable(); });

  var current = null;   // 마지막 계산 결과

  /* ── 계산 ─────────────────────────────────────────────── */
  function schedule(o) {
    var r = o.annualPct / 100 / 12;
    var months = Math.max(1, Math.floor(o.months));
    var grace = Math.min(Math.max(0, Math.floor(o.grace)), months - 1);
    var amortN = months - grace;
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
      princ += o.extra;
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
      rows: rows,
      months: rows.length,
      plannedMonths: months,
      grace: grace,
      principal: o.principal,
      totalInterest: cumInterest,
      totalPay: totalPay,
      firstPay: pays[0] || 0,
      lastPay: pays[pays.length - 1] || 0,
      maxPay: pays.length ? Math.max.apply(null, pays) : 0,
      minPay: pays.length ? Math.min.apply(null, pays) : 0,
      method: o.method
    };
  }

  function readInput() {
    return {
      principal: Math.max(0, UI.parseNum(el.amount.value)),
      annualPct: Math.max(0, UI.parseNum(el.rate.value)),
      months: Math.max(1, Math.floor(UI.parseNum(el.months.value) || 1)),
      grace: Math.max(0, Math.floor(UI.parseNum(el.grace.value))),
      extra: Math.max(0, UI.parseNum(el.extra.value)),
      method: segMethod.get()
    };
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  /* ── 렌더 ─────────────────────────────────────────────── */
  function render() {
    var inp = readInput();
    el.amountHelp.textContent = inp.principal ? UI.korWon(inp.principal) : '금액을 입력하세요';
    el.monthsHelp.textContent = (inp.months / 12).toFixed(inp.months % 12 ? 1 : 0) + '년' +
      (inp.grace ? ' · 거치 ' + inp.grace + '개월' : '');

    if (!inp.principal) {
      current = null;
      ['firstPay', 'totalInterest', 'totalPay', 'payoff'].forEach(function (k) { el[k].textContent = '–'; });
      el.firstPaySub.textContent = el.interestRatio.textContent = el.payoffSub.textContent = '';
      el.summaryHint.textContent = '';
      Chart.empty(el.payChart, { emptyText: '대출 금액을 입력하세요' });
      Chart.empty(el.balChart, { emptyText: '대출 금액을 입력하세요' });
      el.cmpBody.innerHTML = '';
      el.schedBody.innerHTML = '<tr><td colspan="6" class="t-muted">대출 금액을 입력하세요.</td></tr>';
      el.rowsHint.textContent = '';
      return;
    }

    var res = schedule(inp);
    current = res;

    el.summaryHint.textContent = METHOD_NAME[inp.method] + ' · 연 ' + inp.annualPct + '% · ' +
      inp.months + '개월' + (inp.extra ? ' · 매월 추가 ' + UI.korWon(inp.extra) : '');

    el.firstPay.textContent = UI.korWon(res.firstPay);
    el.firstPaySub.textContent = Math.round(res.minPay) === Math.round(res.maxPay)
      ? '매달 동일'
      : '최대 ' + UI.korWon(res.maxPay) + ' · 최소 ' + UI.korWon(res.minPay);
    el.totalInterest.textContent = UI.korWon(res.totalInterest);
    el.interestRatio.textContent = '원금 대비 ' + UI.pct(res.totalInterest / res.principal);
    el.totalPay.textContent = UI.korWon(res.totalPay);
    el.payoff.textContent = res.months + '개월';
    el.payoffSub.textContent = (res.months / 12).toFixed(1) + '년' +
      (res.months < res.plannedMonths ? ' · ' + (res.plannedMonths - res.months) + '개월 단축' : '');

    renderCharts(res);
    renderCompare(inp);
    renderTable();
  }

  function renderCharts(res) {
    var s1 = css('--s1'), s2 = css('--s2');
    var rows = res.rows;
    var yearly = rows.length > 180;

    var x = [], princV = [], intV = [];
    if (yearly) {
      for (var i = 0; i < rows.length; i += 12) {
        var p = 0, it = 0;
        for (var j = i; j < Math.min(i + 12, rows.length); j++) { p += rows[j].princ; it += rows[j].interest; }
        x.push(Math.floor(i / 12) + 1);
        princV.push(p); intV.push(it);
      }
    } else {
      rows.forEach(function (r) { x.push(r.m); princV.push(r.princ); intV.push(r.interest); });
    }

    Chart.stackedBar(el.payChart, {
      height: 250,
      x: x,
      xFmt: function (v) { return v + (yearly ? '년' : '회'); },
      xLabel: yearly ? '연차 (연 합계)' : '회차 (월)',
      yFmt: Chart.fmtShort,
      series: [
        { name: '원금', color: s1, values: princV },
        { name: '이자', color: s2, values: intV }
      ],
      tip: function (i) {
        var tot = princV[i] + intV[i];
        return '<div class="tt">' + x[i] + (yearly ? '년차' : '회차') + '</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">원금</span>' +
          '<span class="tv">' + UI.korWon(princV[i]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">이자</span>' +
          '<span class="tv">' + UI.korWon(intV[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">합계</span><span class="tv">' + UI.korWon(tot) + '</span></div>';
      }
    });

    var bx = [0], bv = [res.principal];
    rows.forEach(function (r) { bx.push(r.m); bv.push(r.bal); });
    Chart.line(el.balChart, {
      height: 240,
      x: bx,
      xFmt: function (v) { return v + '회'; },
      xLabel: '회차 (월)',
      yFmt: Chart.fmtShort,
      fill: true,
      endLabels: false,
      series: [{ name: '잔금', color: s1, values: bv }],
      tip: function (i) {
        var paid = res.principal - bv[i];
        return '<div class="tt">' + bx[i] + '회차 (' + (bx[i] / 12).toFixed(1) + '년)</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">잔금</span>' +
          '<span class="tv">' + UI.korWon(bv[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">갚은 원금</span><span class="tv">' + UI.korWon(paid) + '</span></div>' +
          '<div class="tr"><span class="tn">상환율</span><span class="tv">' + UI.pct(paid / res.principal) + '</span></div>';
      }
    });
  }

  function renderCompare(inp) {
    var cur = inp.method;
    var html = ['equal', 'principal', 'bullet'].map(function (mth) {
      var r = schedule(Object.assign({}, inp, { method: mth }));
      var on = mth === cur;
      return '<tr' + (on ? ' class="year-mark"' : '') + '>' +
        '<td>' + METHOD_NAME[mth] + (on ? ' <span class="badge r5">선택</span>' : '') + '</td>' +
        '<td>' + UI.korWon(r.firstPay) + '</td>' +
        '<td>' + UI.korWon(r.lastPay) + '</td>' +
        '<td>' + UI.korWon(r.totalInterest) + '</td>' +
        '<td>' + UI.korWon(r.totalPay) + '</td>' +
        '<td>' + UI.pct(r.totalInterest / r.totalPay) + '</td></tr>';
    }).join('');
    el.cmpBody.innerHTML = html;
  }

  function renderTable() {
    if (!current) return;
    var rows = current.rows;
    var byYear = segView.get() === 'year';
    var out = [];

    if (byYear) {
      for (var i = 0; i < rows.length; i += 12) {
        var end = Math.min(i + 12, rows.length);
        var pay = 0, pr = 0, it = 0;
        for (var j = i; j < end; j++) { pay += rows[j].pay; pr += rows[j].princ; it += rows[j].interest; }
        var last = rows[end - 1];
        out.push('<tr class="year-mark"><td>' + (Math.floor(i / 12) + 1) + '년차 <span class="t-muted">(' +
          (i + 1) + '~' + end + '회)</span></td>' +
          '<td>' + UI.comma(pay) + '</td><td>' + UI.comma(pr) + '</td><td>' + UI.comma(it) + '</td>' +
          '<td>' + UI.comma(last.cum) + '</td><td>' + UI.comma(last.bal) + '</td></tr>');
      }
      el.rowsHint.textContent = Math.ceil(rows.length / 12) + '년 · 연 합계';
    } else {
      for (var k = 0; k < rows.length; k++) {
        var r = rows[k];
        out.push('<tr' + (r.m % 12 === 0 ? ' class="year-mark"' : '') + '><td>' + r.m + '회' +
          (r.m % 12 === 0 ? ' <span class="t-muted">(' + (r.m / 12) + '년)</span>' : '') + '</td>' +
          '<td>' + UI.comma(r.pay) + '</td><td>' + UI.comma(r.princ) + '</td><td>' + UI.comma(r.interest) + '</td>' +
          '<td>' + UI.comma(r.cum) + '</td><td>' + UI.comma(r.bal) + '</td></tr>');
      }
      el.rowsHint.textContent = rows.length + '회차 · 단위: 원';
    }
    el.schedBody.innerHTML = out.join('');
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  ['amount', 'rate', 'months', 'grace', 'extra'].forEach(function (k) {
    el[k].addEventListener('input', function () {
      if (k === 'rate') el.rateRange.value = el.rate.value;
      render();
    });
  });
  el.rateRange.addEventListener('input', function () {
    el.rate.value = el.rateRange.value;
    render();
  });

  document.querySelectorAll('.chips button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.add) el.amount.value = UI.parseNum(el.amount.value) + (+b.dataset.add);
      else if (b.dataset.set !== undefined) el.amount.value = +b.dataset.set;
      else if (b.dataset.months) el.months.value = b.dataset.months;
      render();
    });
  });

  el.csvBtn.addEventListener('click', function () {
    if (!current) return;
    var rows = [['회차', '납입금', '원금', '이자', '누적이자', '잔금']];
    current.rows.forEach(function (r) {
      rows.push([r.m, Math.round(r.pay), Math.round(r.princ), Math.round(r.interest),
        Math.round(r.cum), Math.round(r.bal)]);
    });
    UI.downloadCsv('loan_' + METHOD_NAME[current.method] + '_' + current.months + 'M.csv', rows);
  });

  document.addEventListener('themechange', function () { if (current) renderCharts(current); });

  el.methodHelp.textContent = METHOD_DESC[segMethod.get()];
  render();
})();
