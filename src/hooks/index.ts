// 各 Context 的读取 hook 与各自的 Context 定义放在一起（contexts/XxxProvider/XxxContext.ts），
// 这里只做统一的导入出口，业务代码统一从 'hooks' 取。
// 独立 hook 一律按目录组织：useXxx/index.ts（实现），需要请求协议的再加 useXxx/api.ts。
export { useLiveData } from '../contexts/LiveDataProvider/LiveDataContext'
export { useModel } from '../contexts/ModelProvider/ModelContext'
export { useStage } from '../contexts/StageProvider/StageContext'
export { useVoice } from '../contexts/VoiceProvider/VoiceContext'
export { useMusic } from '../contexts/MusicProvider/MusicContext'
export { useLiveServer, describeRoomState } from './useLiveServer'
export type { LiveFeedItem, LiveRoomStats, LiveRoomState } from './useLiveServer'
export { useTts } from './useTts'
export type { SpeakingModel, UseTtsResult } from './useTts'
export { useDragPosition } from './useDragPosition'
