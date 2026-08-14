/* Minimal dependency-free SVG chart library: line / stacked bar / bar.
   Renders against CSS theme tokens, re-renders on container resize,
   and ships a crosshair + tooltip hover layer by default. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var PAD = { l: 62, r: 16, t: 14, b: 26 };

  /* var(--token) is not reliable inside SVG presentation attributes, so any
     token-valued attribute is moved into the element's inline style instead. */
  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    var css = '';
    for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined) continue;
      if (k !== 'style' && typeof v === 'string' && v.indexOf('var(') === 0) {
        css += k + ':' + v + ';';
        continue;
      }
      n.setAttribute(k, v);
    }
    if (css) n.setAttribute('style', css + (attrs.style || ''));
    return n;
  }

  function niceStep(range, count) {
    if (!(range > 0)) return 1;
    var raw = range / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var s = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return s * mag;
  }

  function yScale(min, max, count) {
    if (min > 0) min = 0;
    if (max === min) max = min + 1;
    var step = niceStep(max - min, count || 4);
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 1e-9; v += step) ticks.push(v);
    return { min: lo, max: hi, ticks: ticks };
  }

  function roundedTopRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0.5) return 'M' + x + ' ' + (y + h) + 'h' + w;
    return 'M' + x + ' ' + (y + h) +
      'V' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + -r +
      'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r +
      'V' + (y + h) + 'Z';
  }

  function ensureShell(container) {
    var plot = container.querySelector('.ch-plot');
    if (!plot) {
      container.classList.add('chart');
      container.innerHTML = '';
      plot = document.createElement('div');
      plot.className = 'ch-plot';
      var tip = document.createElement('div');
      tip.className = 'ch-tip';
      var legend = document.createElement('div');
      legend.className = 'chart-legend';
      container.appendChild(plot);
      container.appendChild(tip);
      container.appendChild(legend);
    }
    return {
      plot: plot,
      tip: container.querySelector('.ch-tip'),
      legend: container.querySelector('.chart-legend')
    };
  }

  function drawLegend(node, series) {
    if (series.length < 2) { node.innerHTML = ''; return; }
    node.innerHTML = series.map(function (s) {
      return '<span class="li"><span class="sw" style="background:' + s.color + '"></span>' +
        escapeHtml(s.name) + '</span>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function defaultFmt(v) {
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(a >= 1e13 ? 0 : 1) + '조';
    if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + '억';
    if (a >= 1e4) return (v / 1e4).toFixed(a >= 1e5 ? 0 : 1) + '만';
    return Math.round(v).toLocaleString('ko-KR');
  }

  /* Downsample long series to keep the DOM small; keeps first/last points. */
  function sampleIdx(n, maxN) {
    if (n <= maxN) {
      var all = [];
      for (var i = 0; i < n; i++) all.push(i);
      return all;
    }
    var out = [], step = (n - 1) / (maxN - 1);
    for (var k = 0; k < maxN; k++) out.push(Math.round(k * step));
    out[out.length - 1] = n - 1;
    return out;
  }

  function baseRender(container, cfg, painter) {
    var shell = ensureShell(container);
    var w = Math.max(280, container.clientWidth || 640);
    var h = cfg.height || 260;
    var pad = {
      l: cfg.padLeft || PAD.l, r: PAD.r,
      t: PAD.t, b: cfg.xLabel ? PAD.b + 14 : PAD.b
    };
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    var svg = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + h, height: h, role: 'img' });
    if (cfg.title) {
      var ttl = svgEl('title', {});
      ttl.textContent = cfg.title;
      svg.appendChild(ttl);
    }

    var yFmt = cfg.yFmt || defaultFmt;
    var sc = yScale(cfg.yMin !== undefined ? cfg.yMin : 0, cfg.yMax, cfg.yTicks || 4);
    var yPos = function (v) { return pad.t + ph - (v - sc.min) / (sc.max - sc.min) * ph; };

    var seenLabel = {};
    sc.ticks.forEach(function (t) {
      var y = yPos(t);
      svg.appendChild(svgEl('line', {
        x1: pad.l, x2: pad.l + pw, y1: y, y2: y,
        stroke: t === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1
      }));
      var text = String(yFmt(t));
      if (seenLabel[text]) return;      // 눈금이 촘촘해 라벨이 겹칠 때는 하나만
      seenLabel[text] = 1;
      var lb = svgEl('text', {
        x: pad.l - 8, y: y + 4, 'text-anchor': 'end',
        fill: 'var(--muted)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums'
      });
      lb.textContent = text;
      svg.appendChild(lb);
    });

    painter(svg, { pad: pad, pw: pw, ph: ph, yPos: yPos, scale: sc, w: w, h: h });

    /* x tick labels */
    var xLabels = cfg.x || [];
    var xFmt = cfg.xFmt || function (v) { return v; };
    var n = xLabels.length;
    if (n) {
      var want = Math.max(2, Math.min(7, Math.floor(pw / 78)));
      var idxs = sampleIdx(n, Math.min(n, want));
      idxs.forEach(function (i) {
        var x = cfg.band ? pad.l + (i + 0.5) * (pw / n) : pad.l + (n === 1 ? pw / 2 : i / (n - 1) * pw);
        var lb = svgEl('text', {
          x: x, y: pad.t + ph + 17, 'text-anchor': 'middle',
          fill: 'var(--muted)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums'
        });
        lb.textContent = xFmt(xLabels[i], i);
        svg.appendChild(lb);
      });
    }
    if (cfg.xLabel) {
      var xl = svgEl('text', {
        x: pad.l + pw / 2, y: h - 2, 'text-anchor': 'middle',
        fill: 'var(--muted)', 'font-size': 11
      });
      xl.textContent = cfg.xLabel;
      svg.appendChild(xl);
    }

    svg.appendChild(svgEl('line', {
      x1: pad.l, x2: pad.l + pw, y1: pad.t + ph, y2: pad.t + ph,
      stroke: 'var(--axis)', 'stroke-width': 1
    }));

    shell.plot.innerHTML = '';
    shell.plot.appendChild(svg);
    drawLegend(shell.legend, cfg.series || []);
    return { svg: svg, shell: shell, pad: pad, pw: pw, ph: ph, yPos: yPos };
  }

  function attachHover(container, ctx, cfg, cursorNode) {
    var shell = ctx.shell, pad = ctx.pad, pw = ctx.pw, ph = ctx.ph;
    var n = (cfg.x || []).length;
    if (!n) return;
    var hit = svgEl('rect', {
      x: pad.l, y: pad.t, width: pw, height: ph, fill: 'transparent',
      style: 'cursor:crosshair'
    });
    ctx.svg.appendChild(hit);

    function idxAt(px) {
      var rel = (px - pad.l) / pw;
      var i = cfg.band ? Math.floor(rel * n) : Math.round(rel * (n - 1));
      return Math.max(0, Math.min(n - 1, i));
    }
    function xOf(i) {
      return cfg.band ? pad.l + (i + 0.5) * (pw / n) : pad.l + (n === 1 ? pw / 2 : i / (n - 1) * pw);
    }
    function move(ev) {
      var r = ctx.svg.getBoundingClientRect();
      var sx = (ev.clientX - r.left) * (ctx.svg.viewBox.baseVal.width / r.width);
      var i = idxAt(sx);
      var cx = xOf(i);
      if (cursorNode) {
        cursorNode.setAttribute('x1', cx); cursorNode.setAttribute('x2', cx);
        cursorNode.style.opacity = 1;
      }
      if (cfg.onHover) cfg.onHover(i, ctx);
      var html = cfg.tip ? cfg.tip(i) : defaultTip(cfg, i);
      shell.tip.innerHTML = html;
      shell.tip.style.opacity = 1;
      var boxW = shell.tip.offsetWidth || 140;
      var left = cx / ctx.svg.viewBox.baseVal.width * r.width + 14;
      if (left + boxW > r.width) left = left - boxW - 28;
      shell.tip.style.left = Math.max(0, left) + 'px';
      shell.tip.style.top = Math.min(ph, 16) + 'px';
    }
    function leave() {
      shell.tip.style.opacity = 0;
      if (cursorNode) cursorNode.style.opacity = 0;
      if (cfg.onHover) cfg.onHover(-1, ctx);
    }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchmove', function (e) {
      if (e.touches[0]) { move(e.touches[0]); e.preventDefault(); }
    }, { passive: false });
    hit.addEventListener('touchend', leave);
  }

  function defaultTip(cfg, i) {
    var vf = cfg.tipFmt || cfg.yFmt || defaultFmt;
    var head = (cfg.xFmt ? cfg.xFmt(cfg.x[i], i) : cfg.x[i]);
    var rows = (cfg.series || []).map(function (s) {
      return '<div class="tr"><span class="sw" style="background:' + s.color + '"></span>' +
        '<span class="tn">' + escapeHtml(s.name) + '</span>' +
        '<span class="tv">' + vf(s.values[i], i) + '</span></div>';
    }).join('');
    return '<div class="tt">' + escapeHtml(String(head)) + '</div>' + rows;
  }

  function maxOf(series, stacked) {
    var m = 0, n = series[0] ? series[0].values.length : 0;
    for (var i = 0; i < n; i++) {
      var s = 0;
      for (var j = 0; j < series.length; j++) {
        var v = series[j].values[i] || 0;
        if (stacked) s += v; else if (v > m) m = v;
      }
      if (stacked && s > m) m = s;
    }
    return m;
  }

  /* ── public renderers ───────────────────────────────────── */

  function line(container, cfg) {
    var series = cfg.series || [];
    if (!series.length || !series[0].values.length) { empty(container, cfg); return; }
    var full = series[0].values.length;
    var keep = sampleIdx(full, 400);
    var vcfg = Object.assign({}, cfg, {
      x: keep.map(function (i) { return cfg.x[i]; }),
      series: series.map(function (s) {
        return { name: s.name, color: s.color, values: keep.map(function (i) { return s.values[i]; }) };
      }),
      yMax: cfg.yMax !== undefined ? cfg.yMax : maxOf(series, false),
      band: false
    });
    if (cfg.tip) vcfg.tip = function (i) { return cfg.tip(keep[i]); };

    var ctx = baseRender(container, vcfg, function (svg, g) {
      var n = vcfg.x.length;
      var xOf = function (i) { return g.pad.l + (n === 1 ? g.pw / 2 : i / (n - 1) * g.pw); };
      vcfg.series.forEach(function (s) {
        var d = '', area = '';
        s.values.forEach(function (v, i) {
          var x = xOf(i), y = g.yPos(v);
          d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        });
        if (cfg.fill) {
          area = d + 'L' + xOf(n - 1).toFixed(1) + ' ' + (g.pad.t + g.ph) +
            'L' + xOf(0).toFixed(1) + ' ' + (g.pad.t + g.ph) + 'Z';
          svg.appendChild(svgEl('path', { d: area, fill: s.color, opacity: .10 }));
        }
        svg.appendChild(svgEl('path', {
          d: d, fill: 'none', stroke: s.color, 'stroke-width': 2,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        }));
        /* direct end label — identity never rests on color alone */
        if (vcfg.series.length <= 4 && cfg.endLabels !== false && n > 1) {
          var lx = xOf(n - 1), ly = g.yPos(s.values[n - 1]);
          var t = svgEl('text', {
            x: lx - 4, y: Math.max(g.pad.t + 9, ly - 7), 'text-anchor': 'end',
            fill: 'var(--ink-2)', 'font-size': 11, 'font-weight': 600
          });
          t.textContent = s.name;
          svg.appendChild(t);
        }
      });
    });

    var cursor = svgEl('line', {
      y1: ctx.pad.t, y2: ctx.pad.t + ctx.ph, stroke: 'var(--axis)',
      'stroke-width': 1, style: 'opacity:0'
    });
    ctx.svg.appendChild(cursor);
    var dots = vcfg.series.map(function (s) {
      var c = svgEl('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, style: 'opacity:0' });
      ctx.svg.appendChild(c);
      return c;
    });
    vcfg.onHover = function (i, c) {
      var n = vcfg.x.length;
      dots.forEach(function (dot, j) {
        if (i < 0) { dot.style.opacity = 0; return; }
        dot.setAttribute('cx', c.pad.l + (n === 1 ? c.pw / 2 : i / (n - 1) * c.pw));
        dot.setAttribute('cy', c.yPos(vcfg.series[j].values[i]));
        dot.style.opacity = 1;
      });
    };
    attachHover(container, ctx, vcfg, cursor);
    bindResize(container, cfg, line);
  }

  function bars(container, cfg, stacked) {
    var series = cfg.series || [];
    if (!series.length || !series[0].values.length) { empty(container, cfg); return; }
    var vcfg = Object.assign({}, cfg, {
      band: true,
      yMax: cfg.yMax !== undefined ? cfg.yMax : maxOf(series, stacked)
    });
    var hlRef = {};
    var ctx = baseRender(container, vcfg, function (svg, g) {
      var n = cfg.x.length;
      var slot = g.pw / n;
      var gap = slot > 6 ? 2 : slot > 3 ? 1 : 0;
      var bw = Math.max(1, slot - gap);
      var hl = svgEl('rect', {
        y: g.pad.t, height: g.ph, width: slot, fill: 'var(--ink)',
        'fill-opacity': .06, style: 'opacity:0'
      });
      svg.appendChild(hl);
      hlRef.node = hl; hlRef.slot = slot; hlRef.padL = g.pad.l;

      for (var i = 0; i < n; i++) {
        var x = g.pad.l + i * slot + gap / 2;
        var acc = 0;
        var stack = stacked ? series : [series[0]];
        var topIdx = -1;
        for (var j = stack.length - 1; j >= 0; j--) if ((stack[j].values[i] || 0) > 0) { topIdx = j; break; }
        for (var j2 = 0; j2 < stack.length; j2++) {
          var v = stack[j2].values[i] || 0;
          if (v <= 0) continue;
          var y0 = g.yPos(acc), y1 = g.yPos(acc + v);
          var hgt = Math.max(0.5, y0 - y1);
          /* 2px surface gap between stacked segments */
          var seg = (j2 !== topIdx && hgt > 4) ? hgt - 2 : hgt;
          var yTop = y1 + (hgt - seg);
          if (j2 === topIdx) {
            svg.appendChild(svgEl('path', {
              d: roundedTopRect(x, yTop, bw, seg, Math.min(4, bw / 2)), fill: stack[j2].color
            }));
          } else {
            svg.appendChild(svgEl('rect', { x: x, y: yTop, width: bw, height: seg, fill: stack[j2].color }));
          }
          acc += v;
        }
      }
    });
    vcfg.onHover = function (i) {
      if (!hlRef.node) return;
      if (i < 0) { hlRef.node.style.opacity = 0; return; }
      hlRef.node.setAttribute('x', hlRef.padL + i * hlRef.slot);
      hlRef.node.style.opacity = 1;
    };
    attachHover(container, ctx, vcfg, null);
    bindResize(container, cfg, stacked ? stackedBar : bar);
  }

  function stackedBar(container, cfg) { bars(container, cfg, true); }
  function bar(container, cfg) { bars(container, cfg, false); }

  function empty(container, cfg) {
    container.classList.add('chart');
    container.innerHTML = '<div class="chart-empty">' +
      escapeHtml(cfg && cfg.emptyText ? cfg.emptyText : '데이터 없음') + '</div>';
  }

  var ro = null, roMap = new WeakMap();
  function bindResize(container, cfg, fn) {
    roMap.set(container, { cfg: cfg, fn: fn, w: container.clientWidth });
    if (!('ResizeObserver' in global)) return;
    if (!ro) {
      ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
          var rec = roMap.get(e.target);
          if (!rec) return;
          var w = e.target.clientWidth;
          if (Math.abs(w - rec.w) < 12) return;
          rec.w = w;
          rec.fn(e.target, rec.cfg);
        });
      });
    }
    ro.observe(container);
  }

  global.Chart = {
    line: line, bar: bar, stackedBar: stackedBar, empty: empty,
    fmtShort: defaultFmt
  };
})(window);
