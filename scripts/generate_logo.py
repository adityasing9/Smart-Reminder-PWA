import math
from PIL import Image, ImageDraw, ImageFilter
import os

def generate_gradient(w, h, top_left=(13, 84, 76), bottom_right=(16, 185, 129)):
    # 64x64 gradient upscaled with bicubic
    gw, gh = 64, 64
    g_img = Image.new("RGBA", (gw, gh))
    pixels = g_img.load()
    for y in range(gh):
        for x in range(gw):
            t = (x + y) / (gw + gh)
            r = int(top_left[0] + (bottom_right[0] - top_left[0]) * t)
            g = int(top_left[1] + (bottom_right[1] - top_left[1]) * t)
            b = int(top_left[2] + (bottom_right[2] - top_left[2]) * t)
            pixels[x, y] = (r, g, b, 255)
    return g_img.resize((w, h), Image.BICUBIC)

def render_logo(size=512, is_round=False, foreground_only=False):
    scale = 2
    w = size * scale
    h = size * scale

    final = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    if not foreground_only:
        # Create gradient
        gradient = generate_gradient(w, h, (10, 50, 48), (16, 185, 129))
        
        # Mask
        mask = Image.new("L", (w, h), 0)
        mask_draw = ImageDraw.Draw(mask)
        pad = int(14 * scale)
        if is_round:
            mask_draw.ellipse([pad, pad, w - pad, h - pad], fill=255)
        else:
            radius = int(88 * scale)
            mask_draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=radius, fill=255)

        final.paste(gradient, (0, 0), mask)

        # Subtle specular inner border
        border_overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        border_draw = ImageDraw.Draw(border_overlay)
        if is_round:
            border_draw.ellipse([pad, pad, w - pad, h - pad], outline=(255, 255, 255, 45), width=int(2 * scale))
        else:
            border_draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=int(88 * scale), outline=(255, 255, 255, 45), width=int(2 * scale))
        final = Image.alpha_composite(final, border_overlay)

    # Now draw the foreground Clock & Reminder icon
    fg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fg)

    cx, cy = w / 2, h / 2
    clock_r = int(120 * scale)

    # 1. Bell Ear Bells at 10:00 and 2:00
    ear_dist = clock_r * 0.95
    ear_r = int(32 * scale)
    for angle_deg in [-50, 50]:
        rad = math.radians(angle_deg - 90)
        ex = cx + ear_dist * math.cos(rad)
        ey = cy + ear_dist * math.sin(rad)
        
        # Ear stem
        draw.line([cx + (clock_r * 0.7) * math.cos(rad), cy + (clock_r * 0.7) * math.sin(rad), ex, ey],
                  fill=(226, 232, 240, 255), width=int(10 * scale))
        # Ear bell
        draw.ellipse([ex - ear_r, ey - ear_r, ex + ear_r, ey + ear_r],
                     fill=(254, 243, 199, 255), outline=(245, 158, 11, 255), width=int(4 * scale))

    # 2. Clock Feet at bottom
    foot_dist = clock_r * 0.95
    foot_r = int(14 * scale)
    for angle_deg in [135, 225]:
        rad = math.radians(angle_deg)
        fx = cx + foot_dist * math.cos(rad)
        fy = cy + foot_dist * math.sin(rad)
        draw.line([cx + (clock_r * 0.75) * math.cos(rad), cy + (clock_r * 0.75) * math.sin(rad), fx, fy],
                  fill=(203, 213, 225, 255), width=int(12 * scale))

    # 3. Drop Shadow for main clock
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.ellipse([cx - clock_r, cy - clock_r + int(12 * scale), cx + clock_r, cy + clock_r + int(12 * scale)],
                   fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(10 * scale)))
    final = Image.alpha_composite(final, shadow)

    # 4. Main Clock Body (Pure gleaming white)
    draw.ellipse([cx - clock_r, cy - clock_r, cx + clock_r, cy + clock_r],
                 fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=int(4 * scale))

    # Inner Dial
    dial_r = clock_r - int(14 * scale)
    draw.ellipse([cx - dial_r, cy - dial_r, cx + dial_r, cy + dial_r],
                 fill=(248, 250, 252, 255))

    # Dial Hour Marks (12, 3, 6, 9)
    tick_len = int(12 * scale)
    tick_w = int(5 * scale)
    for hr_deg in [0, 90, 180, 270]:
        hr_rad = math.radians(hr_deg - 90)
        x1 = cx + (dial_r - int(6 * scale)) * math.cos(hr_rad)
        y1 = cy + (dial_r - int(6 * scale)) * math.sin(hr_rad)
        x2 = cx + (dial_r - int(6 * scale) - tick_len) * math.cos(hr_rad)
        y2 = cy + (dial_r - int(6 * scale) - tick_len) * math.sin(hr_rad)
        draw.line([x1, y1, x2, y2], fill=(148, 163, 184, 255), width=tick_w)

    # 5. Clock Hands at 10:10
    # Center Pin
    center_pin_r = int(10 * scale)

    # Hour Hand pointing to 10 o'clock (-60 deg)
    h_rad = math.radians(-60)
    h_len = dial_r * 0.52
    hx = cx + h_len * math.cos(h_rad)
    hy = cy + h_len * math.sin(h_rad)
    draw.line([cx, cy, hx, hy], fill=(30, 41, 59, 255), width=int(9 * scale))

    # Minute Hand pointing to 2 o'clock (+30 deg)
    m_rad = math.radians(30)
    m_len = dial_r * 0.72
    mx = cx + m_len * math.cos(m_rad)
    my = cy + m_len * math.sin(m_rad)
    draw.line([cx, cy, mx, my], fill=(16, 185, 129, 255), width=int(7 * scale))

    # Center Pin Cap
    draw.ellipse([cx - center_pin_r, cy - center_pin_r, cx + center_pin_r, cy + center_pin_r],
                 fill=(15, 23, 42, 255))

    # 6. Vibrant Reminder Checkmark Badge at bottom right of clock
    badge_cx = cx + int(76 * scale)
    badge_cy = cy + int(76 * scale)
    badge_r = int(48 * scale)

    # Badge shadow
    b_shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    b_sdraw = ImageDraw.Draw(b_shadow)
    b_sdraw.ellipse([badge_cx - badge_r, badge_cy - badge_r + int(6 * scale),
                     badge_cx + badge_r, badge_cy + badge_r + int(6 * scale)], fill=(0, 0, 0, 80))
    b_shadow = b_shadow.filter(ImageFilter.GaussianBlur(int(5 * scale)))
    final = Image.alpha_composite(final, b_shadow)

    # Badge Circle (Emerald green with white ring border)
    draw.ellipse([badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r],
                 fill=(16, 185, 129, 255), outline=(255, 255, 255, 255), width=int(6 * scale))

    # Checkmark inside badge
    # Points for checkmark: start, vertex, end
    chk_start = (badge_cx - int(20 * scale), badge_cy - int(2 * scale))
    chk_mid = (badge_cx - int(6 * scale), badge_cy + int(14 * scale))
    chk_end = (badge_cx + int(20 * scale), badge_cy - int(14 * scale))
    draw.line([chk_start, chk_mid], fill=(255, 255, 255, 255), width=int(8 * scale))
    draw.line([chk_mid, chk_end], fill=(255, 255, 255, 255), width=int(8 * scale))

    # 7. Subtle Sound / Reminder Waves (Vibration Rings)
    wave_color = (255, 255, 255, 210)
    wave_w = int(5 * scale)
    # Left ring wave
    draw.arc([cx - clock_r - int(32 * scale), cy - int(60 * scale),
              cx - clock_r + int(8 * scale), cy + int(40 * scale)],
             start=120, end=240, fill=wave_color, width=wave_w)
    draw.arc([cx - clock_r - int(52 * scale), cy - int(80 * scale),
              cx - clock_r - int(4 * scale), cy + int(60 * scale)],
             start=130, end=230, fill=(255, 255, 255, 140), width=wave_w)

    # Right ring wave
    draw.arc([cx + clock_r - int(8 * scale), cy - int(60 * scale),
              cx + clock_r + int(32 * scale), cy + int(40 * scale)],
             start=-60, end=60, fill=wave_color, width=wave_w)
    draw.arc([cx + clock_r + int(4 * scale), cy - int(80 * scale),
              cx + clock_r + int(52 * scale), cy + int(60 * scale)],
             start=-50, end=50, fill=(255, 255, 255, 140), width=wave_w)

    final = Image.alpha_composite(final, fg)
    return final.resize((size, size), Image.LANCZOS)

def main():
    base_res_dir = r"android/app/src/main/res"

    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }

    for dir_name, size in densities.items():
        folder = os.path.join(base_res_dir, dir_name)
        os.makedirs(folder, exist_ok=True)

        # 1. Standard Squircle Icon
        icon_standard = render_logo(size=size, is_round=False)
        icon_standard.save(os.path.join(folder, "ic_launcher.png"), "PNG")

        # 2. Round Icon
        icon_round = render_logo(size=size, is_round=True)
        icon_round.save(os.path.join(folder, "ic_launcher_round.png"), "PNG")

        # 3. Foreground Icon
        icon_fg = render_logo(size=size, is_round=False, foreground_only=True)
        icon_fg.save(os.path.join(folder, "ic_launcher_foreground.png"), "PNG")
        print(f"Generated {dir_name} ({size}x{size})")

    # Also save 512x512 high-res store icon
    store_icon = render_logo(size=512, is_round=False)
    store_icon.save(os.path.join(base_res_dir, "drawable", "splash.png"), "PNG")
    print("All icons successfully generated!")

if __name__ == "__main__":
    main()
