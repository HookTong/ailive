#!/usr/bin/env python3
"""
生成5个氛围音效文件 - 纯标准库版本，无需numpy
"""

import wave
import struct
import random
import math
import os

SAMPLE_RATE = 44100

def save_wav(filename, samples):
    """保存样本列表为WAV文件"""
    filepath = os.path.join('public/audio', filename)
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(SAMPLE_RATE)
        # 转换为16位整数并写入
        data = b''.join(struct.pack('h', int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
        wav_file.writeframes(data)
    print(f"✅ 生成: {filepath} ({len(samples)/SAMPLE_RATE:.1f}秒)")

def generate_rain(duration=30.0, intensity=0.3):
    """生成雨声 - 使用滤波后的白噪音"""
    samples = int(SAMPLE_RATE * duration)
    audio = []
    prev = 0.0
    for _ in range(samples):
        # 粉红噪音近似
        white = random.uniform(-1, 1)
        prev = 0.95 * prev + 0.05 * white
        # 添加随机雨滴
        drop = 0
        if random.random() < 0.001:  # 随机雨滴
            drop = random.uniform(-0.5, 0.5)
        audio.append((prev + drop) * intensity)
    return audio

def generate_keyboard_typing(duration=10.0):
    """生成键盘打字声"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    num_keys = int(duration * 4)
    for _ in range(num_keys):
        pos = random.randint(0, samples - 2000)
        click_len = random.randint(200, 600)
        for i in range(click_len):
            if pos + i < samples:
                decay = math.exp(-i / 100)
                audio[pos + i] += random.uniform(-0.5, 0.5) * decay * 0.4
    return audio

def generate_ambient_hum(duration=30.0):
    """生成房间环境嗡嗡声"""
    samples = int(SAMPLE_RATE * duration)
    audio = []
    for i in range(samples):
        t = i / SAMPLE_RATE
        # 60Hz 基础嗡嗡声 + 谐波
        hum = math.sin(2 * math.pi * 60 * t) * 0.1
        hum += math.sin(2 * math.pi * 120 * t) * 0.05
        hum += math.sin(2 * math.pi * 180 * t) * 0.02
        # 轻微调制
        hum *= (1 + 0.1 * math.sin(2 * math.pi * 0.5 * t))
        # 轻微噪音
        noise = random.uniform(-0.05, 0.05)
        audio.append((hum + noise) * 0.25)
    return audio

def generate_neon_pulse(duration=20.0):
    """生成赛博朋克霓虹灯脉冲氛围音"""
    samples = int(SAMPLE_RATE * duration)
    audio = []
    pulse_times = [random.uniform(0, duration) for _ in range(int(duration * 2))]
    for i in range(samples):
        t = i / SAMPLE_RATE
        # 基础合成器pad
        val = math.sin(2 * math.pi * 55 * t) * 0.1 * (1 + 0.3 * math.sin(2 * math.pi * 0.2 * t))
        val += math.sin(2 * math.pi * 110 * t) * 0.08 * (1 + 0.2 * math.sin(2 * math.pi * 0.3 * t + 1))
        val += math.sin(2 * math.pi * 220 * t) * 0.02
        # 霓虹灯脉冲
        for pt in pulse_times:
            diff = abs(t - pt)
            if diff < 0.5:
                val += math.sin(2 * math.pi * 50 * diff) * math.exp(-diff * 5) * 0.1
        val += random.uniform(-0.02, 0.02)
        audio.append(val * 0.35)
    return audio

def generate_city_distant(duration=30.0):
    """生成远处城市环境音"""
    samples = int(SAMPLE_RATE * duration)
    audio = []
    prev = 0.0
    car_events = [random.uniform(0, duration) for _ in range(int(duration * 0.3))]
    for i in range(samples):
        t = i / SAMPLE_RATE
        # 基础噪音
        white = random.uniform(-1, 1)
        prev = 0.9 * prev + 0.1 * white
        val = prev * 0.1
        # 低频隆隆
        val += math.sin(2 * math.pi * 40 * t) * 0.04
        val += math.sin(2 * math.pi * 80 * t) * 0.02
        # 偶尔的车经过
        for ct in car_events:
            diff = abs(t - ct)
            if diff < 5.0:
                val += random.uniform(-0.3, 0.3) * math.exp(-((diff/2)**2)) * 0.15
        audio.append(val * 0.3)
    return audio

def main():
    os.makedirs('public/audio', exist_ok=True)
    print("🎵 开始生成氛围音效（纯Python，无需额外库）...\n")

    # 1. 雨声
    print("🌧️ 生成雨声白噪音...")
    rain = generate_rain(duration=30.0, intensity=0.35)
    save_wav('01-rain-city.wav', rain)

    # 2. 键盘打字
    print("⌨️ 生成键盘打字声...")
    keyboard = generate_keyboard_typing(duration=15.0)
    save_wav('02-keyboard-typing.wav', keyboard)

    # 3. 房间环境音
    print("🌀 生成房间环境嗡嗡声...")
    ambient = generate_ambient_hum(duration=30.0)
    save_wav('03-room-ambient.wav', ambient)

    # 4. 赛博朋克霓虹脉冲
    print("🌃 生成赛博朋克氛围音...")
    neon = generate_neon_pulse(duration=25.0)
    save_wav('04-cyberpunk-neon.wav', neon)

    # 5. 远处城市
    print("🏙️ 生成远处城市环境音...")
    city = generate_city_distant(duration=30.0)
    save_wav('05-city-distant.wav', city)

    print("\n✨ 全部生成完成！文件保存在 public/audio/ 目录")
    print("\n📋 使用建议：")
    print("   01-rain-city.wav      → 搭配 bg_lofi.png 背景")
    print("   02-keyboard-typing.wav → 交互音效（鲸鱼娘打字时触发）")
    print("   03-room-ambient.wav   → 底层环境音（低音量循环）")
    print("   04-cyberpunk-neon.wav → 搭配 bg_cyberpunk.png")
    print("   05-city-distant.wav   → 搭配 bg_cinematic.png")
    print("\n⚠️  这些是程序化生成的简单音效，建议替换为高质量真实录音")
    print("   参考 README-AUDIO.md 中的外部资源链接下载更好的音频")

if __name__ == '__main__':
    main()
