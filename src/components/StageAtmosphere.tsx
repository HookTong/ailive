import { useEffect, useRef } from 'react'

export type ParticlePreset =
  | 'stardust' | 'aurora' | 'bubbles' | 'comets'
  | 'nightSky' | 'nebula' | 'galaxy' | 'network'
  | 'neural' | 'dataFlow' | 'quantumLinks' | 'snow'
  | 'sakura' | 'fireflies' | 'pollen' | 'matrix'
  | 'triangles' | 'cubes' | 'orbit' | 'confetti'
  | 'rain' | 'embers' | 'pulse'

type StageAtmosphereProps = {
  enabled?: boolean
  intensity?: number
  speed?: number
  opacity?: number
  preset?: ParticlePreset
  color?: string
  size?: number
}

export const PARTICLE_COLOR_OPTIONS = ['#66e4c7', '#77bfff', '#c58cff', '#ffbf72', '#ff7898'] as const

export type ParticlePresetSettings = {
  color: string
  intensity: number
  speed: number
  opacity: number
  size: number
}

export const PARTICLE_PRESETS: ReadonlyArray<{ id: ParticlePreset; label: string } & ParticlePresetSettings> = [
  { id: 'stardust', label: '星尘', color: '#66e4c7', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'aurora', label: '极光', color: '#c58cff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'bubbles', label: '气泡', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'comets', label: '流星', color: '#ffbf72', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'nightSky', label: '夜空', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'nebula', label: '星云', color: '#c58cff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'galaxy', label: '银河', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'network', label: '网络', color: '#66e4c7', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'neural', label: '神经网络', color: '#c58cff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'dataFlow', label: '数据流', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'quantumLinks', label: '量子连线', color: '#ff7898', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'snow', label: '雪幕', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'sakura', label: '樱花', color: '#ff7898', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'fireflies', label: '萤火', color: '#ffbf72', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'pollen', label: '花粉', color: '#ffbf72', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'matrix', label: '矩阵', color: '#66e4c7', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'triangles', label: '三角几何', color: '#ff7898', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'cubes', label: '几何方块', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'orbit', label: '轨道', color: '#c58cff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'confetti', label: '彩纸', color: '#ff7898', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'rain', label: '雨幕', color: '#77bfff', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'embers', label: '余烬', color: '#ffbf72', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
  { id: 'pulse', label: '脉冲', color: '#66e4c7', intensity: 1, speed: 2, opacity: 1, size: 2.5 },
]

type PresetDefaults = {
  count: number
  size: number
  move: number
  shape: string
  sides: number
  stroke: boolean
  opacity: number
  opacityRandom: boolean
  opacityAnim: boolean
  opacitySpeed: number
  direction: string
  links: boolean
  linkDistance: number
  linkOpacity: number
  linkWidth: number
  random: boolean
  straight: boolean
  attract: boolean
  bounce: boolean
  sizeAnim: boolean
  sizeMin: number
  sizeAnimSpeed: number
  hoverMode?: 'grab' | 'bubble' | 'repulse'
  clickMode?: 'push' | 'remove' | 'repulse' | 'bubble'
}

const makeDefaults = (overrides: Partial<PresetDefaults> = {}): PresetDefaults => ({
  count: 70,
  size: 4,
  move: 0.8,
  shape: 'circle',
  sides: 5,
  stroke: false,
  opacity: 0.58,
  opacityRandom: false,
  opacityAnim: false,
  opacitySpeed: 1,
  direction: 'none',
  links: false,
  linkDistance: 130,
  linkOpacity: 0.24,
  linkWidth: 1,
  random: true,
  straight: false,
  attract: false,
  bounce: false,
  sizeAnim: false,
  sizeMin: 0.35,
  sizeAnimSpeed: 2,
  ...overrides,
})

const presetDefaults: Record<ParticlePreset, PresetDefaults> = {
  stardust: makeDefaults({ shape: 'star', count: 120, size: 2.2, move: 0.25, opacity: 0.82, opacityRandom: true, opacityAnim: true, opacitySpeed: 0.7 }),
  aurora: makeDefaults({ shape: 'triangle', count: 54, size: 5, move: 0.28, opacity: 0.48, opacityAnim: true, opacitySpeed: 0.7, links: true, linkDistance: 170, linkOpacity: 0.2, attract: true }),
  bubbles: makeDefaults({ shape: 'circle', count: 16, size: 18, move: 0.45, opacity: 0.27, opacityRandom: true, sizeAnim: true, sizeMin: 0.65, sizeAnimSpeed: 0.7, direction: 'top', stroke: true, hoverMode: 'bubble' }),
  comets: makeDefaults({ shape: 'triangle', count: 24, size: 2.5, move: 4.5, opacity: 0.86, direction: 'left', straight: true, random: false }),
  nightSky: makeDefaults({ count: 180, size: 1.7, move: 0.12, opacity: 0.5, opacityRandom: true, opacityAnim: true, opacitySpeed: 0.35 }),
  nebula: makeDefaults({ count: 20, size: 15, move: 0.12, opacity: 0.18, opacityRandom: true, opacityAnim: true, sizeAnim: true, sizeAnimSpeed: 0.35, sizeMin: 0.35, attract: true }),
  galaxy: makeDefaults({ shape: 'star', count: 105, size: 2.8, move: 0.34, opacity: 0.62, opacityRandom: true, attract: true, links: true, linkDistance: 80, linkOpacity: 0.16 }),
  network: makeDefaults({ count: 72, size: 3, move: 0.65, opacity: 0.64, links: true, linkDistance: 150, linkOpacity: 0.45, hoverMode: 'grab', clickMode: 'push' }),
  neural: makeDefaults({ shape: 'polygon', sides: 6, count: 48, size: 4.5, move: 0.42, opacity: 0.58, links: true, linkDistance: 185, linkOpacity: 0.34, attract: true, hoverMode: 'repulse', clickMode: 'repulse' }),
  dataFlow: makeDefaults({ shape: 'edge', count: 105, size: 3, move: 1.7, opacity: 0.62, direction: 'right', straight: true, random: false, links: true, linkDistance: 75, linkOpacity: 0.18, clickMode: 'push' }),
  quantumLinks: makeDefaults({ shape: 'edge', count: 58, size: 3.5, move: 0.9, opacity: 0.58, links: true, linkDistance: 115, linkOpacity: 0.55, linkWidth: 2, attract: true, hoverMode: 'grab' }),
  snow: makeDefaults({ count: 190, size: 6, move: 1.2, opacity: 0.62, opacityRandom: true, direction: 'bottom', hoverMode: 'bubble', clickMode: 'repulse' }),
  sakura: makeDefaults({ shape: 'polygon', sides: 5, count: 48, size: 6, move: 0.5, opacity: 0.52, opacityRandom: true, direction: 'bottom-right', hoverMode: 'repulse' }),
  fireflies: makeDefaults({ shape: 'star', count: 38, size: 4.5, move: 0.25, opacity: 0.8, opacityRandom: true, opacityAnim: true, opacitySpeed: 1.8, sizeAnim: true, sizeAnimSpeed: 1.5, direction: 'top', attract: true }),
  pollen: makeDefaults({ count: 125, size: 2.5, move: 0.55, opacity: 0.46, opacityRandom: true, direction: 'top-left' }),
  matrix: makeDefaults({ shape: 'edge', count: 92, size: 5, move: 1.45, opacity: 0.52, direction: 'bottom', straight: true, random: false, opacityAnim: true, opacitySpeed: 2 }),
  triangles: makeDefaults({ shape: 'triangle', count: 45, size: 6, move: 0.62, opacity: 0.5, opacityRandom: true, hoverMode: 'repulse' }),
  cubes: makeDefaults({ shape: 'polygon', sides: 4, count: 54, size: 5, move: 0.58, opacity: 0.54, opacityRandom: true, direction: 'top-right', attract: true }),
  orbit: makeDefaults({ shape: 'polygon', sides: 6, count: 36, size: 4, move: 0.32, opacity: 0.58, links: true, linkDistance: 95, linkOpacity: 0.3, attract: true, hoverMode: 'grab' }),
  confetti: makeDefaults({ shape: 'triangle', count: 78, size: 6, move: 1.1, opacity: 0.68, opacityRandom: true, direction: 'bottom', bounce: true }),
  rain: makeDefaults({ shape: 'edge', count: 150, size: 5, move: 3.4, opacity: 0.46, direction: 'bottom', straight: true, random: false }),
  embers: makeDefaults({ count: 64, size: 4, move: 1.2, opacity: 0.74, opacityRandom: true, opacityAnim: true, opacitySpeed: 1.8, direction: 'top-right', attract: true }),
  pulse: makeDefaults({ count: 32, size: 9, move: 0.2, opacity: 0.42, opacityAnim: true, opacitySpeed: 1.4, sizeAnim: true, sizeAnimSpeed: 1.2, links: true, linkDistance: 180, linkOpacity: 0.28, hoverMode: 'bubble', clickMode: 'push' }),
}

type ParticlesJsInstance = { pJS?: { canvas?: { el?: HTMLCanvasElement }; fn?: { vendors?: { destroypJS?: () => void } } } }
type ParticlesJsWindow = Window & { particlesJS?: (id: string, options: Record<string, unknown>) => void; pJSDom?: ParticlesJsInstance[] | null }

function destroyParticles(container: HTMLDivElement) {
  const particlesWindow = window as ParticlesJsWindow
  const instance = particlesWindow.pJSDom?.find((item) => item.pJS?.canvas?.el?.parentElement === container)
  instance?.pJS?.fn?.vendors?.destroypJS?.()
  particlesWindow.pJSDom = (particlesWindow.pJSDom ?? []).filter((item) => item !== instance)
  container.replaceChildren()
}

export function StageAtmosphere({ enabled = true, intensity = 0.55, speed = 1, opacity = 1, preset = 'stardust', color = '#66e4c7', size = 1 }: StageAtmosphereProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const particlesWindow = window as ParticlesJsWindow
    if (!container || !particlesWindow.particlesJS) return
    destroyParticles(container)
    if (!enabled) return

    const defaults = presetDefaults[preset]
    const particleSize = Math.max(0.2, defaults.size * size)
    const intensityScale = Math.max(0.35, intensity)
    const opacityScale = Math.max(0, Math.min(1, opacity))
    const interactive = Boolean(defaults.hoverMode || defaults.clickMode)
    particlesWindow.particlesJS(`stage-particles-${preset}`, {
      particles: {
        number: { value: Math.round(defaults.count * intensityScale), density: { enable: true, value_area: 900 } },
        color: { value: color },
        shape: { type: defaults.shape, stroke: { width: defaults.stroke || defaults.shape === 'edge' ? 1 : 0, color }, polygon: { nb_sides: defaults.sides } },
        opacity: { value: defaults.opacity * intensityScale * opacityScale, random: defaults.opacityRandom, anim: { enable: defaults.opacityAnim, speed: defaults.opacitySpeed, opacity_min: defaults.opacity * 0.12 * opacityScale, sync: false } },
        size: { value: particleSize, random: defaults.random, anim: { enable: defaults.sizeAnim, speed: defaults.sizeAnimSpeed, size_min: Math.max(0.2, particleSize * defaults.sizeMin), sync: false } },
        line_linked: { enable: defaults.links, distance: defaults.linkDistance, color, opacity: defaults.linkOpacity * intensityScale, width: defaults.linkWidth },
        move: { enable: true, speed: defaults.move * speed, direction: defaults.direction, random: defaults.random, straight: defaults.straight, out_mode: defaults.bounce ? 'bounce' : 'out', bounce: defaults.bounce, attract: { enable: defaults.attract, rotateX: 600, rotateY: 1200 } },
      },
      interactivity: {
        detect_on: interactive ? 'window' : 'canvas',
        events: { onhover: { enable: Boolean(defaults.hoverMode), mode: defaults.hoverMode ?? 'repulse' }, onclick: { enable: Boolean(defaults.clickMode), mode: defaults.clickMode ?? 'push' }, resize: true },
        modes: {
          grab: { distance: 190, line_linked: { opacity: 0.9 } },
          bubble: { distance: 180, size: Math.max(12, particleSize * 2.5), duration: 1.2, opacity: 0.8, speed: 2 },
          repulse: { distance: 130, duration: 0.4 },
          push: { particles_nb: 4 },
          remove: { particles_nb: 2 },
        },
      },
      retina_detect: true,
    })
  }, [color, enabled, intensity, opacity, preset, size, speed])

  return <div id={`stage-particles-${preset}`} className={enabled ? 'stage-atmosphere' : 'stage-atmosphere disabled'} ref={containerRef} aria-hidden="true" />
}
