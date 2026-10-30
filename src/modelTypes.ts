export type MotionConfig = {
  group: string
  label?: string
  loop?: boolean
  duration?: number
  file?: string
}

export type ExpressionConfig = {
  file: string
}

export type ModelManifest = {
  displayName?: string
  motions: Record<string, MotionConfig>
  expressions: Record<string, ExpressionConfig>
}

export type ModelSource = {
  id: string
  name: string
  modelUrl: string
  manifestUrl?: string
}

export type Model3Config = {
  Name?: string
  name?: string
  model?: string
  textures?: string[]
  motions?: Record<string, Array<{ file: string }>>
  expressions?: Array<{ name?: string; file?: string }>
  FileReferences?: {
    Motions?: Record<string, Array<{ File: string }>>
    Expressions?: Array<{ Name: string; File: string }>
  }
}
