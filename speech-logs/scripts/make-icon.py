"""이모지 기반 커스텀 ICO 생성기. 여러 아이콘을 한 번에 생성.

각 아이콘은 '둥근 사각형 배경 + 컬러 이모지' 구성. 멀티사이즈 ICO로 저장해서
탐색기 어느 확대율에서도 선명.

Run:
    python scripts/make-icon.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 512
PADDING = 24
CORNER_RADIUS = 96
EMOJI_FONT = r"C:\Windows\Fonts\seguiemj.ttf"
SAVE_SIZES = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]

# 이모지마다 실제 시각 크기/비율이 달라서 per-icon 튜닝
ICONS = [
    {
        "name": "speech-log",
        "emoji": "🎤",
        "bg": (224, 196, 244),    # 연한 라벤더
        "accent": (170, 140, 210),
        "emoji_size": 340,
        "dy": 10,                 # 마이크는 세로로 길어서 살짝 아래 정렬
        "out": Path(r"C:\Dev\speech-logs\assets\speech-log.ico"),
    },
    {
        "name": "daily-report",
        "emoji": "🌞",            # ☀️는 VS16 선택자 때문에 PIL anchor 어긋남 → 단일 codepoint 이모지로
        "bg": (255, 238, 180),    # 크림 옐로우 (따뜻한 아침)
        "accent": (230, 170, 60),  # 골든 오렌지
        "emoji_size": 340,
        "dy": 10,
        "out": Path(r"C:\Dev\personal-hub\assets\daily-report.ico"),
    },
]


def build_icon(cfg):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle(
        [PADDING, PADDING, SIZE - PADDING, SIZE - PADDING],
        radius=CORNER_RADIUS,
        fill=cfg["bg"] + (255,),
        outline=cfg["accent"] + (255,),
        width=3,
    )

    font = ImageFont.truetype(EMOJI_FONT, cfg["emoji_size"])
    draw.text(
        (SIZE // 2, SIZE // 2 + cfg["dy"]),
        cfg["emoji"],
        font=font,
        anchor="mm",
        embedded_color=True,
    )

    cfg["out"].parent.mkdir(parents=True, exist_ok=True)
    img.save(cfg["out"], format="ICO", sizes=SAVE_SIZES)
    print(f"Created: {cfg['out']}")


def main():
    for cfg in ICONS:
        build_icon(cfg)


if __name__ == "__main__":
    main()
