import { motion } from 'framer-motion'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ROUTES, cn } from '@/lib/utils'

/**
 * The floating "AI plan suggestions" card over the hero photograph.
 *
 * Sized as a detail, not a panel: ~11.5rem wide with tight padding, so it sits
 * on the upper right of the frame without covering much of the photograph.
 * Every border, shadow and corner is CSS — nothing is baked into an image.
 *
 * Static presentation content for the landing page; it does not call the NOVA
 * agent. Tapping through hands off to the real planner route.
 */
export function NovaSuggestionCard({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.7 }}
      className={cn('w-[10.5rem] max-w-[62vw] sm:w-[11.5rem]', className)}
    >
      <Link
        to={ROUTES.planner}
        className="group block rounded-2xl border border-white/70 bg-paper/95 p-3 shadow-float backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3 shrink-0 text-terracotta-500" aria-hidden />
          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted">
            AI plan suggestions
          </span>
        </div>

        <p className="mt-2 font-display text-[13px] leading-snug text-forest-900">
          3 days in Sidi Bou Said
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-body">
            Carthage <span className="text-hairline-strong">•</span> Tunis
          </p>
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest-800 text-ivory-100 transition-colors duration-300 group-hover:bg-terracotta-500"
          >
            <ArrowUpRight className="size-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
