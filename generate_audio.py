#!/usr/bin/env python3
"""
生成5个氛围音效文件用于鲸鱼娘电竞房间
"""

import numpy as np
import wave
import struct
import os

SAMPLE_RATE = 44100

def save_wav(filename, samples):
    """保存numpy数组为WAV文件"""
    filepath = os.path.join('public/audio', filename)
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(SAMPLE_RATE)
        # 转换为16位整数
        samples = np.clip(samples, -1.0, 1.0)
        samples = (samples * 32767).astype(np.int16)
        wav_file.writeframes(samples.tobytes())
    print(f"✅ 生成: {filepath} ({len(samples)/SAMPLE_RATE:.1f}秒)")

def generate_rain(duration=30.0, intensity=0.3):
    """生成雨声 - 使用粉红噪音模拟"""
    samples = int(SAMPLE_RATE * duration)
    # 白噪音
    white = np.random.randn(samples)
    # 简单的一阶滤波模拟粉红噪音
    pink = np.zeros(samples)
    pink[0] = white[0]
    for i in range(1, samples):
        pink[i] = 0.95 * pink[i-1] + 0.05 * white[i]
    # 添加雨滴效果（随机脉冲）
    rain = pink * 0.5
    for _ in range(int(duration * 20)):  # 每秒约20个雨滴
        pos = np.random.randint(0, samples - 100)
        drop = np.random.exponential(0.5) * 0.3
        rain[pos:pos+50] += np.random.randn(50) * drop
    return rain * intensity

def generate_keyboard_typing(duration=10.0):
    """生成键盘打字声"""
    samples = int(SAMPLE_RATE * duration)
    audio = np.zeros(samples)
    # 生成随机按键
    num_keys = int(duration * 5)  # 每秒约5次按键
    for _ in range(num_keys):
        pos = np.random.randint(0, samples - 2000)
        # 按键声 - 短促的点击
        click_len = np.random.randint(300, 800)
        click = np.random.randn(click_len) * np.exp(-np.linspace(0, 5, click_len))
        audio[pos:pos+click_len] += click * 0.4
        # 偶尔有按键释放声
        if np.random.random() > 0.5:
            release_pos = pos + click_len + np.random.randint(100, 500)
            if release_pos < samples - 300:
                release = np.random.randn(200) * np.exp(-np.linspace(0, 3, 200))
                audio[release_pos:release_pos+200] += release * 0.2
    return audio * 0.5

def generate_ambient_hum(duration=30.0):
    """生成房间环境嗡嗡声（电脑风扇/空调）"""
    samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, samples)
    # 基础低频嗡嗡
    hum = np.sin(2 * np.pi * 60 * t) * 0.1  # 60Hz
    hum += np.sin(2 * np.pi * 120 * t) * 0.05
    hum += np.sin(2 * np.pi * 180 * t) * 0.03
    # 添加轻微调制
    hum *= (1 + 0.1 * np.sin(2 * np.pi * 0.5 * t))
    # 添加粉红噪音
    white = np.random.randn(samples)
    pink = np.zeros(samples)
    pink[0] = white[0]
    for i in range(1, samples):
        pink[i] = 0.99 * pink[i-1] + 0.01 * white[i]
    return (hum + pink * 0.3) * 0.25

def generate_neon_pulse(duration=20.0):
    """生成赛博朋克霓虹灯脉冲氛围音"""
    samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, samples)
    audio = np.zeros(samples)
    # 低频合成器pad
    audio += np.sin(2 * np.pi * 55 * t) * 0.1 * (1 + 0.3 * np.sin(2 * np.pi * 0.2 * t))
    audio += np.sin(2 * np.pi * 110 * t) * 0.08 * (1 + 0.2 * np.sin(2 * np.pi * 0.3 * t + 1))
    # 添加一些谐波
    audio += np.sin(2 * np.pi * 220 * t) * 0.03
    # 霓虹灯闪烁效果（随机的嗡嗡声增强）
    for _ in range(int(duration * 2)):
        pos = np.random.randint(0, samples - 5000)
        pulse = np.sin(2 * np.pi * 50 * np.linspace(0, 0.5, 5000)) * np.exp(-np.linspace(0, 3, 5000))
        audio[pos:pos+5000] += pulse * 0.15
    # 添加轻微噪音
    audio += np.random.randn(samples) * 0.02
    return audio * 0.4

def generate_city_distant(duration=30.0):
    """生成远处城市环境音"""
    samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, samples)
    audio = np.zeros(samples)
    # 持续的低频车流
    audio += np.random.randn(samples) * 0.1
    # 低频隆隆声
    rumble = np.sin(2 * np.pi * 40 * t) * 0.05
    rumble += np.sin(2 * np.pi * 80 * t) * 0.03
    audio += rumble
    # 偶尔的车经过声（低频增强）
    for _ in range(int(duration * 0.5)):
        pos = np.random.randint(0, samples - 10000)
        car = np.random.randn(10000) * np.exp(-((np.linspace(-2, 2, 10000))**2)) * 0.3
        # 低通滤波效果
        car_filtered = np.zeros(10000)
        car_filtered[0] = car[0]
        for i in range(1, 10000):
            car_filtered[i] = 0.8 * car_filtered[i-1] + 0.2 * car[i]
        audio[pos:pos+10000] += car_filtered * 0.2
    return audio * 0.3

def main():
    os.makedirs('public/audio', exist_ok=True)
    print("🎵 开始生成氛围音效...\n")

    # 1. 雨声
    print("🌧️ 生成雨声白噪音...")
    rain = generate_rain(duration=30.0, intensity=0.4)
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
    print("\n💡 使用建议：")
    print("   - 01-rain-city.wav → 搭配 bg_lofi.png 背景")
    print("   - 02-keyboard-typing.wav → 交互音效（鲸鱼娘打字时触发）")
    print("   - 03-room-ambient.wav → 底层环境音（低音量循环）")
    print("   - 04-cyberpunk-neon.wav → 搭配 bg_cyberpunk.png")
    print("   - 05-city-distant.wav → 搭配 bg_cinematic.png")

if __name__ == '__main__':
    main()
