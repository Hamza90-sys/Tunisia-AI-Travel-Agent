import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, CircleAlert, Search, Square, X } from 'lucide-react'

import { NovaAvatar } from './NovaAvatar'
import { overlayFade, panelFromBottom, panelFromRight, transitions } from '@/animations'
import { NOVA_SUGGESTIONS } from '@/data'
import { useIsDesktop, useLockBodyScroll, useNova } from '@/hooks'
import { AI_NAME, AI_TAGLINE, cn } from '@/lib/utils'

/**
 * NOVA's global assistant panel.
 *
 * Right-hand drawer on desktop, bottom sheet on mobile. Everything it shows is
 * real: assistant text comes from the server agent, and the tool chip appears
 * only while `search_places` is genuinely executing. Internal prompts, tool
 * arguments, RPC names and similarity scores never reach this component.
 */
export function NovaPanel() {
  const {
    isOpen,
    close,
    messages,
    sendMessage,
    isEngineConnected,
    isResponding,
    toolActivity,
    error,
    initialDraft,
    consumeInitialDraft,
    cancel,
  } = useNova()

  const isDesktop = useIsDesktop()
  // null means "untouched", so a prompt handed to open() can show through
  // without an effect copying context into local state.
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useLockBodyScroll(isOpen && !isDesktop)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    // Give the entrance animation a beat before stealing focus.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 240)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [isOpen, close])

  // A prompt passed to open() pre-fills the composer rather than firing a
  // request the traveller did not ask for. Derived, not synchronised.
  const composerValue = draft ?? initialDraft ?? ''

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, toolActivity])

  const submit = (value: string) => {
    const text = value.trim()
    if (!text || isResponding) return
    setDraft('')
    consumeInitialDraft()
    void sendMessage(text)
    inputRef.current?.focus()
  }

  const hasTranscript = messages.length > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="nova-overlay"
            variants={overlayFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={close}
            className="fixed inset-0 z-40 bg-ink-950/45 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.aside
            key="nova-panel"
            variants={isDesktop ? panelFromRight : panelFromBottom}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={`${AI_NAME} assistant`}
            className={cn(
              'grain fixed z-50 flex flex-col border-white/[0.08] bg-ink-900 text-canvas shadow-panel',
              'inset-x-0 bottom-0 max-h-[86dvh] rounded-t-4xl border-t',
              'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[27rem] md:rounded-none md:rounded-l-4xl md:border-l md:border-t-0',
            )}
          >
            {/* Header */}
            <header className="relative z-2 flex items-start gap-4 border-b border-white/[0.07] px-6 py-5">
              <NovaAvatar state={isResponding ? 'thinking' : 'idle'} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl leading-none tracking-tight text-canvas">
                  {AI_NAME}
                </p>
                <p className="mt-1.5 text-xs text-white/45">{AI_TAGLINE}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close assistant"
                className="-mr-1.5 -mt-1 rounded-full p-2 text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <X className="size-4.5" aria-hidden />
              </button>
            </header>

            {/* Body */}
            <div className="relative z-2 flex-1 overflow-y-auto px-6 py-6">
              {!hasTranscript && (
                <>
                  <h2 className="text-[1.375rem] leading-snug text-canvas">What can I change?</h2>

                  <div className="mt-5 flex flex-col gap-2">
                    {NOVA_SUGGESTIONS.map((suggestion, index) => (
                      <motion.button
                        key={suggestion.id}
                        type="button"
                        onClick={() => submit(suggestion.label)}
                        disabled={isResponding}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...transitions.soft, delay: 0.06 * index }}
                        className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-sm text-white/75 transition-all duration-300 hover:border-sea-400/40 hover:bg-sea-500/[0.08] hover:text-canvas disabled:opacity-40"
                      >
                        <suggestion.icon
                          className="size-4 shrink-0 text-sea-300/70 transition-colors group-hover:text-sea-300"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
                        <ArrowUp
                          className="size-3.5 shrink-0 rotate-45 text-white/20 transition-colors group-hover:text-sea-300"
                          aria-hidden
                        />
                      </motion.button>
                    ))}
                  </div>
                </>
              )}

              {hasTranscript && (
                <div className="space-y-3" aria-live="polite">
                  {messages.map((message) => (
                    <NovaMessageBubble key={message.id} message={message} />
                  ))}
                </div>
              )}

              {/* Real tool activity — only while a tool is actually running. */}
              <AnimatePresence>
                {toolActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={transitions.swift}
                    className="mt-3 mr-6 flex items-center gap-2.5 rounded-full border border-sea-400/25 bg-sea-500/[0.08] px-3.5 py-2 text-xs text-sea-200"
                  >
                    <Search className="size-3.5 shrink-0 animate-pulse" aria-hidden />
                    <span className="truncate">{toolActivity.summary}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={transcriptEndRef} />
            </div>

            {/* Composer */}
            <footer className="relative z-2 border-t border-white/[0.07] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit(composerValue)
                }}
                className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] pl-5 pr-1.5 transition-colors focus-within:border-sea-400/50"
              >
                <label htmlFor="nova-input" className="sr-only">
                  Ask {AI_NAME}
                </label>
                <input
                  id="nova-input"
                  ref={inputRef}
                  value={composerValue}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={isResponding ? `${AI_NAME} is thinking…` : `Ask ${AI_NAME}…`}
                  autoComplete="off"
                  disabled={isResponding}
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm text-canvas placeholder:text-white/30 focus:outline-none disabled:text-white/40"
                />
                {isResponding ? (
                  <button
                    type="button"
                    onClick={cancel}
                    aria-label="Stop NOVA"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/15 hover:text-canvas"
                  >
                    <Square className="size-3.5 fill-current" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!composerValue.trim()}
                    aria-label="Send to NOVA"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sea-500 text-white transition-all duration-300 hover:bg-sea-400 disabled:bg-white/10 disabled:text-white/30"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                )}
              </form>

              {!isEngineConnected && !error && (
                <p className="mt-3 text-center text-[11px] leading-relaxed text-white/30">
                  NOVA is not connected in this environment. Set the agent endpoint to enable
                  conversations.
                </p>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/** One transcript bubble. `nova` is a real model answer; `system` is a notice. */
function NovaMessageBubble({ message }: { message: { role: string; content: string } }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.swift}
        className="ml-6 rounded-2xl bg-sea-500/14 px-4 py-3 text-sm leading-relaxed text-canvas"
      >
        {message.content}
      </motion.div>
    )
  }

  if (message.role === 'system') {
    return (
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.swift}
        className="mr-6 flex gap-2.5 rounded-2xl border border-critical/30 bg-critical/[0.1] px-4 py-3 text-sm leading-relaxed text-white/75"
      >
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-critical" aria-hidden />
        <span>{message.content}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.swift}
      className="mr-6 flex gap-3"
    >
      <NovaAvatar state="idle" size={22} glow={false} className="mt-0.5" />
      <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
        {message.content}
      </div>
    </motion.div>
  )
}
