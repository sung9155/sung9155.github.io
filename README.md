<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>취업 대신 단타? · 숫자로 보는 현실 시뮬레이터</title>
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
    --danger: #b3402e;
    --danger-soft: rgba(179,64,46,0.10);
    --success-bg: #e3f1ea;
    --success-tx: #0c5640;
    --warn-bg: #f7ecd7;
    --warn-tx: #8a5c0e;
    --danger-bg: #f7e2dc;
    --danger-tx: #8f2f20;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Pretendard', sans-serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.6;
    padding: 48px 20px 72px;
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
  h2 {
    font-family: 'Fraunces', 'Pretendard', serif;
    font-weight: 500; font-size: 25px; line-height: 1.3; letter-spacing: -0.01em;
    margin-bottom: 10px;
  }
  .lede {
    font-size: 16px; color: var(--muted); max-width: 56ch;
    opacity: 0; animation: rise .7s ease .16s forwards;
  }
  .section { margin-top: 56px; opacity: 0; animation: rise .7s ease forwards; }
  .section .eyebrow { animation: none; opacity: 1; }
  .section-lede { font-size: 15px; color: var(--muted); max-width: 58ch; margin-top: 2px; }
  .divider { height: 1px; background: var(--line); margin: 64px 0 0; border: 0; }
  .panel {
    background: var(--card); border: 1px solid var(--line); border-radius: 18px;
    padding: 28px; margin-top: 24px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
  }
  .hero-panel { margin-top: 32px; opacity: 0; animation: rise .7s ease .24s forwards; }
  .ctrl { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
  .ctrl:last-of-type { margin-bottom: 4px; }
  .ctrl label { font-size: 14px; color: var(--muted); min-width: 96px; font-weight: 500; }
  .ctrl output {
    font-family: 'Fraunces', serif; font-size: 19px; font-weight: 500;
    min-width: 72px; text-align: right; color: var(--ink);
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
  input.blue::-webkit-slider-thumb { background: var(--blue); box-shadow: 0 1px 4px rgba(24,95,165,0.4); }
  input.blue::-moz-range-thumb { background: var(--blue); }
  input.danger::-webkit-slider-thumb { background: var(--danger); box-shadow: 0 1px 4px rgba(179,64,46,0.4); }
  input.danger::-moz-range-thumb { background: var(--danger); }
  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 28px; }
  .metric { background: var(--paper); border-radius: 12px; padding: 16px 18px; }
  .metric .k { font-size: 12.5px; color: var(--muted); margin-bottom: 6px; }
  .metric .v { font-family: 'Fraunces', serif; font-size: 27px; font-weight: 500; }
  .metric.base .v, .metric.job .v { color: var(--green); }
  .metric.mine .v, .metric.trade .v { color: var(--blue); }
  .metric.ruin .v { color: var(--danger); }
  .verdict {
    margin-top: 16px; padding: 13px 16px; border-radius: 12px;
    font-size: 14.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;
  }
  .legend { display: flex; flex-wrap: wrap; gap: 20px; margin: 26px 0 10px; font-size: 13px; color: var(--muted); }
  .legend span { display: flex; align-items: center; gap: 7px; }
  .swatch { width: 18px; height: 3px; border-radius: 2px; }
  .chart-box { position: relative; width: 100%; height: 330px; }
  .notes {
    margin-top: 30px; font-size: 13.5px; color: var(--muted); line-height: 1.7;
    border-top: 1px solid var(--line); padding-top: 20px;
  }
  .notes strong { color: var(--ink); font-weight: 600; }
  .footer-notes { margin-top: 56px; opacity: 0; animation: rise .7s ease forwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (max-width: 540px) {
    h1 { font-size: 27px; }
    h2 { font-size: 22px; }
    .metrics { grid-template-columns: 1fr; }
    .panel { padding: 20px; }
    .ctrl { flex-wrap: wrap; }
    .ctrl label { min-width: 100%; }
  }
</style>
</head>
<body>
<div class="wrap">

  <p class="eyebrow">현실 자각 시뮬레이터</p>
  <h1>취업 대신 단타로 살아간다면, 숫자는 뭐라고 말할까?</h1>
  <p class="lede">"단타로 충분히 벌 수 있다"는 직감을, 세 가지 시뮬레이터로 검증해 봅니다. 슬라이더를 직접 움직여 보세요. 막연한 기대 대신 누적 자산 곡선과 파산 확률이라는 숫자가 답합니다.</p>

  <!-- ───────── 시뮬레이터 ①: 늦게 시작해도 따라잡을 수 있을까 ───────── -->
  <section class="section" style="animation-delay:.24s; margin-top:40px">
    <p class="eyebrow">시뮬레이터 ① · 생애 자산</p>
    <h2>늦게 시작해도, 더 아끼거나 더 굴리면 따라잡을 수 있을까?</h2>
    <p class="section-lede">취업 나이·저축률·연 수익률을 바꿔보세요. 25세에 시작해 저축률 33%·연 4%로 모은 기준선을, 당신의 시나리오가 65세 시점에 따라잡는지 보여줍니다.</p>

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
  </section>

  <hr class="divider">

  <!-- ───────── 시뮬레이터 ②: 단타 vs 취업+적립 ───────── -->
  <section class="section">
    <p class="eyebrow" style="color:var(--blue)">시뮬레이터 ② · 단타 vs 취업+적립</p>
    <h2>단타로 굴리면, 취업해서 매달 적립하는 사람을 이길 수 있을까?</h2>
    <p class="section-lede">두 사람이 같은 종잣돈으로 출발합니다. 한 명은 취업해 매달 일정액을 적립하며 지수에 연 7%로 투자하고, 다른 한 명은 그 종잣돈만 단타로 굴립니다(추가 입금 없음 — 월급이 없으니까요). 단타 연환산 수익률을 바꿔가며 누가 앞서는지 보세요.</p>

    <div class="panel">
      <div class="ctrl">
        <label for="sDeposit">월 적립액</label>
        <input type="range" id="sDeposit" min="10" max="300" step="10" value="100">
        <output id="oDeposit">100만원</output>
      </div>
      <div class="ctrl">
        <label for="sYears">투자 기간</label>
        <input type="range" id="sYears" min="5" max="40" step="1" value="20">
        <output id="oYears">20년</output>
      </div>
      <div class="ctrl">
        <label for="sDay">단타 연환산 수익률</label>
        <input type="range" id="sDay" class="blue" min="-40" max="40" step="1" value="-8">
        <output id="oDay">-8%</output>
      </div>

      <div class="metrics">
        <div class="metric job">
          <div class="k">취업 + 적립 (지수 연 7%)</div>
          <div class="v" id="mJob">–</div>
        </div>
        <div class="metric trade">
          <div class="k">단타 (종잣돈만 굴림)</div>
          <div class="v" id="mTrade">–</div>
        </div>
      </div>
      <div class="verdict" id="verdict2"></div>

      <div class="legend">
        <span><span class="swatch" style="background:var(--green)"></span>취업 + 적립</span>
        <span><span class="swatch" style="background:var(--blue)"></span>단타</span>
      </div>
      <div class="chart-box">
        <canvas id="cmp" role="img" aria-label="취업 적립 경로와 단타 경로의 누적 자산 비교 그래프">취업+적립 vs 단타 누적 자산 비교</canvas>
      </div>
      <div class="notes">
        <strong>왜 이렇게 차이가 날까.</strong> 단타로 연 20~30%를 "꾸준히" 내도, 새 자본이 들어오지 않으면 종잣돈 하나만 불립니다. 반면 취업한 사람은 매달 월급의 일부를 새로 넣고 그게 복리로 굴러갑니다. 게다가 여러 연구에서 개인 단타 투자자의 다수는 수수료·세금·잦은 매매로 장기적으로 시장 평균을 밑돌거나 손실을 봅니다. 슬라이더를 현실적인 값(0% 안팎 또는 마이너스)에 두고 비교해 보세요.
      </div>
    </div>
  </section>

  <hr class="divider">

  <!-- ───────── 시뮬레이터 ③: 단타로 생활하면 통장은 얼마나 버틸까 ───────── -->
  <section class="section">
    <p class="eyebrow" style="color:var(--danger)">시뮬레이터 ③ · 단타로 생존</p>
    <h2>월급 없이 단타 수익만으로 생활하면, 통장은 얼마나 버틸까?</h2>
    <p class="section-lede">취업하지 않고 단타 수익으로 생활비를 충당하는 상황을, 무작위 변동을 반영해 600번 반복 시뮬레이션합니다. 매달 수익(또는 손실)이 나고, 거기서 생활비를 빼며 10년을 버텨봅니다. 통장이 0원이 되면 파산입니다.</p>

    <div class="panel">
      <div class="ctrl">
        <label for="sCap">초기 자본</label>
        <input type="range" id="sCap" class="danger" min="500" max="10000" step="100" value="3000">
        <output id="oCap">3,000만원</output>
      </div>
      <div class="ctrl">
        <label for="sExp">월 생활비</label>
        <input type="range" id="sExp" class="danger" min="50" max="500" step="10" value="200">
        <output id="oExp">200만원</output>
      </div>
      <div class="ctrl">
        <label for="sMean">단타 월 평균 수익률</label>
        <input type="range" id="sMean" class="danger" min="-3" max="5" step="0.1" value="0.5">
        <output id="oMean">0.5%</output>
      </div>
      <div class="ctrl">
        <label for="sVol">월 변동성</label>
        <input type="range" id="sVol" class="danger" min="3" max="40" step="1" value="15">
        <output id="oVol">15%</output>
      </div>

      <div class="metrics">
        <div class="metric ruin">
          <div class="k">10년 내 파산 확률</div>
          <div class="v" id="mRuin">–</div>
        </div>
        <div class="metric ruin">
          <div class="k">자금 소진 중앙값</div>
          <div class="v" id="mMedian">–</div>
        </div>
      </div>
      <div class="verdict" id="verdict3"></div>

      <div class="legend">
        <span><span class="swatch" style="background:var(--danger)"></span>아직 버티는 사람의 비율</span>
      </div>
      <div class="chart-box">
        <canvas id="surv" role="img" aria-label="시간에 따른 생존(파산하지 않은) 비율 곡선">개월별 생존 비율 곡선</canvas>
      </div>
      <div class="notes">
        <strong>이게 핵심입니다.</strong> 평균 수익률이 플러스여도, 변동성이 크면 손실이 난 달에도 생활비는 똑같이 빠져나갑니다. 한 번 크게 깨지면 회복에 필요한 수익률은 더 커지고(–50%를 만회하려면 +100% 필요), 생활비 인출이 그 회복을 계속 갉아먹습니다. 그래서 "평균적으로는 벌 수 있을 것 같은" 설정에서도 상당수 경로가 파산으로 끝납니다. 변동성 슬라이더를 단타답게 높여 보세요.
      </div>
    </div>
  </section>

  <!-- ───────── 공통 주석 ───────── -->
  <div class="footer-notes">
    <div class="notes" style="border-top:1px solid var(--line)">
      <strong>가정과 한계.</strong> 모든 시뮬레이터는 현실을 크게 단순화한 교육용 모델입니다. ①은 한국 임금근로자의 나이별 평균 월소득 곡선(20대 초 약 200만원 → 40대 후 약 450만원 정점 → 60대 초 약 290만원)을 기준으로 연 복리 적립을 가정합니다. ②의 지수 연 7%, ③의 무작위 변동(정규분포 가정)은 설명을 위한 단순 가정이며 실제 시장과 다릅니다.<br><br>
      <strong>참고.</strong> 이 페이지는 정보 제공·교육 목적이며 특정 투자 권유나 재무 조언이 아닙니다. 실제 수익률은 변동하며 손실이 발생할 수 있고, 단타(초단기 매매)는 일반적으로 높은 위험을 동반합니다. 중요한 재무 판단은 본인의 상황과 전문가 조언을 바탕으로 내리시기 바랍니다.
    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
  const $ = (id) => document.getElementById(id);

  /* ───────── 시뮬레이터 ① ───────── */
  (function () {
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
    $('mBase').textContent = fmt(base.final);

    const chart = new Chart($('cu'), {
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
      const age = +$('sAge').value;
      const sr = +$('sSave').value / 100;
      const r = +$('sRet').value / 100;
      $('oAge').textContent = age + '세';
      $('oSave').textContent = Math.round(sr*100) + '%';
      $('oRet').textContent = (Math.round(r*1000)/10) + '%';
      const mine = series(age, sr, r);
      chart.data.datasets[1].data = mine.s.map((v,i) => labs[i] < age ? null : v);
      chart.update();
      $('mMine').textContent = fmt(mine.final);
      const v = $('verdict');
      const diff = mine.final - base.final;
      if (diff >= -0.3) {
        v.style.background = 'var(--success-bg)'; v.style.color = 'var(--success-tx)';
        v.textContent = '✓ 기준선을 따라잡았습니다 (' + (diff>=0?'+':'') + (Math.round(diff*10)/10) + '억).';
      } else {
        v.style.background = 'var(--warn-bg)'; v.style.color = 'var(--warn-tx)';
        v.textContent = '↓ 아직 약 ' + (Math.round(Math.abs(diff)*10)/10) + '억 부족합니다.';
      }
    }
    ['sAge','sSave','sRet'].forEach(id => $(id).addEventListener('input', update));
    update();
  })();

  /* ───────── 시뮬레이터 ②: 단타 vs 취업+적립 ───────── */
  (function () {
    const SEED = 1000;          // 두 사람의 동일 종잣돈 (만원)
    const IDX = 0.07;           // 지수투자 연 수익률 (가정)
    const fmtA = (won) => '약 ' + (Math.round(won/1000)/10) + '억';

    const chart = new Chart($('cmp'), {
      type: 'line',
      data: { labels: [], datasets: [
        { label: '취업 + 적립', data: [], borderColor: '#0f6e56', backgroundColor: 'rgba(15,110,86,0.08)', borderWidth: 2.5, tension: 0.35, pointRadius: 0, fill: true },
        { label: '단타', data: [], borderColor: '#185fa5', backgroundColor: 'rgba(24,95,165,0.06)', borderWidth: 2.5, borderDash: [6,5], tension: 0.35, pointRadius: 0, fill: false }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + (c.parsed.y==null?'-':'약 '+c.parsed.y+'억원') } } },
        scales: {
          x: { title: { display: true, text: '경과 (년)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { color: '#5f6b63', maxTicksLimit: 11 } },
          y: { beginAtZero: true, title: { display: true, text: '자산 (억원)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { callback: (v)=>v+'억', color: '#5f6b63' } }
        } }
    });

    function update() {
      const dep = +$('sDeposit').value;     // 월 적립 (만원)
      const yrs = +$('sYears').value;        // 기간 (년)
      const day = +$('sDay').value / 100;    // 단타 연환산 수익률
      $('oDeposit').textContent = dep + '만원';
      $('oYears').textContent = yrs + '년';
      $('oDay').textContent = (day>=0?'+':'') + Math.round(day*100) + '%';

      const labels = [], job = [], trade = [];
      let jBal = SEED, tBal = SEED;
      const mIdx = Math.pow(1+IDX, 1/12) - 1;     // 월 환산 지수 수익률
      const mDay = Math.pow(1+Math.max(day,-0.99), 1/12) - 1; // 월 환산 단타 수익률
      for (let m = 0; m <= yrs*12; m++) {
        if (m % 12 === 0) {
          labels.push(m/12);
          job.push(Math.round(jBal/1000)/10);
          trade.push(Math.round(tBal/1000)/10);
        }
        jBal = jBal*(1+mIdx) + dep;   // 적립 후 복리
        tBal = tBal*(1+mDay);         // 추가 입금 없이 복리
      }
      chart.data.labels = labels;
      chart.data.datasets[0].data = job;
      chart.data.datasets[1].data = trade;
      chart.update();

      $('mJob').textContent = fmtA(jBal);
      $('mTrade').textContent = fmtA(tBal);
      const v = $('verdict2');
      const gap = (jBal - tBal) / 10000;   // 억
      if (jBal >= tBal) {
        v.style.background = 'var(--success-bg)'; v.style.color = 'var(--success-tx)';
        v.textContent = '→ 취업+적립이 약 ' + (Math.round(Math.abs(gap)*10)/10) + '억 앞섭니다. 단타가 이기려면 ' + yrs + '년간 손실 없이 더 높은 수익률을 유지해야 합니다.';
      } else {
        v.style.background = 'var(--warn-bg)'; v.style.color = 'var(--warn-tx)';
        v.textContent = '↑ 이 설정에선 단타가 약 ' + (Math.round(Math.abs(gap)*10)/10) + '억 앞섭니다 — 단, 이 수익률을 ' + yrs + '년간 한 해도 빠짐없이 내야 가능합니다.';
      }
    }
    ['sDeposit','sYears','sDay'].forEach(id => $(id).addEventListener('input', update));
    update();
  })();

  /* ───────── 시뮬레이터 ③: 단타로 생존 (몬테카를로) ───────── */
  (function () {
    const PATHS = 600, MONTHS = 120;
    // 입력값으로부터 시드를 만들어, 같은 설정이면 결과가 안정적으로 재현되게 함
    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function gauss(rng) { // Box-Muller
      let u = 0, v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
    }

    const chart = new Chart($('surv'), {
      type: 'line',
      data: { labels: Array.from({length: MONTHS+1}, (_,i)=>i), datasets: [
        { label: '생존 비율', data: [], borderColor: '#b3402e', backgroundColor: 'rgba(179,64,46,0.10)', borderWidth: 2.5, tension: 0.25, pointRadius: 0, fill: true }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { title: (c)=> Math.round(c[0].parsed.x) + '개월 (' + (Math.round(c[0].parsed.x/12*10)/10) + '년)', label: (c)=> '아직 버티는 비율: ' + c.parsed.y + '%' } } },
        scales: {
          x: { type: 'linear', min: 0, max: MONTHS, title: { display: true, text: '경과 (개월)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { color: '#5f6b63', stepSize: 12 } },
          y: { min: 0, max: 100, title: { display: true, text: '파산하지 않은 비율 (%)' }, grid: { color: 'rgba(28,36,32,0.06)' }, ticks: { callback: (v)=>v+'%', color: '#5f6b63' } }
        } }
    });

    function update() {
      const cap = +$('sCap').value;          // 만원
      const exp = +$('sExp').value;          // 만원
      const mean = +$('sMean').value / 100;  // 월 평균
      const vol = +$('sVol').value / 100;    // 월 변동성
      $('oCap').textContent = cap.toLocaleString() + '만원';
      $('oExp').textContent = exp + '만원';
      $('oMean').textContent = (mean>=0?'+':'') + (Math.round(mean*1000)/10) + '%';
      $('oVol').textContent = Math.round(vol*100) + '%';

      const rng = mulberry32(Math.floor(cap*7 + exp*131 + mean*97000 + vol*53000) | 0);
      const aliveAt = new Array(MONTHS+1).fill(0);  // 각 시점 생존 경로 수
      const ruinMonth = [];                          // 파산한 경로의 파산 시점
      for (let p = 0; p < PATHS; p++) {
        let bal = cap, alive = true;
        aliveAt[0]++;
        for (let m = 1; m <= MONTHS; m++) {
          if (alive) {
            const r = mean + vol * gauss(rng);
            bal = bal * (1 + r) - exp;
            if (bal <= 0) { alive = false; ruinMonth.push(m); }
          }
          if (alive) aliveAt[m]++;
        }
      }
      chart.data.datasets[0].data = aliveAt.map(n => Math.round(n / PATHS * 1000) / 10);
      chart.update();

      const ruinCount = ruinMonth.length;
      const ruinPct = Math.round(ruinCount / PATHS * 1000) / 10;
      $('mRuin').textContent = ruinPct + '%';

      // 자금 소진 중앙값: 전체 경로의 절반이 파산하는 시점
      let medianTxt = '10년+';
      let cum = 0; const sorted = ruinMonth.slice().sort((a,b)=>a-b);
      if (ruinCount >= PATHS / 2) {
        const medMonth = sorted[Math.floor(PATHS/2) - 1];
        medianTxt = medMonth + '개월';
      }
      $('mMedian').textContent = medianTxt;

      const v = $('verdict3');
      if (ruinPct >= 50) {
        v.style.background = 'var(--danger-bg)'; v.style.color = 'var(--danger-tx)';
        v.textContent = '⚠ 절반 이상(' + ruinPct + '%)이 10년 안에 파산합니다. 평균이 플러스여도 변동성과 생활비 인출이 통장을 무너뜨립니다.';
      } else if (ruinPct >= 15) {
        v.style.background = 'var(--warn-bg)'; v.style.color = 'var(--warn-tx)';
        v.textContent = '△ ' + ruinPct + '%가 파산합니다. "운이 나쁘면 끝"인 게임에 생계를 걸고 있는 셈입니다.';
      } else {
        v.style.background = 'var(--success-bg)'; v.style.color = 'var(--success-tx)';
        v.textContent = '○ 이 설정의 파산 확률은 ' + ruinPct + '%. 다만 이 정도로 안정적인 수익·낮은 변동성은 현실의 단타와는 거리가 멉니다.';
      }
    }
    ['sCap','sExp','sMean','sVol'].forEach(id => $(id).addEventListener('input', update));
    update();
  })();
</script>
</body>
</html>
