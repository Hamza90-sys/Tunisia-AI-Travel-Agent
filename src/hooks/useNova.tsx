import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { resolveNovaEndpoint, streamNovaReply } from '@/lib/nova'
import type { NovaMessage, NovaState, NovaToolCall } from '@/types'

/**
 * NOVA's client-side state.
 *
 * The agent itself runs on the server — this hook only posts a message and
 * narrates the event stream that comes back. Every state transition below is
 * driven by a real server event: `searching` appears when `search_places`
 * actually starts executing, and `success` when a real answer arrives. Nothing
 * here simulates progress, and no reply is ever fabricated: if the agent
 * cannot be reached, the traveller is told that plainly.
 */

/** How long the orb holds `success` before settling back to `idle`. */
const SUCCESS_HOLD_MS = 2400

/** What the UI shows while a tool runs. */
export interface NovaToolActivity {
  name: string
  summary: string
  status: 'running' | 'done' | 'error'
}

interface NovaContextValue {
  isOpen: boolean
  /** Opens the panel. A prompt pre-fills the composer rather than auto-sending. */
  open: (prompt?: string) => void
  close: () => void
  toggle: () => void
  state: NovaState
  setState: (state: NovaState) => void
  messages: NovaMessage[]
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  /** True when an agent endpoint is resolvable. Not a promise that it works. */
  isEngineConnected: boolean
  /** A request is in flight. */
  isResponding: boolean
  /** Last user-facing failure, cleared when the next message is sent. */
  error: string | null
  /** Live tool activity, or null when no tool is running. */
  toolActivity: NovaToolActivity | null
  /** Server conversation id once an exchange has been persisted. */
  conversationId: string | null
  /** Text handed to `open()`, consumed once by the composer. */
  initialDraft: string | null
  consumeInitialDraft: () => void
  cancel: () => void
  pendingCount: number
}

const NovaContext = createContext<NovaContextValue | null>(null)

let messageSeq = 0
function nextId(prefix: string) {
  messageSeq += 1
  return `${prefix}-${messageSeq}`
}

function createMessage(
  role: NovaMessage['role'],
  content: string,
  toolCalls?: NovaToolCall[],
): NovaMessage {
  return {
    id: nextId('msg'),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...(toolCalls?.length ? { toolCalls } : {}),
  }
}

export function NovaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<NovaState>('idle')
  const [messages, setMessages] = useState<NovaMessage[]>([])
  const [isResponding, setIsResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toolActivity, setToolActivity] = useState<NovaToolActivity | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [initialDraft, setInitialDraft] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const successTimerRef = useRef<number | null>(null)

  const isEngineConnected = useMemo(() => resolveNovaEndpoint() !== null, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
    }
  }, [])

  const open = useCallback((prompt?: string) => {
    setIsOpen(true)
    if (prompt?.trim()) setInitialDraft(prompt.trim())
  }, [])

  const consumeInitialDraft = useCallback(() => setInitialDraft(null), [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsResponding(false)
    setToolActivity(null)
    setState('idle')
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    if (!abortRef.current) setState('idle')
  }, [])

  const toggle = useCallback(() => setIsOpen((current) => !current), [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || abortRef.current) return

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }

      const controller = new AbortController()
      abortRef.current = controller

      setMessages((current) => [...current, createMessage('user', trimmed)])
      setError(null)
      setIsResponding(true)
      setState('thinking')

      const collectedCalls: NovaToolCall[] = []
      let answered = false

      try {
        for await (const event of streamNovaReply({
          message: trimmed,
          conversationId,
          signal: controller.signal,
        })) {
          switch (event.type) {
            case 'status':
              setState(event.state)
              break

            case 'tool': {
              setState(event.status === 'running' ? 'searching' : 'thinking')
              setToolActivity({
                name: event.name,
                summary: event.summary,
                status: event.status,
              })
              if (event.status !== 'running') {
                collectedCalls.push({
                  callId: `${event.name}-${collectedCalls.length + 1}`,
                  name: event.name,
                  arguments: {},
                  status: event.status === 'done' ? 'done' : 'error',
                  isError: event.status === 'error',
                })
              }
              break
            }

            case 'text':
              answered = true
              setMessages((current) => [
                ...current,
                createMessage('nova', event.content, collectedCalls),
              ])
              break

            case 'done':
              if (event.conversationId) setConversationId(event.conversationId)
              break

            case 'error':
              setError(event.message)
              setMessages((current) => [...current, createMessage('system', event.message)])
              break
          }
        }
      } catch {
        // streamNovaReply converts transport failures into error events, so
        // reaching here means the stream itself broke mid-flight.
        if (!controller.signal.aborted) {
          const message = 'NOVA stopped responding. Try again.'
          setError(message)
          setMessages((current) => [...current, createMessage('system', message)])
        }
      } finally {
        abortRef.current = null
        setToolActivity(null)
        setIsResponding(false)

        if (controller.signal.aborted) {
          setState('idle')
        } else if (answered) {
          setState('success')
          successTimerRef.current = window.setTimeout(() => {
            setState('idle')
            successTimerRef.current = null
          }, SUCCESS_HOLD_MS)
        } else {
          setState('idle')
        }
      }
    },
    [conversationId],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setConversationId(null)
  }, [])

  const value = useMemo<NovaContextValue>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      state,
      setState,
      messages,
      sendMessage,
      clearMessages,
      isEngineConnected,
      isResponding,
      error,
      toolActivity,
      conversationId,
      initialDraft,
      consumeInitialDraft,
      cancel,
      pendingCount: messages.filter((message) => message.role === 'user').length,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      state,
      messages,
      sendMessage,
      clearMessages,
      isEngineConnected,
      isResponding,
      error,
      toolActivity,
      conversationId,
      initialDraft,
      consumeInitialDraft,
      cancel,
    ],
  )

  return <NovaContext.Provider value={value}>{children}</NovaContext.Provider>
}

export function useNova(): NovaContextValue {
  const context = useContext(NovaContext)
  if (!context) throw new Error('useNova must be used inside <NovaProvider>')
  return context
}
