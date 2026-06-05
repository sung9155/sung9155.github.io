#!/usr/bin/env node
/* 탭별 정적 랜딩 페이지(<tab>.html) 생성기.
 * 각 탭 고유 OG 태그(제목·설명·이미지)로 카톡/SNS 미리보기를 차별화하고,
 * 사람이 열면 index.html#<tab> 으로 자동 이동한다. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://sung9155.github.io';
const BRAND = '단타 현실 시뮬레이터';

const tabs = {
  save:    ['늦게 시작해도 따라잡을 수 있을까? · ' + BRAND, '취업 나이·저축률·수익률을 바꿔 늦은 시작을 따라잡을 수 있는지 시뮬레이션. 단타가 아닌 길을 숫자로 봅니다.'],
  trade:   ['단타 vs 취업+적립, 5년 후 누가 이길까 · ' + BRAND, '승률 50%·손익비 1.0이어도 거래비용과 변동성 때문에 대부분 적립투자를 못 이깁니다. 1,000명 시뮬레이션으로 확인하세요.'],
  survive: ['단타로 생활하면 계좌는 언제 0원이 될까 · ' + BRAND, '무직 상태로 생활비를 단타로 충당할 때의 파산 시점·파산 확률을 1,000명 10년 시뮬레이션으로 보여줍니다.'],
  employ:  ['단타로 흘려보낸 시간 = 경력 공백 · ' + BRAND, '첫 취업까지 평균 11.5개월, 3년 이상 미취업 18.5%. 통계청 실제 수치로 보는 경력 공백의 대가.'],
  cost:    ['그 시간에 알바만 했어도 — 기회비용 · ' + BRAND, '단타에 쓰는 시간을 최저시급으로만 환산해도 얼마? 당신의 단타 실효 시급을 계산해 비교합니다.'],
  math:    ['한 번 크게 잃으면 — 손실 복구의 수학 · ' + BRAND, '-50%가 나면 +100%를 벌어야 본전. 손실의 비대칭성이 왜 단타를 회복 불가로 만드는지 보여줍니다.'],
  seed:    ['전업 트레이더로 먹고살려면 시드가 얼마? · ' + BRAND, '생활비를 투자수익으로 충당하는 데 필요한 시드를 역산. 월 250만원이면 약 5억이 필요합니다.'],
  hidden:  ['월급이 전부가 아니다 — 취업의 숨은 자산 · ' + BRAND, '퇴직금·4대보험 사용자 부담 등 월급 외 혜택을 금액화. 단타 무직에게는 0원인 것들.'],
  chip:    ['"반도체 호황이니 장만 타면 된다"는 착각 · ' + BRAND, '호황은 이미 가격에 반영됐고 반도체는 -50~-80% 폭락을 반복한 사이클 산업. 실제 폭락 기록으로 반박합니다.'],
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

for (const [name, [title, desc]] of Object.entries(tabs)) {
  const url = `${SITE}/${name}.html`;
  const img = `${SITE}/og/${name}.png`;
  const target = `index.html#${name}`;
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${SITE}/#${name}">
<script>location.replace(${JSON.stringify(target)});</script>
<meta http-equiv="refresh" content="0; url=${target}">
</head>
<body style="font-family:'Pretendard',sans-serif;background:#f6f3ec;color:#1c2420;padding:48px 20px;text-align:center">
<p>페이지로 이동 중입니다…</p>
<p>자동으로 넘어가지 않으면 <a href="${target}">여기를 눌러주세요</a>.</p>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
