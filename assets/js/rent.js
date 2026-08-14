/* 전세 vs 월세: 대출이자 + 자기자본 기회비용 + 월세(세액공제 반영) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    jd: $('jeonseDeposit'), jdHelp: $('jdHelp'), jl: $('jeonseLoan'), jr: $('jeonseRate'),
    rd: $('rentDeposit'), rm: $('rentMonthly'), rl: $('rentLoan'), rr: $('rentRate'),
    opp: $('opp'), oppRange: $('oppRange'), months: $('months'),
    sumHint: $('sumHint'), winner: $('winner'), winnerSub: $('winnerSub'),
    jeonseCost: $('jeonseCost'), jeonseSub: $('jeonseSub'),
    rentCost: $('rentCost'), rentSub: $('rentSub'),
    gap: $('gap'), gapSub: $('gapSub'), convNote: $('convNote'),
    mixChart: $('mixChart'), cumChart: $('cumChart'),
    detailBody: document.querySelector('#detailTable tbody')
  };

  var segCredit = UI.segment($('taxCredit'), render);

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  function readInput() {
    var g = function (n) { return Math.max(0, UI.parseNum(n.value)); };
    return {
      jd: g(el.jd), jl: g(el.jl), jr: g(el.jr),
      rd: g(el.rd), rm: g(el.rm), rl: g(el.rl), rr: g(el.rr),
      opp: g(el.opp), months: Math.max(1, Math.floor(UI.parseNum(el.months.value) || 1)),
      credit: +segCredit.get()
    };
  }

  function calc(i) {
    var jLoan = Math.min(i.jl, i.jd);
    var rLoan = Math.min(i.rl, i.rd);
    var jOwn = i.jd - jLoan;              // 전세에 묶인 자기자본
    var rOwn = i.rd - rLoan;              // 월세 보증금에 묶인 자기자본

    var jInterest = jLoan * i.jr / 100 / 12;
    var jOpp = jOwn * i.opp / 100 / 12;
    var rInterest = rLoan * i.rr / 100 / 12;
    var rOpp = rOwn * i.opp / 100 / 12;

    /* 월세 세액공제: 연 월세액 1,000만원 한도 × 공제율 → 월 환산 */
    var creditMonth = i.credit > 0
      ? Math.min(i.rm * 12, 10000000) * i.credit / 100 / 12 : 0;

    var jTotal = jInterest + jOpp;
    var rTotal = i.rm + rInterest + rOpp - creditMonth;

    /* 전월세 전환율: 월세 ÷ (전세보증금 - 월세보증금) */
    var convBase = i.jd - i.rd;
    var convRate = convBase > 0 ? i.rm * 12 / convBase * 100 : null;

    return {
      jInterest: jInterest, jOpp: jOpp, jTotal: jTotal, jOwn: jOwn, jLoan: jLoan,
      rInterest: rInterest, rOpp: rOpp, rRent: i.rm, rCredit: creditMonth,
      rTotal: rTotal, rOwn: rOwn, rLoan: rLoan,
      diff: rTotal - jTotal, convRate: convRate
    };
  }

  var current = null, currentInput = null;

  function render() {
    var i = readInput();
    currentInput = i;
    el.jdHelp.textContent = i.jd ? UI.korWon(i.jd) : '';

    var r = calc(i);
    current = r;

    el.sumHint.textContent = '기회비용 연 ' + i.opp + '% · ' + i.months + '개월 비교';

    var jWins = r.jTotal <= r.rTotal;
    el.winner.textContent = jWins ? '전세' : '월세';
    el.winnerSub.textContent = '월 ' + UI.korWon(Math.abs(r.diff)) + ' 더 저렴';
    el.jeonseCost.textContent = UI.korWon(r.jTotal);
    el.jeonseSub.textContent = '이자 ' + UI.korWon(r.jInterest) + ' + 기회비용 ' + UI.korWon(r.jOpp);
    el.rentCost.textContent = UI.korWon(r.rTotal);
    el.rentSub.textContent = '월세 ' + UI.korWon(r.rRent) +
      (r.rCredit ? ' − 공제 ' + UI.korWon(r.rCredit) : '') +
      (r.rInterest + r.rOpp ? ' + ' + UI.korWon(r.rInterest + r.rOpp) : '');
    el.gap.textContent = UI.korWon(Math.abs(r.diff) * i.months);
    el.gapSub.textContent = i.months + '개월 누적 · ' + (jWins ? '전세' : '월세') + ' 절약';

    el.convNote.innerHTML = r.convRate === null
      ? '전세 보증금이 월세 보증금보다 커야 전월세 전환율을 계산할 수 있습니다.'
      : '전월세 전환율 <b>연 ' + r.convRate.toFixed(2) + '%</b> ' +
        '(보증금 차액 ' + UI.korWon(i.jd - i.rd) + '에 대해 월세 ' + UI.korWon(i.rm) + '). ' +
        '이 값이 기회비용 수익률(' + i.opp + '%)보다 ' +
        (r.convRate > i.opp ? '높아 <b>전세가 유리</b>한 구간입니다.' : '낮아 <b>월세가 유리</b>한 구간입니다.');

    renderCharts(r, i);
    renderTable(r);
  }

  function renderCharts(r, i) {
    var s1 = css('--s1'), s2 = css('--s2'), s3 = css('--s3');

    Chart.stackedBar(el.mixChart, {
      height: 230,
      x: ['전세', '월세'],
      yFmt: Chart.fmtShort,
      series: [
        { name: '대출이자', color: s1, values: [r.jInterest, r.rInterest] },
        { name: '기회비용', color: s2, values: [r.jOpp, r.rOpp] },
        { name: '월세(공제 후)', color: s3, values: [0, Math.max(0, r.rRent - r.rCredit)] }
      ],
      tip: function (idx) {
        var isJ = idx === 0;
        return '<div class="tt">' + (isJ ? '전세' : '월세') + ' 월 비용</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">대출이자</span>' +
          '<span class="tv">' + UI.won(isJ ? r.jInterest : r.rInterest) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">기회비용</span>' +
          '<span class="tv">' + UI.won(isJ ? r.jOpp : r.rOpp) + '</span></div>' +
          (isJ ? '' : '<div class="tr"><span class="sw" style="background:' + s3 + '"></span><span class="tn">월세(공제 후)</span>' +
            '<span class="tv">' + UI.won(Math.max(0, r.rRent - r.rCredit)) + '</span></div>') +
          '<div class="tr"><span class="tn">합계</span><span class="tv">' +
          UI.won(isJ ? r.jTotal : r.rTotal) + '</span></div>';
      }
    });

    var x = [], j = [], m = [];
    for (var k = 0; k <= i.months; k++) {
      x.push(k); j.push(r.jTotal * k); m.push(r.rTotal * k);
    }
    Chart.line(el.cumChart, {
      height: 250,
      x: x,
      xFmt: function (v) { return v + '개월'; },
      xLabel: '경과 개월',
      yFmt: Chart.fmtShort,
      fill: true,
      series: [
        { name: '월세 누적', color: s2, values: m },
        { name: '전세 누적', color: s1, values: j }
      ],
      tip: function (idx) {
        return '<div class="tt">' + x[idx] + '개월</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">전세</span>' +
          '<span class="tv">' + UI.korWon(j[idx]) + '</span></div>' +
          '<div class="tr"><span class="sw" style="background:' + s2 + '"></span><span class="tn">월세</span>' +
          '<span class="tv">' + UI.korWon(m[idx]) + '</span></div>' +
          '<div class="tr"><span class="tn">차이</span><span class="tv">' +
          UI.korWon(Math.abs(m[idx] - j[idx])) + '</span></div>';
      }
    });
  }

  function renderTable(r) {
    function row(name, a, b, invert) {
      var d = b - a;
      return '<tr><td>' + name + '</td><td>' + UI.comma(a) + '</td><td>' + UI.comma(b) + '</td>' +
        '<td class="' + (invert ? '' : '') + '">' + (d >= 0 ? '+' : '') + UI.comma(d) + '</td></tr>';
    }
    el.detailBody.innerHTML =
      row('대출이자', r.jInterest, r.rInterest) +
      row('자기자본 기회비용', r.jOpp, r.rOpp) +
      row('월세', 0, r.rRent) +
      row('월세 세액공제', 0, -r.rCredit) +
      '<tr class="year-mark"><td>월 합계</td><td>' + UI.comma(r.jTotal) + '</td><td>' +
      UI.comma(r.rTotal) + '</td><td>' + (r.diff >= 0 ? '+' : '') + UI.comma(r.diff) + '</td></tr>' +
      '<tr><td class="t-muted">묶인 자기자본</td><td class="t-muted">' + UI.korWon(r.jOwn) +
      '</td><td class="t-muted">' + UI.korWon(r.rOwn) + '</td><td class="t-muted">–</td></tr>';
  }

  ['jd', 'jl', 'jr', 'rd', 'rm', 'rl', 'rr', 'opp', 'months'].forEach(function (k) {
    el[k].addEventListener('input', function () {
      if (k === 'opp') el.oppRange.value = el.opp.value;
      render();
    });
  });
  el.oppRange.addEventListener('input', function () {
    el.opp.value = el.oppRange.value;
    render();
  });
  document.querySelectorAll('.chips button[data-months]').forEach(function (b) {
    b.addEventListener('click', function () { el.months.value = b.dataset.months; render(); });
  });
  document.addEventListener('themechange', function () {
    if (current) renderCharts(current, currentInput);
  });

  render();
})();
