/* 연봉 구간별 실수령액 표: salary-core.js의 calc를 그대로 써서 계산기 페이지와 값이 항상 같다 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var calc = SalaryCore.calc;

  var MAX_ROWS = 600;              // 렌더 폭주 방지 상한
  var BASE_YEAR = '2025년 고시 기준 기본 요율';

  var el = {
    myAnnual: $('myAnnual'), myAnnualHelp: $('myAnnualHelp'),
    nontax: $('nontax'), family: $('family'), children: $('children'),
    startAnnual: $('startAnnual'), endAnnual: $('endAnnual'),
    seg: $('seg'), segHelp: $('segHelp'),
    rPension: $('rPension'), rHealth: $('rHealth'), rCare: $('rCare'), rEmploy: $('rEmploy'),
    pensionMax: $('pensionMax'), pensionMin: $('pensionMin'),
    sumHint: $('sumHint'),
    netMonth: $('netMonth'), netMonthSub: $('netMonthSub'), netYear: $('netYear'),
    deductMonth: $('deductMonth'), deductSub: $('deductSub'), netRate: $('netRate'),
    rateChart: $('rateChart'),
    rowsHint: $('rowsHint'), tableCaption: $('tableCaption'),
    tableWrap: $('tableWrap'), tableBody: document.querySelector('#salaryTable tbody'),
    scrollBtn: $('scrollBtn'), csvBtn: $('csvBtn')
  };

  var segCtl = UI.segment(el.seg, function () { render(true); });

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

  function readInput() {
    var start = Math.max(0, UI.parseNum(el.startAnnual.value));
    var end = Math.max(0, UI.parseNum(el.endAnnual.value));
    if (end < start) { var t = start; start = end; end = t; }   // 뒤집혀 있으면 자동 교정
    return {
      myAnnual: Math.max(0, UI.parseNum(el.myAnnual.value)),
      start: start,
      end: end,
      seg: Math.max(100000, UI.parseNum(segCtl.get())),
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

  /* 표에 쓸 연봉 목록. 상한을 넘으면 끝 연봉을 잘라내고 잘렸다고 알린다 */
  function annualList(inp) {
    var n = Math.floor((inp.end - inp.start) / inp.seg) + 1;
    var clipped = false;
    if (n > MAX_ROWS) { n = MAX_ROWS; clipped = true; }
    var out = [];
    for (var i = 0; i < n; i++) out.push(inp.start + i * inp.seg);
    return { list: out, clipped: clipped };
  }

  /* calc 결과를 표 한 행에 필요한 값으로 정리 */
  function rowOf(annual, inp) {
    var r = calc({
      annual: annual, nontax: inp.nontax, family: inp.family, children: inp.children,
      rPension: inp.rPension, rHealth: inp.rHealth, rCare: inp.rCare, rEmploy: inp.rEmploy,
      pensionMax: inp.pensionMax, pensionMin: inp.pensionMin
    });
    var m = {};
    r.items.forEach(function (i) { m[i.name] = i.month; });
    return {
      annual: annual,
      gross: r.monthlyGross,
      pension: m['국민연금'],
      health: m['건강보험'] + m['장기요양'],
      employ: m['고용보험'],
      tax: m['소득세'] + m['지방소득세'],
      total: r.totalMonth,
      net: r.netMonth,
      rate: r.monthlyGross > 0 ? r.netMonth / r.monthlyGross : 0
    };
  }

  var rows = [], markIdx = -1;

  function nearestIdx(list, annual) {
    if (!list.length) return -1;
    var best = 0, diff = Math.abs(list[0] - annual);
    for (var i = 1; i < list.length; i++) {
      var d = Math.abs(list[i] - annual);
      if (d < diff) { diff = d; best = i; }
    }
    return best;
  }

  function render(scrollToMark) {
    var inp = readInput();
    var got = annualList(inp);

    rows = got.list.map(function (a) { return rowOf(a, inp); });
    markIdx = inp.myAnnual ? nearestIdx(got.list, inp.myAnnual) : -1;

    el.myAnnualHelp.textContent = inp.myAnnual
      ? UI.korWon(inp.myAnnual) + ' · 월 세전 ' + UI.korWon(inp.myAnnual / 12)
      : '연봉을 입력하면 표에서 가장 가까운 행을 강조합니다';
    el.segHelp.textContent = UI.korWon(inp.start) + ' ~ ' + UI.korWon(inp.end) + ' · ' +
      UI.comma(inp.seg / 10000) + '만원 간격';

    renderStats(inp);
    renderTable(inp, got.clipped);
    renderChart(inp);

    if (scrollToMark !== false) scrollToMarkRow();
  }

  function renderStats(inp) {
    if (!inp.myAnnual) {
      ['netMonth', 'netYear', 'deductMonth', 'netRate'].forEach(function (k) { el[k].textContent = '–'; });
      el.netMonthSub.textContent = el.deductSub.textContent = '';
      el.sumHint.textContent = '내 연봉을 입력하세요';
      return;
    }
    var r = rowOf(inp.myAnnual, inp);
    el.sumHint.textContent = '연봉 ' + UI.korWon(inp.myAnnual) + ' · 부양가족 ' + inp.family + '명' +
      (inp.children ? ' · 자녀 ' + inp.children + '명' : '') +
      ' · 비과세 월 ' + UI.comma(inp.nontax) + '원';
    el.netMonth.textContent = UI.korWon(r.net);
    el.netMonthSub.textContent = '세전 ' + UI.korWon(r.gross) + ' 대비 ' + UI.pct(r.rate);
    el.netYear.textContent = UI.korWon(r.net * 12);
    el.deductMonth.textContent = UI.korWon(r.total);
    el.deductSub.textContent = '공제율 ' + UI.pct(r.gross > 0 ? r.total / r.gross : 0);
    el.netRate.textContent = UI.pct(r.rate);
  }

  /* 180행 × 9열이므로 문자열 한 번에 조립해서 innerHTML로 넣는다 */
  function renderTable(inp, clipped) {
    if (!rows.length) {
      el.tableBody.innerHTML = '<tr><td colspan="9" class="t-muted" style="text-align:left">표시할 구간이 없습니다. 시작·끝 연봉을 확인하세요.</td></tr>';
      el.rowsHint.textContent = '';
      el.tableCaption.textContent = '';
      return;
    }

    var html = rows.map(function (r, i) {
      var mark = i === markIdx;
      return '<tr' + (mark ? ' id="myRow" class="year-mark" style="background:var(--accent-soft)"' : '') + '>' +
        '<td>' + UI.comma(r.annual) + '</td>' +
        '<td>' + UI.comma(r.gross) + '</td>' +
        '<td>' + UI.comma(r.pension) + '</td>' +
        '<td>' + UI.comma(r.health) + '</td>' +
        '<td>' + UI.comma(r.employ) + '</td>' +
        '<td>' + UI.comma(r.tax) + '</td>' +
        '<td>' + UI.comma(r.total) + '</td>' +
        '<td><b>' + UI.comma(r.net) + '</b></td>' +
        '<td>' + UI.pct(r.rate) + '</td>' +
        '</tr>';
    }).join('');
    el.tableBody.innerHTML = html;

    el.rowsHint.textContent = rows.length + '개 구간 · 원 단위 반올림' +
      (clipped ? ' · 최대 ' + MAX_ROWS + '행까지만 표시' : '');
    el.tableCaption.textContent = BASE_YEAR + ' · 부양가족 ' + inp.family + '명' +
      (inp.children ? ' · 자녀 ' + inp.children + '명' : '') +
      ' · 월 비과세 ' + UI.comma(inp.nontax) + '원 · 금액 단위 원(월 기준)';
  }

  function renderChart(inp) {
    if (rows.length < 2) { Chart.empty(el.rateChart, { emptyText: '구간이 2개 이상 필요합니다' }); return; }
    var s1 = css('--s1');
    var xs = rows.map(function (r) { return r.annual; });
    var vals = rows.map(function (r) { return r.rate * 100; });

    Chart.line(el.rateChart, {
      height: 240,
      x: xs,
      xFmt: function (v) { return (v / 10000000).toFixed(0) + '천만'; },
      xLabel: '연봉',
      yFmt: function (v) { return v.toFixed(0) + '%'; },
      endLabels: false,
      fill: true,
      series: [{ name: '실수령률', color: s1, values: vals }],
      tip: function (i) {
        return '<div class="tt">연봉 ' + UI.korWon(xs[i]) + '</div>' +
          '<div class="tr"><span class="sw" style="background:' + s1 + '"></span><span class="tn">실수령률</span>' +
          '<span class="tv">' + UI.pct(rows[i].rate) + '</span></div>' +
          '<div class="tr"><span class="tn">월 실수령</span><span class="tv">' + UI.korWon(rows[i].net) + '</span></div>' +
          '<div class="tr"><span class="tn">월 공제</span><span class="tv">' + UI.korWon(rows[i].total) + '</span></div>';
      }
    });
  }

  /* 강조 행이 표 스크롤 영역 가운데로 오게 한다(페이지 스크롤은 건드리지 않음) */
  function scrollToMarkRow() {
    var row = $('myRow');
    if (!row) return;
    var wrap = el.tableWrap;
    var delta = row.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
    wrap.scrollTop += delta - wrap.clientHeight / 2 + row.offsetHeight / 2;
  }

  function exportCsv() {
    var inp = readInput();
    var out = [
      ['연봉 실수령액 표 · ' + BASE_YEAR],
      ['부양가족 ' + inp.family + '명', '자녀 ' + inp.children + '명',
        '월 비과세 ' + inp.nontax + '원',
        '국민연금 ' + inp.rPension + '%', '건강보험 ' + inp.rHealth + '%',
        '장기요양 ' + inp.rCare + '%', '고용보험 ' + inp.rEmploy + '%'],
      ['연봉', '월 세전', '국민연금', '건강+장기요양', '고용보험', '소득세+지방세',
        '공제 합계', '월 실수령액', '실수령률(%)']
    ];
    rows.forEach(function (r) {
      out.push([
        Math.round(r.annual), Math.round(r.gross), Math.round(r.pension), Math.round(r.health),
        Math.round(r.employ), Math.round(r.tax), Math.round(r.total), Math.round(r.net),
        (r.rate * 100).toFixed(1)
      ]);
    });
    UI.downloadCsv('연봉실수령액표.csv', out);
  }

  /* 입력 이벤트는 250ms 디바운스 */
  var timer = null;
  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(function () { render(false); }, 250);
  }

  ['myAnnual', 'nontax', 'family', 'children', 'startAnnual', 'endAnnual',
    'rPension', 'rHealth', 'rCare', 'rEmploy', 'pensionMax', 'pensionMin'].forEach(function (k) {
      el[k].addEventListener('input', debounced);
    });
  document.querySelectorAll('.chips button[data-a]').forEach(function (b) {
    b.addEventListener('click', function () { el.myAnnual.value = b.dataset.a; render(true); });
  });
  el.scrollBtn.addEventListener('click', function () { render(true); });
  el.csvBtn.addEventListener('click', exportCsv);
  document.addEventListener('themechange', function () { renderChart(readInput()); });

  render(true);
})();
