// 各 Context 的读取 hook 与各自的 Context 定义放在一起（contexts/XxxProvider/XxxContext.ts），
// 这里只做统一的导入出口，业务代码统一从 'hooks' 取。
// 独立 hook 一律按目录组织：useXxx/index.ts（实现），需要请求协议的再加 useXxx/api.ts。
export { useLiveData } from '../contexts/LiveDataProvider/LiveDataContext'
export { GIFT_MOTION_ANY_MODEL, resolveGiftMotion, giftMotionTargets } from '../data/giftMotions'
export type { GiftMotionMap, GiftMotionTarget, MotionModel } from '../data/giftMotions'
export { useModel } from '../contexts/ModelProvider/ModelContext'
export { useStage } from '../contexts/StageProvider/StageContext'
export { useVoice } from '../contexts/VoiceProvider/VoiceContext'
export { useMusic } from '../contexts/MusicProvider/MusicContext'
export { useAiChat } from '../contexts/AiChatProvider/AiChatContext'
export { useLiveServer, describeRoomState } from './useLiveServer'
export type { LiveFeedItem, LiveRoomStats, LiveRoomState } from './useLiveServer'
export { useTts } from './useTts'
export type { SpeakingModel, UseTtsResult } from './useTts'
export { useChatCommand } from './useChatCommand'
export type { ChatCommandResult } from './useChatCommand'
export { useDragPosition } from './useDragPosition'
export { useHoverScrollbar } from './useHoverScrollbar'
