import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MUSIC_PRESETS, type MusicPreset } from './presets'
import { MusicContext, type MusicContextValue, type MusicLoopMode, type MusicTrack } from './MusicContext'

const DEFAULT_TRACK: MusicTrack = { name: MUSIC_PRESETS[0].label, url: MUSIC_PRESETS[0].url }
const DEFAULT_VOLUME = 0.55

/** 同源（含 blob / data）的音源才接得上 Web Audio，跨域接进去会被静音 */
function isAnalysable(url: string) {
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/** URL 音源没有预设标签时，用文件名兜底 */
function displayName(url: string, preset?: MusicPreset) {
  if (preset) return preset.label
  if (url.startsWith('blob:')) return '未知音乐'
  try {
    const parsed = new URL(url, window.location.href)
    const fileName = decodeURIComponent(parsed.pathname.split('/').pop() ?? '').trim()
    return fileName || parsed.hostname || '未知音乐'
  } catch {
    return url.trim() || '未知音乐'
  }
}

/**
 * 背景音乐的播放中枢：持有 audio 元素、播放状态、进度与频谱分析。
 * 舞台控制台只管 UI，正在播放卡片只管展示，两边共用同一份状态。
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<MusicTrack>(DEFAULT_TRACK)
  const [presetId, setPresetId] = useState(MUSIC_PRESETS[0].id)
  const [loopMode, setLoopMode] = useState<MusicLoopMode>('single')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  // 播放事件里要读最新的循环模式，不能靠闭包（audio 元素建好之后不会再重建）
  const loopModeRef = useRef(loopMode)
  loopModeRef.current = loopMode
  // 列表循环要在 ended 里接着起下一首，但 startSource 不能在自己的函数体里引用自己
  const startSourceRef = useRef<(url: string, name: string, nextPresetId: string, showError: boolean) => void>(() => {})

  /**
   * 每次换音源都新建一个 audio 元素。
   * MediaElementSource 一旦绑定就无法解绑，只有换元素才能让后来的跨域音源不被静音。
   */
  const startSource = useCallback((url: string, name: string, nextPresetId: string, showError: boolean) => {
    audioRef.current?.pause()

    const audio = new Audio()
    // 单曲循环交给 audio.loop；列表循环得让它自然播完，才能接下一首
    audio.loop = loopModeRef.current === 'single'
    audio.preload = 'auto'
    audio.volume = volumeRef.current
    audio.src = url
    audio.addEventListener('play', () => setIsPlaying(true))
    audio.addEventListener('pause', () => setIsPlaying(false))
    audio.addEventListener('ended', () => {
      // 单曲循环由 audio.loop 兜着，走不到这里
      if (loopModeRef.current !== 'list') return
      const index = MUSIC_PRESETS.findIndex((preset) => preset.id === nextPresetId)
      if (index < 0) {
        // 自定义音源（URL / 本地文件）不在预设列表里，没有「下一首」可接，重头再放一遍
        audio.currentTime = 0
        void audio.play().catch(() => undefined)
        return
      }
      const next = MUSIC_PRESETS[(index + 1) % MUSIC_PRESETS.length]
      startSourceRef.current(next.url, next.label, next.id, false)
    })
    audio.addEventListener('loadedmetadata', () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    })
    // timeupdate 大约 4Hz，只在整秒变化时才写 state，避免无谓的重渲染
    audio.addEventListener('timeupdate', () => {
      setCurrentTime((previous) => (Math.floor(previous) === Math.floor(audio.currentTime) ? previous : audio.currentTime))
    })
    audioRef.current = audio

    setTrack({ name, url })
    setPresetId(nextPresetId)
    setCurrentTime(0)
    setDuration(0)

    let nextAnalyser: AnalyserNode | null = null
    if (isAnalysable(url)) {
      try {
        const context = audioContextRef.current ?? new AudioContext()
        audioContextRef.current = context
        const source = context.createMediaElementSource(audio)
        nextAnalyser = context.createAnalyser()
        // 512 点足够切出四段对数频段，再小低频会挤在一起
        nextAnalyser.fftSize = 512
        nextAnalyser.smoothingTimeConstant = 0.72
        source.connect(nextAnalyser)
        nextAnalyser.connect(context.destination)
        void context.resume()
      } catch {
        // 拿不到分析节点就退回 CSS 动画，不影响出声
        nextAnalyser = null
      }
    }
    setAnalyser(nextAnalyser)

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
  }, [])

  // ended 里要靠它起下一首，而 startSource 是 useCallback 稳定引用，挂一次就够了
  startSourceRef.current = startSource

  // 播放中切换循环模式：audio 元素已经建好，得手动把 loop 改过来
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopMode === 'single'
  }, [loopMode])

  const selectPreset = useCallback((preset: MusicPreset) => {
    setError('')
    startSource(preset.url, preset.label, preset.id, false)
  }, [startSource])

  const playUrl = useCallback((value: string) => {
    const url = value.trim()
    if (!url) return
    setError('')
    const matched = MUSIC_PRESETS.find((preset) => preset.url === url)
    // 先用一个探测元素确认地址能解析出元数据，再交给正式元素播放
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => startSource(url, displayName(url, matched), matched?.id ?? '', true)
    probe.onerror = () => setError('音乐加载失败，请检查 URL 是否正确')
    probe.src = url
  }, [startSource])

  const playFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setError('')
    startSource(objectUrl, file.name, '', false)
  }, [startSource])

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
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    audioRef.current?.pause()
    audioRef.current = null
    setAnalyser(null)
    setTrack(DEFAULT_TRACK)
    setPresetId(MUSIC_PRESETS[0].id)
    setLoopMode('single')
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVolumeState(DEFAULT_VOLUME)
    setError('')
  }, [])

  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const context = audioContextRef.current
    audioContextRef.current = null
    void context?.close()
  }, [])

  const value = useMemo<MusicContextValue>(() => ({
    track,
    presetId,
    loopMode,
    setLoopMode,
    isPlaying,
    currentTime,
    duration,
    volume,
    error,
    analyser,
    selectPreset,
    playUrl,
    playFile,
    toggle,
    setVolume,
    clearError,
    reset,
  }), [track, presetId, loopMode, isPlaying, currentTime, duration, volume, error, analyser, selectPreset, playUrl, playFile, toggle, setVolume, clearError, reset])

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  )
}
