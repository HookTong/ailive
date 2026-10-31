# 鲸鱼娘电竞房间氛围音频推荐

## 5个精选免费音频资源

---

### 1. 🌧️ 城市雨夜环境音（Rain City Ambience）

| 项目 | 内容 |
|------|------|
| **类型** | 环境音/白噪音 |
| **氛围** | 雨夜城市、宁静治愈、适合 Lo-Fi 场景 |
| **来源** | Orange Free Sounds |
| **时长** | ~2分钟 |
| **许可** | CC BY-NC 4.0（非商业使用，需署名） |
| **下载** | https://orangefreesounds.com/wp-content/uploads/2026/02/Rain-falling-in-city-urban-ambience-sound-effect.mp3 |
| **备用页** | https://orangefreesounds.com/?p=55411 |

> 💡 搭配 `bg_lofi.png` 或 `bg_cinematic.png` 使用最佳

---

### 2. 🎹 Lo-Fi 学习/游戏背景音乐

| 项目 | 内容 |
|------|------|
| **类型** | Lo-Fi Hip Hop |
| **氛围** | 轻松、专注、适合长时间播放 |
| **来源** | Fesliyan Studios |
| **推荐曲目** | Chill Gaming / Tokyo Lo-Fi / Lazy Day |
| **许可** | 免版税，可商用（需阅读具体政策） |
| **下载页** | https://www.fesliyanstudios.com/royalty-free-music/downloads-c/lofi-hip-hop-music/37 |

**推荐曲目链接：**
- **Chill Gaming** → https://www.fesliyanstudios.com/royalty-free-music/download/chill-gaming/350
- **Tokyo Lo-Fi** → https://www.fesliyanstudios.com/royalty-free-music/download/tokyo-lo-fi/1751
- **Lazy Day** → https://www.fesliyanstudios.com/royalty-free-music/download/lazy-day/357

> 💡 搭配任何背景图都合适，建议低音量循环播放

---

### 3. 🌃 城市夜景环境音（Urban City Night）

| 项目 | 内容 |
|------|------|
| **类型** | 城市环境音 |
| **氛围** | 夜晚城市、远处车流、轻微雨声 |
| **来源** | Mixkit |
| **时长** | 2:06 |
| **许可** | Mixkit Free License（免费商用，无需署名） |
| **下载页** | https://mixkit.co/free-sound-effects/city/ |

**具体操作：**
1. 打开 https://mixkit.co/free-sound-effects/city/
2. 找到 **"Urban city ambience at night"**（2:06）
3. 点击 "Download Free SFX" 按钮下载

> 💡 搭配 `bg_cyberpunk.png` 或 `bg_cinematic.png` 使用最佳

---

### 4. ⌨️ 键盘打字/电竞环境音效

| 项目 | 内容 |
|------|------|
| **类型** | 键盘打字声 |
| **氛围** | 电竞房间、程序员工作、沉浸感 |
| **来源** | Mixkit |
| **许可** | Mixkit Free License |
| **下载页** | https://mixkit.co/free-sound-effects/keyboard/ |

**具体操作：**
1. 打开 https://mixkit.co/free-sound-effects/keyboard/
2. 选择适合的键盘敲击音效（有多种）
3. 点击 "Download Free SFX" 按钮下载

> 💡 可作为交互音效，在鲸鱼娘"打字/工作"状态时触发

---

### 5. 🎵 赛博朋克/科幻氛围音乐

| 项目 | 内容 |
|------|------|
| **类型** | 赛博朋克电子氛围音乐 |
| **氛围** | 霓虹城市、未来感、科技感 |
| **来源** | Pixabay Music |
| **许可** | Pixabay License（免费商用，无需署名） |
| **搜索页** | https://pixabay.com/music/search/cyberpunk/ |

**推荐搜索关键词：**
- `cyberpunk` - 赛博朋克风格
- `ambient electronic` - 电子氛围
- `night city` - 夜城氛围
- `neon` - 霓虹风格

**具体操作：**
1. 打开 https://pixabay.com/music/
2. 搜索 "cyberpunk" 或 "night city"
3. 点击曲目右侧的下载按钮

> 💡 搭配 `bg_cyberpunk.png` 使用最佳

---

## 快速下载建议

如果你想快速获取，推荐以下**优先级**：

| 优先级 | 音频 | 来源 | 难度 |
|--------|------|------|------|
| ⭐⭐⭐ | 城市雨声 | Orange Free Sounds | 🟢 直接下载 |
| ⭐⭐⭐ | 城市夜景 | Mixkit | 🟡 需点按钮 |
| ⭐⭐⭐ | Lo-Fi 音乐 | Fesliyan Studios | 🟡 需点按钮 |
| ⭐⭐ | 键盘音效 | Mixkit | 🟡 需点按钮 |
| ⭐⭐ | 赛博朋克音乐 | Pixabay | 🟡 需点按钮 |

---

## 在项目中使用

下载后，将音频文件放入 `public/audio/` 目录，然后在代码中引用：

```typescript
// 在 React 组件中播放背景音
const audioRef = useRef<HTMLAudioElement | null>(null)

useEffect(() => {
  audioRef.current = new Audio('/audio/rain-city.mp3')
  audioRef.current.loop = true
  audioRef.current.volume = 0.3
  audioRef.current.play()
  return () => audioRef.current?.pause()
}, [])
```

---

## 版权说明

- **Mixkit** 和 **Pixabay** 的素材均为免费商用，无需署名
- **Fesliyan Studios** 为免版税音乐，可商用但建议阅读具体政策
- **Orange Free Sounds** 为 CC BY-NC 4.0，仅限非商业使用

请根据你的使用场景选择合适的音频资源。
