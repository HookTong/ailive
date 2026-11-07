import { createContext, useContext } from 'react'
import type { AiChatSettings } from './storage'

/** 一条已完成的回复记录（按时间倒序，最多保留若干条） */
export type AiReplyRecord = {
  at: number
  /** command = 弹幕指令的执行结果反馈，文案是确定的，没经过模型 */
  kind: 'chat' | 'gift' | 'member' | 'command'
  /** 触发这条回复的观众与内容摘要 */
  question: string
  reply: string
  /** 由哪个模型说出来的 */
  modelId: string
}

/** 自动回复的工作状态；off 表示没配置 Key 或开关没开 */
export type AiChatStatus = 'off' | 'idle' | 'thinking' | 'speaking'

/** 本次会话累计的 token 用量（用来按单价折算模型花费） */
export type AiChatUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 成功发出的请求次数 */
  calls: number
}

export type AiChatContextValue = {
  settings: AiChatSettings
  /** 保存设置并落盘 */
  persistSettings: (next: AiChatSettings) => void
  /** 配置弹窗开关 */
  aiConfigOpen: boolean
  openAiConfig: () => void
  closeAiConfig: () => void
  status: AiChatStatus
  /** 排队等回复的事件数 */
  pendingCount: number
  /** 最近的 AI 回复（新的在前） */
  replies: AiReplyRecord[]
  /** 累计 token 用量，含被去重丢弃的回复（那些 token 也真花了） */
  usage: AiChatUsage
  /** 最近一次调用失败的原因；成功后清空 */
  error: string
  clearError: () => void
}

export const AiChatContext = createContext<AiChatContextValue | null>(null)

export function useAiChat(): AiChatContextValue {
  const value = useContext(AiChatContext)
  if (!value) throw new Error('useAiChat 必须在 AiChatProvider 内使用')
  return value
}
