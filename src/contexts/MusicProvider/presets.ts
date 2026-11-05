export type MusicPreset = {
  id: string
  label: string
  url: string
}

/** 内置背景音乐，排在自定义音源之前 */
export const MUSIC_PRESETS: readonly MusicPreset[] = [
  { id: 'music-01', label: '轻柔', url: '/audio/music-01-lofi-chill.wav' },
  { id: 'music-02', label: '赛博', url: '/audio/music-02-cyberpunk.wav' },
  { id: 'music-03', label: '雨声', url: '/audio/music-03-rainy-piano.wav' },
  { id: 'music-04', label: '专注', url: '/audio/music-04-gaming-focus.wav' },
  { id: 'music-05', label: '星光', url: '/audio/music-05-starlight.wav' },
]
