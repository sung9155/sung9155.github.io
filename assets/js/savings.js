/* 적금·예금 계산기: 월복리 / 단리, 이자소득세, 목표 금액 도달 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var METHOD_NAME = { compound: '월복리', simple: '단리' };
  var METHOD_DESC = {
    compound: '매월 붙은 이자가 원금에 더해져 다음 달 이자를 다시 낳습니다.',
    simple: '이자는 따로 쌓이고 원금에는 더해지지 않습니다(대부분의 적금 방식).'
  };

  var el = {
    monthly: $('monthly'), initial: $('initial'), initialHelp: $('initialHelp'),
    rate: $('rate'), rateRange: $('rateRange'), months: $('months'),
    raise: $('raise'), target: $('target'),
    methodHelp: $('methodHelp'), sumHint: $('sumHint'),
    netTotal: $('netTotal'), netSub: $('netSub'),
    principal: $('principal'), principalSub: $('principalSub'),
    interest: $('interest'), taxSub: $('taxSub'), yieldEl: $('yield'),
    targetNote: $('targetNote'), growChart: $('growChart'),
    cmpBody: document.querySelector('#cmpTable tbody'),
    schedBody: document.querySelector('#schedTable tbody'),
    rowsHint: $('rowsHint'), csvBtn: $('csvBtn')
  };

  var segMethod = UI.segment($('method'), function (v) {
    el.methodHelp.textContent = METHOD_DESC[v];
    render();
  });
  var segTax = UI.segment($('tax'), render);
  var segView = UI.segment($('tableView'), function () { renderTable(); });

  var current = null;

  /* ── 계산 ─────────────────────────────────────────────── */
  function build(o) {
    var r = o.annualPct / 100 / 12;
    var months = Math.max(1, Math.floor(o.months));
    var rows = [];
    var bal = o.initial;          // 복리 평가액
    var principalSum = o.initial; // 누적 원금
    var interestSum = 0;          // 단리 누적 이자

    for (var m = 1; m <= months; m++) {
      var deposit = o.monthly * Math.pow(1 + o.raisePct / 100, Math.floor((m - 1) / 12));
      var gain;
      if (o.method === 'compound') {
        bal += deposit;
        principalSum += deposit;
        gain = bal * r;
        bal += gain;
        interestSum += gain;
      } else {
        principalSum += deposit;
        gain = principalSum * r;   // 원금에만 이자
        interestSum += gain;
        bal = principalSum + interestSum;
      }
      rows.push({
        m: m, deposit: deposit, principal: principalSum,
        interest: interestSum, bal: bal
      });
    }

    var tax = interestSum * o.taxPct / 100;
    var net = principalSum + interestSum - tax;
    var years = months / 12;
    var yieldPct = principalSum > 0 && years > 0
      ? Math.pow(net / principalSum, 1 / years) - 1 : 0;

    return {
      rows: rows, months: months, principal: principalSum,
      interest: interestSum, tax: tax, net: net, yieldPct: yieldPct,
      method: o.method, taxPct: o.taxPct
    };
  }

  function readInput() {
    return {
      monthly: Math.max(0, UI.parseNum(el.monthly.value)),
      initial: Math.max(0, UI.parseNum(el.initial.value)),
      annualPct: Math.max(0, UI.parseNum(el.rate.value)),
      months: Math.max(1, Math.floor(UI.parseNum(el.months.value) || 1)),
      raisePct: Math.max(0, UI.parseNum(el.raise.value)),
      taxPct: +segTax.get(),
      method: segMethod.get()
    };
  }

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  /* ── 렌더 ─────────────────────────────────────────────── */
  function render() {
    var inp = readInput();
    el.initialHelp.textContent = inp.initial ? UI.korWon(inp.initial) : '없으면 0';

    if (!inp.monthly && !inp.initial) {
      current = null;
      ['netTotal', 'principal', 'interest', 'yieldEl'].forEach(function (k) { el[k].textContent = '–'; });
      el.netSub.textContent = el.principalSub.textContent = el.taxSub.textContent = '';
      el.sumHint.textContent = '';
      el.targetNote.hidden = true;
      Chart.empty(el.growChart, { emptyText: '월 적립액이나 초기 예치금을 입력하세요' });
      el.cmpBody.innerHTML = '';
      el.schedBody.innerHTML = '<tr><td colspan="5" class="t-muted">금액을 입력하세요.</td></tr>';
      return;
    }

    var res = build(inp);
    current = res;

    el.sumHint.textContent = METHOD_NAME[inp.method] + ' · 연 ' + inp.annualPct + '% · ' +
      inp.months + '개월' + (inp.raisePct ? ' · 매년 +' + inp.raisePct + '%' : '');
    el.netTotal.textContent = UI.korWon(res.net);
    el.netSub.textContent = '원금 대비 +' + UI.korWon(res.net - res.principal);
    el.principal.textContent = UI.korWon(res.principal);
    el.principalSub.textContent = inp.monthly
      ? '월 ' + UI.korWon(inp.monthly) + ' × ' + res.months + '회' + (inp.initial ? ' + 예치금' : '')
      : '초기 예치금';
    el.interest.textContent = UI.korWon(res.interest);
    el.taxSub.textContent = '세금 ' + UI.korWon(res.tax) + ' (' + res.taxPct + '%)';
    el.yieldEl.textContent = UI.pct(res.yieldPct, 2);

    /* 목표 금액 */
    var target = Math.max(0, UI.parseNum(el.target.value));
    if (target > 0) {
      var hit = null;
      for (var i = 0; i < res.rows.length; i++) {
        if (res.rows[i].bal >= target) { hit = res.rows[i]; break; }
      }
      el.targetNote.hidden = false;
      el.targetNote.innerHTML = hit
        ? '목표 ' + UI.korWon(target) + ' 도달: <b>' + hit.m + '개월째</b> (' +
          (hit.m / 12).toFixed(1) + '년) · 그때 평가액 ' + UI.korWon(hit.bal)
        : '목표 ' + UI.korWon(target) + '에는 이 기간 안에 도달하지 못합니다. 만기 평가액 ' +
          UI.korWon(res.rows[res.rows.length - 1].bal) + '.';
    } else {
      el.targetNote.hidden = true;
    }

    renderChart(res);
    renderCompare(inp);
    renderTable();
  }

  function renderChart(res) {
    var s1 = css('--s1'), s2 = css('--s2');
    var x = [0], p = [res.rows.length ? res.rows[0].principal - res.rows[0].deposit : 0], b = [p[0]];
    res.rows.forEach(function (r) { x.push(r.m); p.push(r.principal); b.push(r.bal); });

    Chart.line(el.growChart, {
      height: 260,
      x: x,
      xFmt: function (v) { return v + '회'; },
      xLabel: '회차 (월)',
      yFmt: Chart.fmtShort,
      fill: true,
      series: [
        { name: '평가액', color: s1, values: b },
        { name: '납입 원금', color: s2, values: p }
      ],
      tip: function (i) {
        return '<div class="tt">' + x[i] + '회차 (' + (x[i] / 12).toFixed(1) + '년)</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">평가액</span>' +
          '<span class="tv">' + UI.korWon(b[i]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">원금</span>' +
          '<span class="tv">' + UI.korWon(p[i]) + '</span></div>' +
          '<div class="tr"><span class="tn">이자</span><span class="tv">' + UI.korWon(b[i] - p[i]) + '</span></div>';
      }
    });
  }

  function renderCompare(inp) {
    el.cmpBody.innerHTML = ['compound', 'simple'].map(function (mth) {
      var r = build(Object.assign({}, inp, { method: mth }));
      var on = mth === inp.method;
      return '<tr' + (on ? ' class="year-mark"' : '') + '>' +
        '<td>' + METHOD_NAME[mth] + (on ? ' <span class="badge r5">선택</span>' : '') + '</td>' +
        '<td>' + UI.korWon(r.interest) + '</td>' +
        '<td>' + UI.korWon(r.tax) + '</td>' +
        '<td>' + UI.korWon(r.net) + '</td>' +
        '<td>' + UI.pct((r.net - r.principal) / r.principal, 2) + '</td></tr>';
    }).join('');
  }

  function renderTable() {
    if (!current) return;
    var rows = current.rows, out = [];
    if (segView.get() === 'year') {
      for (var i = 0; i < rows.length; i += 12) {
        var end = Math.min(i + 12, rows.length), dep = 0;
        for (var j = i; j < end; j++) dep += rows[j].deposit;
        var last = rows[end - 1];
        out.push('<tr class="year-mark"><td>' + (Math.floor(i / 12) + 1) + '년차 <span class="t-muted">(' +
          (i + 1) + '~' + end + '회)</span></td><td>' + UI.comma(dep) + '</td><td>' +
          UI.comma(last.principal) + '</td><td>' + UI.comma(last.interest) + '</td><td>' +
          UI.comma(last.bal) + '</td></tr>');
      }
      el.rowsHint.textContent = Math.ceil(rows.length / 12) + '년 · 단위: 원';
    } else {
      rows.forEach(function (r) {
        out.push('<tr' + (r.m % 12 === 0 ? ' class="year-mark"' : '') + '><td>' + r.m + '회' +
          (r.m % 12 === 0 ? ' <span class="t-muted">(' + (r.m / 12) + '년)</span>' : '') + '</td>' +
          '<td>' + UI.comma(r.deposit) + '</td><td>' + UI.comma(r.principal) + '</td>' +
          '<td>' + UI.comma(r.interest) + '</td><td>' + UI.comma(r.bal) + '</td></tr>');
      });
      el.rowsHint.textContent = rows.length + '회차 · 단위: 원';
    }
    el.schedBody.innerHTML = out.join('');
  }

  /* ── 이벤트 ───────────────────────────────────────────── */
  ['monthly', 'initial', 'rate', 'months', 'raise', 'target'].forEach(function (k) {
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
      if (b.dataset.m !== undefined) el.monthly.value = +b.dataset.m;
      else if (b.dataset.months) el.months.value = b.dataset.months;
      render();
    });
  });
  el.csvBtn.addEventListener('click', function () {
    if (!current) return;
    var rows = [['회차', '납입액', '누적원금', '누적이자', '평가액']];
    current.rows.forEach(function (r) {
      rows.push([r.m, Math.round(r.deposit), Math.round(r.principal),
        Math.round(r.interest), Math.round(r.bal)]);
    });
    UI.downloadCsv('savings_' + METHOD_NAME[current.method] + '_' + current.months + 'M.csv', rows);
  });
  document.addEventListener('themechange', function () { if (current) renderChart(current); });

  el.methodHelp.textContent = METHOD_DESC[segMethod.get()];
  render();
})();
