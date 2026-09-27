import { ArrowUp } from 'lucide-react'
import { useState } from 'react'

import { NovaAvatar } from './NovaAvatar'
import { cn } from '@/lib/utils'
import type { NovaState } from '@/types'

export interface NovaInlinePromptProps {
  placeholder?: string
  /** Called with the trimmed value on submit. */
  onSubmit: (value: string) => void
  /** Controls the orb next to the field. */
  novaState?: NovaState
  autoFocus?: boolean
  className?: string
  label: string
}

/**
 * The large conversational field.
 *
 * Shared between the planner hero and any future "ask anything" surface, so
 * the product has exactly one way of asking the traveller to talk to NOVA.
 */
export function NovaInlinePrompt({
  placeholder = 'Tell me about your journey…',
  onSubmit,
  novaState = 'idle',
  autoFocus,
  className,
  label,
}: NovaInlinePromptProps) {
  const [value, setValue] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = value.trim()
        if (!trimmed) return
        onSubmit(trimmed)
      }}
      className={cn(
        'group relative flex items-end gap-3 rounded-4xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm transition-colors duration-300 focus-within:border-sea-400/45 sm:gap-4 sm:p-4',
        className,
      )}
    >
      <div className="hidden shrink-0 self-center pl-1 sm:block">
        <NovaAvatar state={novaState} size="md" />
      </div>

      <label htmlFor="nova-journey-input" className="sr-only">
        {label}
      </label>
      <textarea
        id="nova-journey-input"
        rows={3}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder={placeholder}
        className="min-h-24 flex-1 resize-none self-center bg-transparent py-2 text-base leading-relaxed text-canvas placeholder:text-white/30 focus:outline-none sm:text-[17px]"
      />

      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Send to NOVA"
        className="flex size-11 shrink-0 items-center justify-center self-end rounded-full bg-sea-500 text-white transition-all duration-300 hover:bg-sea-400 disabled:bg-white/10 disabled:text-white/30"
      >
        <ArrowUp className="size-4.5" aria-hidden />
      </button>
    </form>
  )
}
