import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MUSIC_PRESETS, type MusicPreset } from './presets'
import { MusicContext, type MusicContextValue, type MusicLoopMode, type MusicTrack } from './MusicContext'

const DEFAULT_TRACK: MusicTrack = { name: MUSIC_PRESETS[0].label, url: MUSIC_PRESETS[0].url }
const DEFAULT_VOLUME = 0.55
const CUSTOM_TRACKS_STORAGE_KEY = 'ailive.custom-tracks'

/** 同源（含 blob / data）的音源才接得上 Web Audio，跨域接进去会被静音 */
function isAnalysable(url: string) {
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/** 没有名称可用时（临时试听）用文件名兜底 */
function displayName(url: string) {
  if (url.startsWith('blob:')) return '本地音乐'
  try {
    const parsed = new URL(url, window.location.href)
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() ?? '').trim()
    return fileName || parsed.hostname || '未知音乐'
  } catch {
    return url.trim() || '未知音乐'
  }
}

/**
 * 随机挑下一首：从「除当前这首以外」的范围里选。
 * 直接 `Math.random() * list.length` 的话，列表只有 5 首时连着放回同一首的概率是 20%，
 * 听起来就像随机坏了。偏移量取 [1, length-1]，天然排除自己。
 */
function pickRandomTrack(list: MusicPreset[], currentIndex: number): MusicPreset {
  if (list.length <= 1) return list[currentIndex]
  const offset = Math.floor(Math.random() * (list.length - 1)) + 1
  return list[(currentIndex + offset) % list.length]
}

/**
 * 用探测元素确认地址能解析出元数据。
 * 直接往正式元素上挂坏地址的话，play() 只会报「浏览器阻止了播放」，提示驴唇不对马嘴。
 */
function probeAudio(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => resolve(true)
    probe.onerror = () => resolve(false)
    probe.src = url
  })
}

/**
 * 读取自定义音乐。本地文件是 `blob:` URL，刷新后必然失效，
 * 存了也播不了，所以读的时候直接丢掉（写入时同样跳过）。
 */
function loadCustomTracks(): MusicPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_TRACKS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is MusicPreset => {
      if (!item || typeof item !== 'object') return false
      const preset = item as Partial<MusicPreset>
      return typeof preset.id === 'string'
        && preset.id.startsWith('custom:')
        && typeof preset.label === 'string'
        && preset.label.trim().length > 0
        && typeof preset.url === 'string'
        && preset.url.trim().length > 0
        && !preset.url.startsWith('blob:')
    })
  } catch {
    return []
  }
}

