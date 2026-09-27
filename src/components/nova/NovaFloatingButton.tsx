import { motion, useReducedMotion } from 'framer-motion'

import { NovaAvatar } from './NovaAvatar'
import { transitions } from '@/animations'
import { useNova } from '@/hooks'
import { AI_NAME, cn } from '@/lib/utils'

/**
 * Global entry point to NOVA.
 *
 * Sits above the mobile tab bar so it never covers navigation, collapses to a
 * circle on small screens, and hides itself while the panel is open.
 */
export function NovaFloatingButton({ className }: { className?: string }) {
  const { isOpen, open, pendingCount } = useNova()
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={() => open()}
      aria-label={`Ask ${AI_NAME}`}
      aria-expanded={isOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: isOpen ? 0 : 1, y: isOpen ? 16 : 0 }}
      transition={transitions.soft}
      style={{ pointerEvents: isOpen ? 'none' : 'auto' }}
      className={cn(
        'group fixed bottom-24 right-5 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-ink-900/95 py-2.5 pl-2.5 pr-3 text-canvas shadow-panel backdrop-blur-md transition-colors hover:border-sea-400/40 md:bottom-8 md:right-8 md:pr-5',
        className,
      )}
    >
      {/* Slow halo so the button reads as "alive" without demanding attention. */}
      {!reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border border-sea-400/40"
          animate={{ scale: [1, 1.18], opacity: [0.45, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      <NovaAvatar state="idle" size="sm" glow={false} />

      <span className="hidden text-sm font-medium tracking-tight md:inline">Ask {AI_NAME}</span>

      {pendingCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-sand-500 text-[10px] font-semibold text-ink-900"
          aria-label={`${pendingCount} saved requests`}
        >
          {pendingCount}
        </span>
      )}
    </motion.button>
  )
}
