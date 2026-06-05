<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>늦게 시작해도 따라잡을 수 있을까 · 자산 시뮬레이터</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #f6f3ec;
    --ink: #1c2420;
    --muted: #5f6b63;
    --line: rgba(28,36,32,0.12);
    --card: #fffdf8;
    --green: #0f6e56;
    --green-soft: rgba(15,110,86,0.10);
    --blue: #185fa5;
    --blue-soft: rgba(24,95,165,0.10);
    --gold: #b07d22;
    --success-bg: #e3f1ea;
    --success-tx: #0c5640;
    --warn-bg: #f7ecd7;
    --warn-tx: #8a5c0e;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Pretendard', sans-serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.6;
    padding: 48px 20px 64px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 760px; margin: 0 auto; }
  .eyebrow {
    font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--green); font-weight: 600; margin-bottom: 14px;
    opacity: 0; animation: rise .7s ease forwards;
  }
  h1 {
    font-family: 'Fraunces', 'Pretendard', serif;
    font-weight: 500; font-size: 34px; line-height: 1.25; letter-spacing: -0.01em;
    margin-bottom: 14px; opacity: 0; animation: rise .7s ease .08s forwards;
  }
  .lede {
    font-size: 16px; color: var(--muted); max-width: 56ch;
    opacity: 0; animation: rise .7s ease .16s forwards;
  }
  .panel {
    background: var(--card); border: 1px solid var(--line); border-radius: 18px;
    padding: 28px; margin-top: 32px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
    opacity: 0; animation: rise .7s ease .24s forwards;
  }
  .ctrl { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
  .ctrl:last-of-type { margin-bottom: 4px; }
  .ctrl label { font-size: 14px; color: var(--muted); min-width: 78px; font-weight: 500; }
  .ctrl output {
    font-family: 'Fraunces', serif; font-size: 20px; font-weight: 500;
    min-width: 64px; text-align: right; color: var(--ink);
  }
  input[type=range] {
    flex: 1; -webkit-appearance: none; appearance: none;
    height: 5px; border-radius: 99px; background: var(--line); outline: none;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
    background: var(--green); border: 3px solid var(--card);
    box-shadow: 0 1px 4px rgba(15,110,86,0.4); cursor: pointer; transition: transform .12s;
  }
  input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.15); }
  input[type=range]::-moz-range-thumb {
    width: 20px; height: 20px; border-radius: 50%; background: var(--green);
    border: 3px solid var(--card); cursor: pointer;
  }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 28px; }
  .metric { background: var(--paper); border-radius: 12px; padding: 16px 18px; }
  .metric .k { font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
  .metric .v { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 500; }
  .metric.base .v { color: var(--green); }
  .metric.mine .v { color: var(--blue); }
  .verdict {
    margin-top: 16px; padding: 13px 16px; border-radius: 12px;
    font-size: 14.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;
  }
  .legend { display: flex; gap: 20px; margin: 26px 0 10px; font-size: 13px; color: var(--muted); }
  .legend span { display: flex; align-items: center; gap: 7px; }
  .swatch { width: 18px; height: 3px; border-radius: 2px; }
  .chart-box { position: relative; width: 100%; height: 330px; }
  .notes {
    margin-top: 30px; font-size: 13.5px; color: var(--muted); line-height: 1.7;
    border-top: 1px solid var(--line); padding-top: 20px;
    opacity: 0; animation: rise .7s ease .32s forwards;
  }
  .notes strong { color: var(--ink); font-weight: 600; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (max-width: 540px) {
    h1 { font-size: 27px; }
    .metrics { grid-template-columns: 1fr; }
    .panel { padding: 20px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">생애 자산 시뮬레이터</p>
  <h1>늦게 시작해도, 더 아끼거나 더 굴리면 따라잡을 수 있을까?</h1>
  <p class="lede">슬라이더로 취업 나이·저축률·연 수익률을 바꿔보세요. 25세에 시작해 저축률 33%·연 4%로 모은 기준선을, 당신의 시나리오가 65세 시점에 따라잡는지 보여줍니다.</p>

  <div class="panel">
    <div class="ctrl">
      <label for="sAge">취업 나이</label>
      <input type="range" id="sAge" min="25" max="45" step="1" value="40">
      <output id="oAge">40세</output>
    </div>
    <div class="ctrl">
      <label for="sSave">저축률</label>
      <input type="range" id="sSave" min="10" max="70" step="1" value="33">
      <output id="oSave">33%</output>
    </div>
    <div class="ctrl">
      <label for="sRet">연 수익률</label>
      <input type="range" id="sRet" min="2" max="12" step="0.5" value="4">
      <output id="oRet">4%</output>
    </div>

    <div class="metrics">
      <div class="metric base">
        <div class="k">기준선 · 25세 · 33% · 4%</div>
        <div class="v" id="mBase">–</div>
      </div>
      <div class="metric mine">
        <div class="k">내 시나리오 · 65세 자산</div>
        <div class="v" id="mMine">–</div>
      </div>
    </div>
    <div class="verdict" id="verdict"></div>

    <div class="legend">
      <span><span class="swatch" style="background:var(--green)"></span>기준선</span>
      <span><span class="swatch" style="background:var(--blue)"></span>내 시나리오</span>
    </div>
    <div class="chart-box">
      <canvas id="cu" role="img" aria-label="기준선과 내 시나리오의 누적 자산 비교 그래프">취업 나이·저축률·수익률에 따른 누적 자산 곡선 비교</canvas>
    </div>
  </div>

  <div class="notes">
    <strong>가정.</strong> 한국 임금근로자의 전형적 나이별 평균 월소득(20대 초반 약 200만원 → 40대 후반 약 450만원 정점 → 60대 초반 약 290만원)을 기준으로, 매년 소득의 일정 비율을 저축하고 연 복리 수익이 붙는다고 단순화했습니다. 65세까지 적립하며, 늦게 시작해도 시작 이후로는 동일한 소득 곡선을 따른다고 가정합니다. 실제 수익률은 변동하며 손실도 발생할 수 있습니다.<br><br>
    <strong>참고.</strong> 이 도구는 정보 제공용이며 특정 투자 권유가 아닙니다. 단순화된 모델이므로 실제 재무 판단은 본인 상황에 맞춰 내리시기 바랍니다.
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
  const labs = [25,30,35,40,45,50,55,60,65];
  const inc = (a) => a<25?200:a<30?270:a<35?340:a<40?390:a<45?430:a<50?450:a<55?440:a<60?400:290;
  function series(startAge, sr, r) {
    let bal = 0; const out = [];
    for (let a = 25; a <= 65; a++) {
      if (labs.includes(a)) out.push(Math.round(bal/1000)/10);
      if (a >= startAge && a < 65) bal = bal*(1+r) + inc(a)*12*sr;
    }
    return { s: out, final: bal/10000 };
  }
  const base = series(25, 0.33, 0.04);
  const fmt = (v) => '약 ' + (Math.round(v*10)/10) + '억';
  document.getElementById('mBase').textContent = fmt(base.final);

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const chart = new Chart(document.getElementById('cu'), {
    type: 'line',
    data: { labels: labs, datasets: [
      { label: '기준선', data: base.s, borderColor: '#0f6e56', backgroundColor: 'rgba(15,110,86,0.07)', borderWidth: 2.5, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#0f6e56', fill: false },
      { label: '내 시나리오', data: [], borderColor: '#185fa5', backgroundColor: 'rgba(24,95,165,0.10)', borderWidth: 2.5, borderDash: [6,5], tension: 0.4, pointRadius: 3, pointBackgroundColor: '#185fa5', pointStyle: 'rectRot', fill: true }
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + (c.parsed.y==null?'-':'약 '+c.parsed.y+'억원') } } },
      scales: {
        x: { title: { display: true, text: '나이 (세)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { autoSkip: false, color: '#5f6b63' } },
        y: { beginAtZero: true, title: { display: true, text: '누적 자산 (억원)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { callback: (v)=>v+'억', color: '#5f6b63' } }
      } }
  });

  function update() {
    const age = +document.getElementById('sAge').value;
    const sr = +document.getElementById('sSave').value / 100;
    const r = +document.getElementById('sRet').value / 100;
    document.getElementById('oAge').textContent = age + '세';
    document.getElementById('oSave').textContent = Math.round(sr*100) + '%';
    document.getElementById('oRet').textContent = (Math.round(r*1000)/10) + '%';
    const mine = series(age, sr, r);
    chart.data.datasets[1].data = mine.s.map((v,i) => labs[i] < age ? null : v);
    chart.update();
    document.getElementById('mMine').textContent = fmt(mine.final);
    const v = document.getElementById('verdict');
    const diff = mine.final - base.final;
    if (diff >= -0.3) {
      v.style.background = 'var(--success-bg)'; v.style.color = 'var(--success-tx)';
      v.textContent = '✓ 기준선을 따라잡았습니다 (' + (diff>=0?'+':'') + (Math.round(diff*10)/10) + '억).';
    } else {
      v.style.background = 'var(--warn-bg)'; v.style.color = 'var(--warn-tx)';
      v.textContent = '↓ 아직 약 ' + (Math.round(Math.abs(diff)*10)/10) + '억 부족합니다.';
    }
  }
  ['sAge','sSave','sRet'].forEach(id => document.getElementById(id).addEventListener('input', update));
  update();
</script>
</body>
</html>