/**
 * 背景音乐的播放中枢：持有 audio 元素、播放状态、进度与频谱分析。
 * 舞台控制台只管 UI，正在播放卡片只管展示，两边共用同一份状态。
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<MusicTrack>(DEFAULT_TRACK)
  const [presetId, setPresetId] = useState(MUSIC_PRESETS[0].id)
  const [customTracks, setCustomTracks] = useState<MusicPreset[]>(loadCustomTracks)
  const [loopMode, setLoopMode] = useState<MusicLoopMode>('single')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  // 内置预设在前，用户自己添加的排在后面；列表循环按这个顺序走
  const allTracks = useMemo(() => [...MUSIC_PRESETS, ...customTracks], [customTracks])
  // 列表循环在 ended 里要读最新列表，而 audio 元素建好之后不会再重建，只能靠 ref
  const tracksRef = useRef<MusicPreset[]>(allTracks)
  tracksRef.current = allTracks

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  // 自定义音乐里的 blob 地址：只要那首还在列表里就不能 revoke，攒到卸载时统一清
  const objectUrlsRef = useRef<string[]>([])
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  // 播放事件里要读最新的循环模式，不能靠闭包（audio 元素建好之后不会再重建）
  const loopModeRef = useRef(loopMode)
  loopModeRef.current = loopMode
  // 列表循环要在 ended 里接着起下一首，但 startSource 不能在自己的函数体里引用自己
  const startSourceRef = useRef<(url: string, name: string, nextPresetId: string, showError: boolean) => void>(() => {})

  /**
   * 试听播放器：一套完全独立的 audio 元素和频谱节点。
   * 独立是必须的 —— 借用主播放器的话，舞台那张卡片会跟着试听一起变，
   * 用户只是想听一下地址对不对，台面上的歌不该因此被顶掉。
   */
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [previewTrack, setPreviewTrack] = useState<MusicTrack>({ name: '', url: '' })
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(0)
  const [previewAnalyser, setPreviewAnalyser] = useState<AnalyserNode | null>(null)
  /** 进试听前外面的音乐是不是在放。null = 当前不在试听 */
  const previewWasPlayingRef = useRef<boolean | null>(null)

  /**
   * 给元素接一个频谱节点。跨域音源接进 Web Audio 会被静音，所以只接同源的。
   * 主播放器和试听播放器共用这一段。
   */
  const attachAnalyser = useCallback((audio: HTMLAudioElement, url: string): AnalyserNode | null => {
    if (!isAnalysable(url)) return null
    try {
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      const source = context.createMediaElementSource(audio)
      const analyser = context.createAnalyser()
      // 512 点足够切出四段对数频段，再小低频会挤在一起
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.72
      source.connect(analyser)
      analyser.connect(context.destination)
      void context.resume()
      return analyser
    } catch {
      // 拿不到分析节点就退回 CSS 动画，不影响出声
      return null
    }
  }, [])

  /**
   * 每次换音源都新建一个 audio 元素。
   * MediaElementSource 一旦绑定就无法解绑，只有换元素才能让后来的跨域音源不被静音。
   */
  const startSource = useCallback((url: string, name: string, nextPresetId: string, showError: boolean) => {
    audioRef.current?.pause()

    const audio = new Audio()
    // 单曲循环交给 audio.loop；列表 / 随机都得让它自然播完，才能接下一首
    audio.loop = loopModeRef.current === 'single'
    audio.preload = 'auto'
    audio.volume = volumeRef.current
    audio.src = url
    audio.addEventListener('play', () => setIsPlaying(true))
    audio.addEventListener('pause', () => setIsPlaying(false))
    audio.addEventListener('ended', () => {
      // 单曲循环由 audio.loop 兜着，走不到这里
      const mode = loopModeRef.current
      if (mode === 'single') return
      const list = tracksRef.current
      const index = list.findIndex((preset) => preset.id === nextPresetId)
      if (index < 0) {
        // 临时试听的音源不在列表里，没有「下一首」可接，重头再放一遍
        audio.currentTime = 0
        void audio.play().catch(() => undefined)
        return
      }
      const next = mode === 'shuffle'
        ? pickRandomTrack(list, index)
        : list[(index + 1) % list.length]
      startSourceRef.current(next.url, next.label, next.id, false)
    })
    /**
     * 元素被换掉 / 被重置之后，旧的还会补发一两个事件（timeupdate 约 4Hz，
     * 排队的那个会在 `setCurrentTime(0)` 之后才到），不挡住的话会把进度写回去 ——
     * 「重置舞台」后卡片停在上一首的秒数就是这个原因。
     */
    const isCurrent = () => audioRef.current === audio
    audio.addEventListener('loadedmetadata', () => {
      if (isCurrent()) setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    })
    // timeupdate 大约 4Hz，只在整秒变化时才写 state，避免无谓的重渲染
    audio.addEventListener('timeupdate', () => {
      if (!isCurrent()) return
      setCurrentTime((previous) => (Math.floor(previous) === Math.floor(audio.currentTime) ? previous : audio.currentTime))
    })
    audioRef.current = audio

    setTrack({ name, url })
    setPresetId(nextPresetId)
    setCurrentTime(0)
    setDuration(0)

    setAnalyser(attachAnalyser(audio, url))

    const retryAfterLoad = () => {
      void audio.play().catch((reason: unknown) => {
        if (showError && !(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError('浏览器阻止了播放，请再次点击播放')
        }
      })
    }
    audio.addEventListener('canplay', retryAfterLoad, { once: true })
    void audio.play().catch((reason: unknown) => {
      if (showError && !(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError('浏览器阻止了播放，请再次点击播放')
      }
    })
  }, [attachAnalyser])

  // ended 里要靠它起下一首，而 startSource 是 useCallback 稳定引用，挂一次就够了
  startSourceRef.current = startSource

  // 播放中切换循环模式：audio 元素已经建好，得手动把 loop 改过来
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'single'
  }, [loopMode])

  // 自定义音乐落盘。blob: 地址刷新后必然失效，写的时候也跳过
  useEffect(() => {
    try {
      const persistable = customTracks.filter((preset) => !preset.url.startsWith('blob:'))
      window.localStorage.setItem(CUSTOM_TRACKS_STORAGE_KEY, JSON.stringify(persistable))
    } catch {
      // 隐私模式下存不了，不影响本次会话
    }
  }, [customTracks])

  /**
   * 停掉并清空试听。关弹窗时调 —— 下次打开是一张干净的卡片，
   * 而不是上次那段没听完的残影。
   */
  const stopPreview = useCallback(() => {
    previewAudioRef.current?.pause()
    previewAudioRef.current = null
    setPreviewTrack({ name: '', url: '' })
    setPreviewPlaying(false)
    setPreviewCurrentTime(0)
    setPreviewDuration(0)
    setPreviewAnalyser(null)
  }, [])

  /**
   * 试听一个地址。走的是独立播放器，主播放器的曲目/进度/频谱一概不动 ——
   * 舞台那张「正在播放」卡片不该因为有人在弹窗里试听就跟着变。
   */
  const startPreview = useCallback(async (value: string, name?: string) => {
    const url = value.trim()
    if (!url) return false
    if (!(await probeAudio(url))) return false
    // 换一首就把上一首停掉，否则两首会一起响
    stopPreview()

    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = volumeRef.current
    audio.src = url
    audio.addEventListener('play', () => setPreviewPlaying(true))
    audio.addEventListener('pause', () => setPreviewPlaying(false))
    // 换一首 / 清空之后旧元素还会补发排队的事件，别让它把新曲目的进度写回去
    const isCurrent = () => previewAudioRef.current === audio
    audio.addEventListener('loadedmetadata', () => {
      if (isCurrent()) setPreviewDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    })
    // 和主播放器一样只在整秒变化时写 state，避免无谓的重渲染
    audio.addEventListener('timeupdate', () => {
      if (!isCurrent()) return
      setPreviewCurrentTime((previous) => (Math.floor(previous) === Math.floor(audio.currentTime) ? previous : audio.currentTime))
    })
    previewAudioRef.current = audio

    const matched = tracksRef.current.find((preset) => preset.url === url)
    setPreviewTrack({ name: name?.trim() || matched?.label || displayName(url), url })
    setPreviewCurrentTime(0)
    setPreviewDuration(0)
    setPreviewAnalyser(attachAnalyser(audio, url))
    void audio.play().catch(() => undefined)
    return true
  }, [attachAnalyser, stopPreview])

  const togglePreview = useCallback(() => {
    const audio = previewAudioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => undefined)
    else audio.pause()
  }, [])

  /**
   * 进入试听：暂停外面的背景音乐，记住它原本是不是在放。
   * 试听用的是另一套播放器，所以主播放器的曲目、进度、频谱节点全都不动，
   * 关窗时只要 play() 一下就能从原位置接着放。
   * 重复调用直接返回：StrictMode 下 effect 会跑两遍，不能把已经记下的状态覆盖掉。
   */
  const beginPreview = useCallback(() => {
    if (previewWasPlayingRef.current !== null) return
    const audio = audioRef.current
    // 必须在 pause() 之前读：paused 是同步翻转的
    previewWasPlayingRef.current = audio ? !audio.paused : false
    audio?.pause()
  }, [])

  /**
   * 退出试听：清掉试听信息，原本在放的就接着放。
   * @param restore 传 false 表示这次试听已经有结果了（刚添加的音乐正在放），
   *                新曲目就是用户想要的，别再恢复外面的播放
   */
  const endPreview = useCallback((restore = true) => {
    const wasPlaying = previewWasPlayingRef.current
    previewWasPlayingRef.current = null
    stopPreview()
    if (!restore || !wasPlaying) return
    void audioRef.current?.play().catch(() => undefined)
  }, [stopPreview])

  const selectPreset = useCallback((preset: MusicPreset) => {
    setError('')
    startSource(preset.url, preset.label, preset.id, false)
  }, [startSource])

  const addTrack = useCallback(async (name: string, url: string) => {
    const label = name.trim()
    const source = url.trim()
    if (!label || !source) return false
    if (!(await probeAudio(source))) return false
    // 本地文件是 blob 地址，这首会留在列表里，不能像以前那样换歌就 revoke
    if (source.startsWith('blob:')) objectUrlsRef.current.push(source)
    const preset: MusicPreset = { id: `custom:${Date.now()}`, label, url: source }
    setCustomTracks((current) => [...current, preset])
    setError('')
    startSource(preset.url, preset.label, preset.id, true)
    return true
  }, [startSource])

  /**
   * 删掉一首自定义音乐。
   * 如果删的正是正在放的那首，得连播放一起收掉 —— 否则会继续放一首已经不在列表里的歌，
   * 而且本地文件的 blob 地址马上要被回收，放着放着就断了。
   */
  const removeTrack = useCallback((id: string) => {
    const target = customTracks.find((preset) => preset.id === id)
    if (!target) return
    setCustomTracks((current) => current.filter((preset) => preset.id !== id))

    if (presetId === id) {
      audioRef.current?.pause()
      audioRef.current = null
      setAnalyser(null)
      setTrack(DEFAULT_TRACK)
      setPresetId(MUSIC_PRESETS[0].id)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
    }

    // 只有这首在用这个 blob，删掉之后没人会再读它
    if (target.url.startsWith('blob:')) {
      URL.revokeObjectURL(target.url)
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== target.url)
    }
  }, [customTracks, presetId])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    // 首次播放时 audio 元素还没建出来（只在真正开始播时才创建），
    // 这里按当前曲目起一个，否则「播放」按钮点了没有任何反应
    if (!audio) {
      if (!track.url) return
      startSource(track.url, track.name, presetId, true)
      return
    }
    if (audio.paused) {
      void audioContextRef.current?.resume()
      void audio.play().catch(() => setError('浏览器阻止了播放，请再次点击播放'))
    } else {
      audio.pause()
    }
  }, [startSource, track.url, track.name, presetId])

  const setVolume = useCallback((next: number) => {
    setVolumeState(next)
    if (audioRef.current) audioRef.current.volume = next
  }, [])

  const clearError = useCallback(() => setError(''), [])

  const reset = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    // 重置就该把试听一起丢掉，否则下次关弹窗会去恢复一个已经被清掉的播放状态
    previewWasPlayingRef.current = null
    stopPreview()
    setAnalyser(null)
    setTrack(DEFAULT_TRACK)
    setPresetId(MUSIC_PRESETS[0].id)
    setLoopMode('single')
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolumeState(DEFAULT_VOLUME)
    setError('')
  }, [stopPreview])

  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
    previewAudioRef.current?.pause()
    previewAudioRef.current = null
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    objectUrlsRef.current = []
    const context = audioContextRef.current
    audioContextRef.current = null
    void context?.close()
  }, [])

  const value = useMemo<MusicContextValue>(() => ({
    track,
    presetId,
    tracks: allTracks,
    customTracks,
    loopMode,
    setLoopMode,
    isPlaying,
    currentTime,
    duration,
    volume,
    error,
    analyser,
    selectPreset,
    addTrack,
    removeTrack,
    // 试听是一整套独立状态，打包成一个对象给弹窗用，免得上下文里再摊开五个字段
    preview: {
      track: previewTrack,
      playing: previewPlaying,
      currentTime: previewCurrentTime,
      duration: previewDuration,
      analyser: previewAnalyser,
      start: startPreview,
      toggle: togglePreview,
      clear: stopPreview,
    },
    beginPreview,
    endPreview,
    toggle,
    setVolume,
    clearError,
    reset,
  }), [
    track,
    presetId,
    allTracks,
    customTracks,
    loopMode,
    isPlaying,
    currentTime,
    duration,
    volume,
    error,
    analyser,
    selectPreset,
    addTrack,
    removeTrack,
    previewTrack,
    previewPlaying,
    previewCurrentTime,
    previewDuration,
    previewAnalyser,
    startPreview,
    togglePreview,
    stopPreview,
    beginPreview,
    endPreview,
    toggle,
    setVolume,
    clearError,
    reset,
  ])

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  )
}
