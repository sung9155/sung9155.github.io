#!/usr/bin/env python3
"""탭별 OG 미리보기 이미지(1200x630 PNG) 생성기.
한글 렌더링: WenQuanYi Zen Hei (시스템 CJK 폰트). 굵게는 stroke_width로 흉내.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "og")
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"

W, H = 1200, 630
PAPER = (246, 243, 236)
CARD = (255, 253, 248)
INK = (28, 36, 32)
MUTED = (95, 107, 99)
COLORS = {
    "green": (15, 110, 86),
    "blue": (24, 95, 165),
    "red": (178, 58, 46),
    "gold": (176, 125, 34),
}

# 탭: (accent, eyebrow, headline, stat, substat)
TABS = {
    "save":    ("green", "생애 자산 시뮬레이터", "늦게 시작해도 따라잡을 수 있을까?", "복리", "취업·저축률·수익률로 직접 시뮬레이션"),
    "trade":   ("blue",  "단타 vs 취업+적립",    "5년 후, 누가 이길까?",            "대부분 패배", "승률 50%로도 적립투자를 못 이긴다"),
    "survive": ("red",   "단타로 생존 시뮬레이터", "생활비를 단타로 충당하면",        "파산", "계좌가 0원이 되는 시점·확률"),
    "employ":  ("gold",  "취업 난이도 · 실데이터", "흘려보낸 시간 = 경력 공백",       "11.5개월", "첫 취업까지 평균 (역대 최장)"),
    "cost":    ("blue",  "시간의 기회비용",       "그 시간에 알바만 했어도",         "기회비용", "당신의 단타 실효 시급은 얼마?"),
    "math":    ("red",   "손실 복구의 수학",      "한 번 크게 잃으면",              "-50% → +100%", "잃은 만큼 벌어선 본전이 안 된다"),
    "seed":    ("gold",  "전업 필요 시드",        "전업으로 먹고살려면?",            "약 5억", "월 250만원 충당에 필요한 시드"),
    "hidden":  ("green", "취업의 숨은 자산",      "월급이 전부가 아니다",            "+17%", "퇴직금·4대보험… 단타 무직은 0원"),
    "chip":    ("red",   "반도체 호황만 믿고",    "‘장만 타면 된다’는 착각",         "-80%", "SOX 닷컴버블 낙폭 · 반도체는 사이클"),
}


def font(sz):
    return ImageFont.truetype(FONT, sz, index=0)


def text_w(draw, s, f):
    return draw.textlength(s, font=f)


def wrap(draw, s, f, max_w):
    words, lines, cur = list(s), [], ""
    # 한글은 공백 단위가 적어 글자 단위로 줄바꿈
    for ch in s:
        if text_w(draw, cur + ch, f) <= max_w:
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def fit_font(draw, s, start, min_sz, max_w):
    sz = start
    while sz > min_sz and text_w(draw, s, font(sz)) > max_w:
        sz -= 4
    return font(sz), sz


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def make(name, accent, eyebrow, headline, stat, substat):
    ac = COLORS[accent]
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    M = 92
    # 카드
    rounded(d, (40, 40, W - 40, H - 40), 36, CARD)
    # 우상단 은은한 원 (헤드라인 영역과 겹치지 않게 상단에 배치)
    soft = tuple(int(c + (255 - c) * 0.9) for c in ac)
    d.ellipse((W - 300, -180, W + 140, 220), fill=soft)
    # 하단 액센트 바
    d.rectangle((40, H - 56, W - 40, H - 44), fill=ac)

    # eyebrow
    d.text((M, 86), eyebrow, font=font(30), fill=ac, stroke_width=1, stroke_fill=ac)

    # headline (최대 2줄로 제한)
    fh = font(60)
    lines = wrap(d, headline, fh, W - 2 * M - 120)
    if len(lines) > 2:
        fh = font(50)
        lines = wrap(d, headline, fh, W - 2 * M - 80)
    if len(lines) > 2:
        fh = font(42)
        lines = wrap(d, headline, fh, W - 2 * M)[:2]
    y = 152
    for ln in lines:
        d.text((M, y), ln, font=fh, fill=INK, stroke_width=1, stroke_fill=INK)
        y += fh.size + 14

    # 하단부터 역산해 고정 배치 (겹침 방지)
    furl = font(28)
    d.text((M, H - 96), "sung9155.github.io", font=furl, fill=MUTED)

    fsub, _ = fit_font(d, substat, 33, 22, W - 2 * M)
    sub_y = H - 96 - fsub.size - 22
    d.text((M, sub_y), substat, font=fsub, fill=MUTED)

    fstat, ssz = fit_font(d, stat, 104, 56, W - 2 * M)
    stat_y = sub_y - ssz - 16
    d.text((M, stat_y), stat, font=fstat, fill=ac, stroke_width=2, stroke_fill=ac)

    img.save(os.path.join(OUT, name + ".png"), "PNG")
    print("wrote og/%s.png" % name)


if __name__ == "__main__":
    for name, args in TABS.items():
        make(name, *args)
