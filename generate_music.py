#!/usr/bin/env python3
"""
生成5首 Lo-Fi / Ambient / Chill 风格背景音乐
包含和弦进行、旋律、鼓点
"""

import wave
import struct
import random
import math
import os

SAMPLE_RATE = 44100

def save_wav(filename, samples):
    filepath = os.path.join('public/audio', filename)
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        data = b''.join(struct.pack('h', int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
        wav_file.writeframes(data)
    print(f"✅ 生成: {filepath} ({len(samples)/SAMPLE_RATE:.1f}秒)")

def note_freq(note, octave=4):
    """获取音符频率"""
    notes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
             'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    semitone = notes[note] + (octave - 4) * 12
    return 440.0 * (2 ** ((semitone - 9) / 12))

def sine_wave(freq, duration, amplitude=0.3, attack=0.01, decay=0.1):
    """生成带包络的正弦波"""
    samples = int(SAMPLE_RATE * duration)
    audio = []
    for i in range(samples):
        t = i / SAMPLE_RATE
        val = math.sin(2 * math.pi * freq * t)
        # ADSR 包络
        if t < attack:
            env = t / attack
        elif t < duration - decay:
            env = 1.0
        else:
            env = max(0, (duration - t) / decay)
        audio.append(val * amplitude * env)
    return audio

def triangle_wave(freq, duration, amplitude=0.3):
    """三角波（更像合成器）"""
    samples = int(SAMPLE_RATE * duration)
    period = SAMPLE_RATE / freq
    audio = []
    for i in range(samples):
        phase = (i % period) / period
        if phase < 0.5:
            val = 4 * phase - 1
        else:
            val = 3 - 4 * phase
        # 轻微衰减
        t = i / SAMPLE_RATE
        env = max(0, 1.0 - t / duration * 0.5)
        audio.append(val * amplitude * env)
    return audio

def kick_drum(t):
    """kick 鼓声"""
    if t < 0.01:
        freq = 150
    elif t < 0.05:
        freq = 150 - (t - 0.01) / 0.04 * 100
    else:
        freq = 50
    amp = math.exp(-t * 20) * 0.6
    return math.sin(2 * math.pi * freq * t) * amp

def snare_drum(t):
    """snare 鼓声"""
    tone = math.sin(2 * math.pi * 200 * t) * math.exp(-t * 15) * 0.3
    noise = random.uniform(-1, 1) * math.exp(-t * 10) * 0.4
    return tone + noise

def hihat(t):
    """hi-hat 镲片"""
    return random.uniform(-1, 1) * math.exp(-t * 40) * 0.15

def add_drum_pattern(audio, bpm, pattern, start_time=0):
    """添加鼓点模式"""
    beat_duration = 60.0 / bpm
    samples = len(audio)
    for i, hit in enumerate(pattern):
        t_offset = start_time + i * beat_duration
        sample_offset = int(t_offset * SAMPLE_RATE)
        if sample_offset >= samples:
            break
        if hit == 'K':  # kick
            for j in range(min(int(0.1 * SAMPLE_RATE), samples - sample_offset)):
                t = j / SAMPLE_RATE
                audio[sample_offset + j] += kick_drum(t)
        elif hit == 'S':  # snare
            for j in range(min(int(0.15 * SAMPLE_RATE), samples - sample_offset)):
                t = j / SAMPLE_RATE
                audio[sample_offset + j] += snare_drum(t)
        elif hit == 'H':  # hihat
            for j in range(min(int(0.05 * SAMPLE_RATE), samples - sample_offset)):
                t = j / SAMPLE_RATE
                audio[sample_offset + j] += hihat(t)

def add_chord_progression(audio, chords, bpm, start_time=0, wave_type='sine', amp=0.15):
    """添加和弦进行"""
    beat_duration = 60.0 / bpm
    chord_duration = beat_duration * 4  # 每和弦4拍
    for i, chord_notes in enumerate(chords):
        t_offset = start_time + i * chord_duration
        sample_offset = int(t_offset * SAMPLE_RATE)
        chord_samples = int(chord_duration * SAMPLE_RATE)
        if sample_offset >= len(audio):
            break
        for note_name in chord_notes:
            freq = note_freq(note_name[0], note_name[1])
            note_audio = sine_wave(freq, chord_duration, amplitude=amp, attack=0.1, decay=0.5)
            for j in range(min(chord_samples, len(audio) - sample_offset)):
                audio[sample_offset + j] += note_audio[j]

def add_bassline(audio, bass_notes, bpm, start_time=0, amp=0.25):
    """添加贝斯线"""
    beat_duration = 60.0 / bpm
    note_duration = beat_duration * 2
    for i, (note_name, octave) in enumerate(bass_notes):
        t_offset = start_time + i * note_duration
        sample_offset = int(t_offset * SAMPLE_RATE)
        if sample_offset >= len(audio):
            break
        freq = note_freq(note_name, octave)
        # 贝斯用三角波
        note_audio = triangle_wave(freq, note_duration, amplitude=amp)
        for j in range(min(len(note_audio), len(audio) - sample_offset)):
            audio[sample_offset + j] += note_audio[j]

def add_arpeggio(audio, notes, bpm, start_time=0, amp=0.12):
    """添加琶音"""
    beat_duration = 60.0 / bpm
    note_duration = beat_duration / 2  # 8分音符
    for i, (note_name, octave) in enumerate(notes):
        t_offset = start_time + i * note_duration
        sample_offset = int(t_offset * SAMPLE_RATE)
        if sample_offset >= len(audio):
            break
        freq = note_freq(note_name, octave)
        note_audio = sine_wave(freq, note_duration * 0.9, amplitude=amp, attack=0.01, decay=0.05)
        for j in range(min(len(note_audio), len(audio) - sample_offset)):
            audio[sample_offset + j] += note_audio[j]

# ===================== 5首音乐 =====================

def generate_lofi_chill(duration=40.0):
    """Lo-Fi Chill - 悠闲"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    bpm = 75
    
    # 和弦进行: Fmaj7 - Em7 - Dm7 - Cmaj7 (经典 Lo-Fi)
    chords = [
        [('F', 4), ('A', 4), ('C', 5), ('E', 5)],
        [('E', 4), ('G', 4), ('B', 4), ('D', 5)],
        [('D', 4), ('F', 4), ('A', 4), ('C', 5)],
        [('C', 4), ('E', 4), ('G', 4), ('B', 4)],
    ]
    # 循环2次
    full_chords = chords * 2
    add_chord_progression(audio, full_chords, bpm, amp=0.12)
    
    # 贝斯
    bass = [('F', 3), ('E', 3), ('D', 3), ('C', 3)] * 2
    add_bassline(audio, bass, bpm, amp=0.2)
    
    # 鼓点
    drum_loop = ['K', 'H', 'S', 'H', 'K', 'H', 'S', 'H']
    for loop in range(8):
        add_drum_pattern(audio, bpm, drum_loop, start_time=loop * 2.0)
    
    # 琶音点缀
    arp = [('F', 5), ('A', 5), ('C', 6), ('E', 6), ('E', 5), ('G', 5), ('B', 5), ('D', 6),
           ('D', 5), ('F', 5), ('A', 5), ('C', 6), ('C', 5), ('E', 5), ('G', 5), ('B', 5)] * 2
    add_arpeggio(audio, arp, bpm, start_time=4.0, amp=0.08)
    
    return audio

def generate_cyberpunk_neon(duration=35.0):
    """赛博朋克霓虹 - 电子合成器"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    bpm = 100
    
    # 暗和弦: Dm - Bb - F - C
    chords = [
        [('D', 4), ('F', 4), ('A', 4)],
        [('B', 3), ('D', 4), ('F', 4)],
        [('F', 4), ('A', 4), ('C', 5)],
        [('C', 4), ('E', 4), ('G', 4)],
    ] * 2
    add_chord_progression(audio, chords, bpm, amp=0.1)
    
    # 贝斯
    bass = [('D', 2), ('B', 2), ('F', 2), ('C', 2)] * 2
    add_bassline(audio, bass, bpm, amp=0.3)
    
    # 电子鼓
    drum_loop = ['K', 'H', 'H', 'S', 'K', 'H', 'S', 'H']
    for loop in range(10):
        add_drum_pattern(audio, bpm, drum_loop, start_time=loop * 2.0)
    
    # 琶音
    arp = [('D', 5), ('F', 5), ('A', 5), ('D', 6), ('B', 4), ('D', 5), ('F', 5), ('B', 5),
           ('F', 5), ('A', 5), ('C', 6), ('F', 6), ('C', 5), ('E', 5), ('G', 5), ('C', 6)] * 2
    add_arpeggio(audio, arp, bpm, start_time=2.0, amp=0.1)
    
    return audio

def generate_rainy_piano(duration=45.0):
    """雨天钢琴 - 治愈系"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    bpm = 60
    
    # 钢琴和弦: Am - F - C - G
    chords = [
        [('A', 4), ('C', 5), ('E', 5)],
        [('F', 4), ('A', 4), ('C', 5)],
        [('C', 4), ('E', 4), ('G', 4)],
        [('G', 4), ('B', 4), ('D', 5)],
    ] * 3
    add_chord_progression(audio, chords, bpm, amp=0.15)
    
    # 钢琴旋律 (简单音符)
    melody_notes = [('E', 5), ('C', 5), ('A', 4), ('G', 4), ('F', 5), ('E', 5), ('D', 5), ('C', 5),
                    ('A', 4), ('C', 5), ('E', 5), ('A', 5), ('G', 5), ('F', 5), ('E', 5), ('D', 5)]
    beat_duration = 60.0 / bpm
    note_dur = beat_duration * 1.5
    for i, (note, octave) in enumerate(melody_notes):
        t_offset = 2.0 + i * beat_duration
        sample_offset = int(t_offset * SAMPLE_RATE)
        if sample_offset >= len(audio):
            break
        freq = note_freq(note, octave)
        note_audio = sine_wave(freq, note_dur, amplitude=0.2, attack=0.05, decay=0.3)
        for j in range(min(len(note_audio), len(audio) - sample_offset)):
            audio[sample_offset + j] += note_audio[j]
    
    # 贝斯
    bass = [('A', 2), ('F', 2), ('C', 3), ('G', 2)] * 3
    add_bassline(audio, bass, bpm, amp=0.18)
    
    # 轻微雨声背景
    for i in range(samples):
        audio[i] += random.uniform(-0.03, 0.03)
    
    return audio

def generate_gaming_focus(duration=35.0):
    """游戏专注 - 轻快"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    bpm = 85
    
    # C - G - Am - F
    chords = [
        [('C', 4), ('E', 4), ('G', 4)],
        [('G', 3), ('B', 3), ('D', 4)],
        [('A', 3), ('C', 4), ('E', 4)],
        [('F', 3), ('A', 3), ('C', 4)],
    ] * 2
    add_chord_progression(audio, chords, bpm, amp=0.1)
    
    # 贝斯
    bass = [('C', 3), ('G', 2), ('A', 2), ('F', 2)] * 2
    add_bassline(audio, bass, bpm, amp=0.2)
    
    # 轻快鼓点
    drum_loop = ['K', 'H', 'S', 'H', 'K', 'K', 'S', 'H']
    for loop in range(8):
        add_drum_pattern(audio, bpm, drum_loop, start_time=loop * 2.0)
    
    # 旋律琶音
    arp = [('C', 5), ('E', 5), ('G', 5), ('C', 6), ('B', 4), ('D', 5), ('G', 5), ('B', 5),
           ('A', 4), ('C', 5), ('E', 5), ('A', 5), ('F', 4), ('A', 4), ('C', 5), ('F', 5)] * 2
    add_arpeggio(audio, arp, bpm, start_time=1.0, amp=0.09)
    
    return audio

def generate_starlight_dream(duration=40.0):
    """星光梦幻 - 氛围"""
    samples = int(SAMPLE_RATE * duration)
    audio = [0.0] * samples
    bpm = 55
    
    # 梦幻和弦: E - B - C#m - A
    chords = [
        [('E', 4), ('G#', 4), ('B', 4)],
        [('B', 3), ('D#', 4), ('F#', 4)],
        [('C#', 4), ('E', 4), ('G#', 4)],
        [('A', 3), ('C#', 4), ('E', 4)],
    ] * 2
    add_chord_progression(audio, chords, bpm, amp=0.12)
    
    # 低音 pad
    bass = [('E', 2), ('B', 1), ('C#', 2), ('A', 1)] * 2
    add_bassline(audio, bass, bpm, amp=0.22)
    
    # 缓慢琶音（像星星闪烁）
    arp = [('E', 5), ('B', 5), ('G#', 5), ('E', 6), ('B', 4), ('F#', 5), ('D#', 5), ('B', 5),
           ('C#', 5), ('G#', 5), ('E', 5), ('C#', 6), ('A', 4), ('E', 5), ('C#', 5), ('A', 5)] * 2
    add_arpeggio(audio, arp, bpm, start_time=0, amp=0.06)
    
    # 轻微空间感（延迟效果模拟）
    delay_samples = int(0.3 * SAMPLE_RATE)
    delayed = [0.0] * len(audio)
    for i in range(len(audio) - delay_samples):
        delayed[i + delay_samples] += audio[i] * 0.3
    for i in range(len(audio)):
        audio[i] += delayed[i]
    
    return audio

def main():
    os.makedirs('public/audio', exist_ok=True)
    print("🎵 开始生成5首背景音乐...\n")
    
    print("1️⃣  Lo-Fi Chill - 悠闲节拍")
    music1 = generate_lofi_chill(40.0)
    save_wav('music-01-lofi-chill.wav', music1)
    
    print("2️⃣  Cyberpunk Neon - 赛博朋克")
    music2 = generate_cyberpunk_neon(35.0)
    save_wav('music-02-cyberpunk.wav', music2)
    
    print("3️⃣  Rainy Piano - 雨天钢琴")
    music3 = generate_rainy_piano(45.0)
    save_wav('music-03-rainy-piano.wav', music3)
    
    print("4️⃣  Gaming Focus - 游戏专注")
    music4 = generate_gaming_focus(35.0)
    save_wav('music-04-gaming-focus.wav', music4)
    
    print("5️⃣  Starlight Dream - 星光梦幻")
    music5 = generate_starlight_dream(40.0)
    save_wav('music-05-starlight.wav', music5)
    
    print("\n✨ 5首音乐全部生成完成！")
    print("\n📋 搭配建议：")
    print("   music-01-lofi-chill.wav     → bg_lofi.png")
    print("   music-02-cyberpunk.wav      → bg_cyberpunk.png")
    print("   music-03-rainy-piano.wav    → bg_cinematic.png")
    print("   music-04-gaming-focus.wav   → bg_fantasy.png")
    print("   music-05-starlight.wav      → bg_fantasy.png")
    print("\n💡 提示：这些是用正弦波/三角波合成的简单音乐，")
    print("   建议后期替换为高质量的 Lo-Fi / Chillhop 真实音乐")

if __name__ == '__main__':
    main()
