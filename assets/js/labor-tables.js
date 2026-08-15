/* 노동·근로 기준표: 최저임금 / 주휴수당 / 연차 / 퇴직금 / 실업급여 일수 / 근로시간 환산 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var WEEKS_PER_MONTH = 365 / 7 / 12;   /* ≒ 4.345238 주 */
  var STD_WEEK = 40;                    /* 법정 기준 주 소정근로시간 */
  var HOLIDAY_HOURS = 8;                /* 주 40시간일 때 주휴시간 */
  var MIN_WEEK_HOURS = 15;              /* 주휴·연차·퇴직금 적용 하한(초단시간 기준) */

  /* 연도별 최저임금 시간급 (고용노동부 고시). 확정 고시된 연도만 기재 */
  var MIN_WAGE = [
    [2009, 4000], [2010, 4110], [2011, 4320], [2012, 4580], [2013, 4860],
    [2014, 5210], [2015, 5580], [2016, 6030], [2017, 6470], [2018, 7530],
    [2019, 8350], [2020, 8590], [2021, 8720], [2022, 9160], [2023, 9620],
    [2024, 9860], [2025, 10030], [2026, 10320]
  ];
  var LATEST = MIN_WAGE[MIN_WAGE.length - 1];

  /* 주휴수당 / 근로시간 환산표에 쓰는 주 소정근로시간 행 */
  var HOUR_ROWS = [12, 15, 20, 25, 30, 35, 40];

  var el = {
    toc: $('toc'),
    mwChart: $('mwChart'), mwCsv: $('mwCsv'), mwBody: $('mwBody'),
    whHint: $('whHint'), whHourly: $('whHourly'), whHours: $('whHours'), whChips: $('whChips'),
    whWeekly: $('whWeekly'), whWeeklySub: $('whWeeklySub'), whWeekPay: $('whWeekPay'),
    whMonthPay: $('whMonthPay'), whEff: $('whEff'), whEffSub: $('whEffSub'),
    whWarn: $('whWarn'), whBody: $('whBody'),
    avBody: $('avBody'),
    svHint: $('svHint'), svJoin: $('svJoin'), svLeave: $('svLeave'), svMode: $('svMode'),
    svPay: $('svPay'), svPayLabel: $('svPayLabel'), svBonus: $('svBonus'), svAnnualPay: $('svAnnualPay'),
    svDays: $('svDays'), svYears: $('svYears'), svAvgDaily: $('svAvgDaily'), svAvgSub: $('svAvgSub'),
    svAmount: $('svAmount'), svAmountSub: $('svAmountSub'), svWarn: $('svWarn'),
    cvHint: $('cvHint'), cvHourly: $('cvHourly'), cvBody: $('cvBody')
  };

  function css(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ── 공통 계산 ───────────────────────────────────────── */

  /* 주 소정근로시간 → 주휴시간. 15시간 미만은 주휴 없음, 40시간 초과분은 인정 안 됨 */
  function holidayHours(weekHours) {
    if (weekHours < MIN_WEEK_HOURS) return 0;
    return Math.min(weekHours, STD_WEEK) / STD_WEEK * HOLIDAY_HOURS;
  }

  /* 주 소정근로시간 → 월 환산시간 (주휴 포함, 반올림 전 값) */
  function monthlyHoursRaw(weekHours) {
    return (weekHours + holidayHours(weekHours)) * WEEKS_PER_MONTH;
  }

  function weeklyPack(hourly, weekHours) {
    var hh = holidayHours(weekHours);
    var holidayPay = hh * hourly;
    var basePay = weekHours * hourly;
    var weekPay = basePay + holidayPay;
    return {
      hours: weekHours,
      holidayHours: hh,
      holidayPay: holidayPay,
      basePay: basePay,
      weekPay: weekPay,
      monthPay: weekPay * WEEKS_PER_MONTH,
      effective: weekHours > 0 ? weekPay / weekHours : 0
    };
  }

  /* ── ① 최저임금 ─────────────────────────────────────── */

  function mwRows() {
    return MIN_WAGE.map(function (r, i) {
      var prev = i > 0 ? MIN_WAGE[i - 1][1] : null;
      return {
        year: r[0],
        wage: r[1],
        rate: prev ? (r[1] - prev) / prev : null,
        daily: r[1] * 8,
        monthly: r[1] * 209
      };
    });
  }

  function renderMinWage() {
    var rows = mwRows();
    el.mwBody.innerHTML = rows.map(function (r) {
      var isLast = r.year === LATEST[0];
      return '<tr' + (isLast ? ' class="year-mark"' : '') + ' data-h="' + r.wage + '" data-y="' + r.year +
        '" tabindex="0" style="cursor:pointer" title="이 시급을 계산기에 적용">' +
        '<td>' + r.year + '년' + (isLast ? ' <span class="badge r5">최신</span>' : '') + '</td>' +
        '<td>' + UI.comma(r.wage) + '</td>' +
        '<td>' + (r.rate === null ? '<span class="t-muted">–</span>' : '+' + UI.pct(r.rate)) + '</td>' +
        '<td>' + UI.comma(r.daily) + '</td>' +
        '<td>' + UI.comma(r.monthly) + '</td>' +
        '</tr>';
    }).join('');
    /* 최신 연도가 먼저 보이도록 스크롤 (표는 오래된 연도부터 오름차순) */
    var wrap = el.mwBody.parentNode.parentNode;
    if (wrap && wrap.classList.contains('table-wrap')) wrap.scrollTop = wrap.scrollHeight;
  }

  function renderMinWageChart() {
    var years = MIN_WAGE.map(function (r) { return r[0]; });
    var wages = MIN_WAGE.map(function (r) { return r[1]; });
    var rows = mwRows();
    Chart.line(el.mwChart, {
      height: 230,
      x: years,
      xFmt: function (v) { return v + '년'; },
      xLabel: '연도',
      yFmt: function (v) { return UI.comma(v); },
      fill: true,
      endLabels: false,
      series: [{ name: '최저 시급', color: css('--s1'), values: wages }],
      tip: function (i) {
        var r = rows[i];
        return '<div class="tt">' + r.year + '년</div>' +
          '<div class="tr"><span class="sw" style="background:' + css('--s1') + '"></span>' +
          '<span class="tn">시급</span><span class="tv">' + UI.won(r.wage) + '</span></div>' +
          '<div class="tr"><span class="tn">전년 대비</span><span class="tv">' +
          (r.rate === null ? '–' : '+' + UI.pct(r.rate)) + '</span></div>' +
          '<div class="tr"><span class="tn">월 209시간</span><span class="tv">' +
          UI.comma(r.monthly) + '원</span></div>';
      }
    });
  }

  function exportMinWageCsv() {
    var rows = [['연도', '시급(원)', '전년대비 인상률', '일급 8시간(원)', '월 환산 209시간(원)']];
    mwRows().forEach(function (r) {
      rows.push([r.year, r.wage, r.rate === null ? '' : UI.pct(r.rate), r.daily, r.monthly]);
    });
    UI.downloadCsv('최저임금_연도별.csv', rows);
  }

  /* ── ② 주휴수당 ─────────────────────────────────────── */

  function renderWeeklyHoliday() {
    var hourly = Math.max(0, UI.parseNum(el.whHourly.value));
    var hours = Math.max(0, UI.parseNum(el.whHours.value));
    var p = weeklyPack(hourly, hours);

    el.whHint.textContent = hourly
      ? '시급 ' + UI.comma(hourly) + '원 · 주 ' + hours + '시간'
      : '시급을 입력하세요';

    if (!hourly || !hours) {
      el.whWeekly.textContent = el.whWeekPay.textContent = '–';
      el.whMonthPay.textContent = el.whEff.textContent = '–';
      el.whWeeklySub.textContent = el.whEffSub.textContent = '';
      el.whWarn.textContent = '시급과 주 소정근로시간을 입력하세요.';
    } else if (hours < MIN_WEEK_HOURS) {
      el.whWeekly.textContent = '없음';
      el.whWeeklySub.textContent = '주 15시간 미만';
      el.whWeekPay.textContent = UI.won(p.weekPay);
      el.whMonthPay.textContent = UI.korWon(p.monthPay);
      el.whEff.textContent = UI.won(p.effective);
      el.whEffSub.textContent = '주휴 없음 · 시급과 동일';
      el.whWarn.textContent = '주 소정근로시간이 15시간 미만인 초단시간 근로자는 주휴수당·연차휴가·퇴직금 대상이 아닙니다.';
    } else {
      el.whWeekly.textContent = UI.won(p.holidayPay);
      el.whWeeklySub.textContent = '주휴 ' + p.holidayHours.toFixed(1) + '시간분';
      el.whWeekPay.textContent = UI.won(p.weekPay);
      el.whMonthPay.textContent = UI.korWon(p.monthPay);
      el.whEff.textContent = UI.won(p.effective);
      el.whEffSub.textContent = '표기 시급 대비 +' + UI.pct(p.effective / hourly - 1);
      el.whWarn.textContent = hours > STD_WEEK
        ? '주 40시간을 넘는 ' + (hours - STD_WEEK) + '시간은 연장근로입니다. 통상임금의 50%를 더한 가산수당이 별도로 붙습니다(5인 이상 사업장).'
        : '그 주의 소정근로일을 모두 개근해야 주휴수당이 발생합니다.';
    }

    el.whBody.innerHTML = HOUR_ROWS.map(function (h) {
      var r = weeklyPack(hourly, h);
      var mark = h === Math.round(hours) ? ' class="year-mark"' : '';
      return '<tr' + mark + '>' +
        '<td>주 ' + h + '시간' + (h < MIN_WEEK_HOURS ? ' <span class="t-muted">(초단시간)</span>' : '') + '</td>' +
        '<td>' + (r.holidayHours ? r.holidayHours.toFixed(1) + 'h' : '<span class="t-muted">없음</span>') + '</td>' +
        '<td>' + (r.holidayPay ? UI.comma(r.holidayPay) : '<span class="t-muted">0</span>') + '</td>' +
        '<td>' + UI.comma(r.weekPay) + '</td>' +
        '<td>' + UI.comma(r.monthPay) + '</td>' +
        '<td>' + UI.comma(r.effective) + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ── ③ 연차휴가 ─────────────────────────────────────── */

  /* 근속 n년(n≥1)의 연차 일수: 15일 + 최초 1년 초과 매 2년마다 1일, 한도 25일 */
  function annualLeaveDays(n) {
    if (n < 1) return 0;
    if (n < 3) return 15;
    return Math.min(25, 15 + Math.floor((n - 1) / 2));
  }

  function renderAnnualLeave() {
    var rows = ['<tr><td>1년 미만</td><td>최대 11일</td><td><span class="t-muted">–</span></td>' +
      '<td style="text-align:left">1개월 개근할 때마다 1일</td></tr>'];
    var capped = false;
    for (var n = 1; n <= 25; n++) {
      var d = annualLeaveDays(n);
      var add = d - 15;
      var why;
      if (n < 3) why = '기본 15일';
      else if (d === 25 && !capped) { why = '가산 한도 25일 도달'; capped = true; }
      else if (d === 25) why = '한도 25일 (더 늘지 않음)';
      else why = '15일 + 가산 ' + add + '일';
      rows.push('<tr' + (d === 25 && why.indexOf('도달') > -1 ? ' class="year-mark"' : '') + '>' +
        '<td>' + n + '년차</td>' +
        '<td>' + d + '일</td>' +
        '<td>' + (add ? '+' + add + '일' : '<span class="t-muted">–</span>') + '</td>' +
        '<td style="text-align:left">' + why + '</td>' +
        '</tr>');
    }
    el.avBody.innerHTML = rows.join('');
  }

  /* ── ④ 퇴직금 ───────────────────────────────────────── */

  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  /* 월 단위로 거슬러 올라가되 말일 넘침(3/31 → 2/31)을 막는다 */
  function minusMonths(d, months) {
    var day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() - months, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return t;
  }

  function dayDiff(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function calcSeverance(o) {
    var days = dayDiff(o.join, o.leave) + 1;              // 재직일수(마지막 근무일 포함)
    var quit = new Date(o.leave.getTime());
    quit.setDate(quit.getDate() + 1);                     // 퇴직일 = 마지막 근무일 다음 날
    var base = minusMonths(quit, 3);
    var days3 = Math.max(1, dayDiff(base, quit));         // 평균임금 산정기간 일수(89~92일)
    var sum3 = o.mode === 'sum3' ? o.pay : o.pay * 3;
    var total = sum3 + o.bonus * 3 / 12 + o.annualPay * 3 / 12;
    var avgDaily = total / days3;
    return {
      days: days,
      years: days / 365,
      days3: days3,
      sum3: sum3,
      total: total,
      avgDaily: avgDaily,
      amount: avgDaily * 30 * (days / 365),
      eligible: days >= 365
    };
  }

  function renderSeverance() {
    var join = parseDate(el.svJoin.value);
    var leave = parseDate(el.svLeave.value);
    var mode = el.svMode.dataset.value || 'avg';
    var pay = Math.max(0, UI.parseNum(el.svPay.value));

    el.svPayLabel.textContent = mode === 'sum3' ? '퇴직 전 3개월 임금 합계 (원)' : '월 평균임금 (원)';

    var blank = function (msg) {
      el.svDays.textContent = el.svAvgDaily.textContent = el.svAmount.textContent = '–';
      el.svYears.textContent = el.svAvgSub.textContent = el.svAmountSub.textContent = '';
      el.svHint.textContent = '';
      el.svWarn.textContent = msg;
    };

    if (!join || !leave) { blank('입사일과 마지막 근무일을 입력하세요.'); return; }
    if (dayDiff(join, leave) < 0) { blank('마지막 근무일이 입사일보다 빠릅니다.'); return; }
    if (!pay) { blank('임금을 입력하세요.'); return; }

    var r = calcSeverance({
      join: join, leave: leave, mode: mode, pay: pay,
      bonus: Math.max(0, UI.parseNum(el.svBonus.value)),
      annualPay: Math.max(0, UI.parseNum(el.svAnnualPay.value))
    });

    el.svHint.textContent = '평균임금 산정기간 ' + r.days3 + '일 · 3개월 임금 ' + UI.korWon(r.total);
    el.svDays.textContent = UI.comma(r.days) + '일';
    el.svYears.textContent = '약 ' + r.years.toFixed(2) + '년';
    el.svAvgDaily.textContent = UI.won(r.avgDaily);
    el.svAvgSub.textContent = UI.korWon(r.total) + ' ÷ ' + r.days3 + '일';

    if (!r.eligible) {
      el.svAmount.textContent = '지급 대상 아님';
      el.svAmountSub.textContent = '계속근로 1년 미만';
      el.svWarn.textContent = '계속근로기간이 1년(365일) 미만이면 퇴직금 지급 대상이 아닙니다. ' +
        '현재 재직일수는 ' + UI.comma(r.days) + '일입니다.';
    } else {
      el.svAmount.textContent = UI.korWon(r.amount);
      el.svAmountSub.textContent = UI.won(r.avgDaily) + ' × 30일 × ' + r.years.toFixed(2);
      el.svWarn.textContent = '평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 봅니다. ' +
        '퇴직연금(DC형)에 가입했다면 회사가 매년 납입한 부담금과 운용수익이 퇴직급여가 되므로 금액이 달라집니다.';
    }
  }

  /* ── ⑥ 근로시간 환산 ────────────────────────────────── */

  function renderConvert() {
    var hourly = Math.max(0, UI.parseNum(el.cvHourly.value));
    el.cvHint.textContent = hourly ? '시급 ' + UI.comma(hourly) + '원 기준' : '시급을 입력하세요';

    el.cvBody.innerHTML = HOUR_ROWS.map(function (h) {
      var raw = monthlyHoursRaw(h);
      var rounded = Math.round(raw);
      var hh = holidayHours(h);
      var monthPay = rounded * hourly;
      var mark = h === STD_WEEK ? ' class="year-mark"' : '';
      return '<tr' + mark + '>' +
        '<td>주 ' + h + '시간' + (h < MIN_WEEK_HOURS ? ' <span class="t-muted">(초단시간)</span>' : '') + '</td>' +
        '<td>' + (hh ? hh.toFixed(1) + 'h' : '<span class="t-muted">없음</span>') + '</td>' +
        '<td>' + rounded + 'h <span class="t-muted">(' + raw.toFixed(1) + ')</span></td>' +
        '<td>' + UI.comma(monthPay) + '</td>' +
        '<td>' + UI.comma(monthPay * 12) + '</td>' +
        '</tr>';
    }).join('');
  }

  /* ── 이벤트 ─────────────────────────────────────────── */

  function applyHourly(v) {
    el.whHourly.value = v;
    el.cvHourly.value = v;
    renderWeeklyHoliday();
    renderConvert();
  }

  var runWeekly = debounce(renderWeeklyHoliday, 220);
  var runSeverance = debounce(renderSeverance, 220);
  var runConvert = debounce(renderConvert, 220);

  ['whHourly', 'whHours'].forEach(function (k) {
    el[k].addEventListener('input', runWeekly);
  });
  ['svPay', 'svBonus', 'svAnnualPay', 'svJoin', 'svLeave'].forEach(function (k) {
    el[k].addEventListener('input', runSeverance);
    el[k].addEventListener('change', runSeverance);
  });
  el.cvHourly.addEventListener('input', runConvert);

  UI.segment(el.svMode, function () { renderSeverance(); });

  el.whChips.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-hours]');
    if (!b) return;
    el.whHours.value = b.dataset.hours;
    renderWeeklyHoliday();
  });

  function pickWage(tr) {
    if (!tr || !tr.dataset.h) return;
    applyHourly(tr.dataset.h);
    el.whHint.textContent = tr.dataset.y + '년 최저임금 ' + UI.comma(+tr.dataset.h) + '원 적용 · 주 ' +
      Math.max(0, UI.parseNum(el.whHours.value)) + '시간';
  }
  el.mwBody.addEventListener('click', function (e) {
    pickWage(e.target.closest('tr'));
  });
  el.mwBody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    pickWage(e.target.closest('tr'));
  });

  el.mwCsv.addEventListener('click', exportMinWageCsv);

  el.toc.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-go]');
    if (!b) return;
    var target = document.getElementById(b.dataset.go);
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - 68;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });

  document.addEventListener('themechange', renderMinWageChart);

  /* ── 초기 렌더 ──────────────────────────────────────── */

  el.whHourly.value = LATEST[1];
  el.cvHourly.value = LATEST[1];

  renderMinWage();
  renderMinWageChart();
  renderWeeklyHoliday();
  renderAnnualLeave();
  renderSeverance();
  renderConvert();
})();
