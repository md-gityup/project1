#!/usr/bin/env python3
"""Generates death.wav and gameover.wav - run: python3 create-sounds.py"""
import wave
import math
import os

def create_wav(filename, start_freq, end_freq, duration_sec, volume):
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    with wave.open(filename, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = []
        for i in range(num_samples):
            t = i / sample_rate
            freq = start_freq + (end_freq - start_freq) * (t / duration_sec)
            phase = 2 * math.pi * t * (start_freq + (end_freq - start_freq) * (t / duration_sec) / 2)
            sample = (1 if math.sin(phase) >= 0 else -1) * volume * (1 - t / duration_sec)
            s = max(-32767, min(32767, int(sample * 32767)))
            frames.append(s.to_bytes(2, 'little', signed=True))
        wav.writeframes(b''.join(frames))

os.makedirs('sounds', exist_ok=True)
create_wav('sounds/death.wav', 220, 55, 0.18, 0.25)
create_wav('sounds/gameover.wav', 330, 55, 0.55, 0.2)
print('Created sounds/death.wav and sounds/gameover.wav')
