/* Shared helpers: theme toggle, number formatting, CSV download. */
(function (global) {
  'use strict';

  var KEY = 'sim-theme';

  function applyTheme(t) {
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function initTheme() {
    try { applyTheme(localStorage.getItem(KEY)); } catch (e) { }
    var btn = document.querySelector('.theme-btn');
    if (!btn) return;
    var paint = function () { btn.textContent = currentTheme() === 'dark' ? '☀' : '☾'; };
    paint();
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(KEY, next); } catch (e) { }
      paint();
      document.dispatchEvent(new CustomEvent('themechange'));
    });
  }

  var nf = new Intl.NumberFormat('ko-KR');

  function comma(n) { return nf.format(Math.round(n)); }

  function won(n) { return comma(n) + '원'; }

  /* 1234567890 → "12억 3,456만원". 100만원 미만은 원 단위 그대로 표시 */
  function korWon(n) {
    var neg = n < 0; n = Math.abs(Math.round(n));
    if (n < 1000000) return (neg ? '-' : '') + comma(n) + '원';
    var eok = Math.floor(n / 100000000);
    var man = Math.floor((n % 100000000) / 10000);
    var out = [];
    if (eok) out.push(comma(eok) + '억');
    if (man) out.push(comma(man) + '만');
    return (neg ? '-' : '') + out.join(' ') + '원';
  }

  function parseNum(v) {
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function pct(v, digits) {
    return (v * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  /* segmented control: <div class="seg" data-value="x"><button data-v="x">…</button></div> */
  function segment(node, onChange) {
    var btns = Array.prototype.slice.call(node.querySelectorAll('button'));
    function set(v, fire) {
      node.dataset.value = v;
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === v)); });
      if (fire !== false && onChange) onChange(v);
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.v, true); }); });
    set(node.dataset.value || btns[0].dataset.v, false);
    return { set: set, get: function () { return node.dataset.value; } };
  }

  document.addEventListener('DOMContentLoaded', initTheme);

  global.UI = {
    comma: comma, won: won, korWon: korWon, parseNum: parseNum, pct: pct,
    downloadCsv: downloadCsv, segment: segment, currentTheme: currentTheme
  };
})(window);
