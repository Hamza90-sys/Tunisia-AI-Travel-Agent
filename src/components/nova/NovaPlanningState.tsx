import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

import { NovaAvatar } from './NovaAvatar'
import { transitions } from '@/animations'
import { NOVA_PLANNING_STEPS } from '@/data'
import { useNovaPlanning } from '@/hooks'
import { cn } from '@/lib/utils'
import type { NovaPlanningStep } from '@/types'

/**
 * NOVA's planning surface.
 *
 * Reusable on purpose — the planner uses it inline, and it is ready for the
 * trip dashboard ("NOVA is rewriting day 3") and for a modal.
 *
 * Step 1 advances the checklist on a timer via `useNovaPlanning`. Step 2 swaps
 * that controller for real agent progress events; this component does not
 * change. Nothing here claims a result: the copy describes what is being
 * considered, never a fabricated answer.
 */
export interface NovaPlanningStateProps {
  steps?: NovaPlanningStep[]
  title?: string
  footerLabel?: string
  /** Milliseconds per step while running on the Step 1 timer. */
  stepDuration?: number
  autoStart?: boolean
  onComplete?: () => void
  /** Rendered in place of the footer once every step has completed. */
  completeSlot?: ReactNode
  className?: string
}

export function NovaPlanningState({
  steps = NOVA_PLANNING_STEPS,
  title = 'Analyzing your preferences',
  footerLabel = 'Building your journey…',
  stepDuration = 950,
  autoStart = true,
  onComplete,
  completeSlot,
  className,
}: NovaPlanningStateProps) {
  const { activeIndex, completedIds, progress, isComplete } = useNovaPlanning(steps, {
    autoStart,
    stepDuration,
    onComplete,
  })

  return (
    <div
      className={cn(
        'grain relative overflow-hidden rounded-4xl border border-white/[0.08] bg-ink-900 p-7 text-canvas sm:p-9',
        className,
      )}
    >
      {/* Ambient wash so the dark surface has depth behind the orb. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-28 size-80 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(24,166,166,0.4) 0%, rgba(11,31,51,0) 70%)',
        }}
      />

      <div className="relative z-2 flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-10">
        <div className="flex items-center gap-4 sm:flex-col sm:items-start">
          <NovaAvatar state={isComplete ? 'success' : 'planning'} size="lg" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow text-sea-300">Nova</p>
          <h3
            className="mt-2 text-2xl leading-tight text-canvas sm:text-[1.75rem]"
            aria-live="polite"
          >
            {isComplete ? 'Your journey is ready' : title}
          </h3>

          <ul className="mt-7 space-y-3.5" aria-label="Planning progress">
            {steps.map((step, index) => {
              const done = completedIds.includes(step.id)
              const active = index === activeIndex
              return (
                <li key={step.id} className="flex items-start gap-3.5">
                  <StepMarker done={done} active={active} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={cn(
                        'text-sm transition-colors duration-500',
                        done ? 'text-canvas' : active ? 'text-white/80' : 'text-white/35',
                      )}
                    >
                      {step.label}
                    </p>
                    <AnimatePresence>
                      {done && step.detail && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={transitions.swift}
                          className="mt-1 text-xs text-sea-300/70"
                        >
                          {step.detail}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Progress */}
          <div className="mt-8">
            <div
              className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Itinerary progress"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sea-500 to-sand-400"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={transitions.soft}
              />
            </div>

            <div className="mt-4 min-h-6">
              <AnimatePresence mode="wait">
                {isComplete ? (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transitions.soft}
                  >
                    {completeSlot ?? (
                      <p className="text-sm text-sand-300">
                        Five days, three cities, two slow afternoons.
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    key="running"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-white/45"
                  >
                    {footerLabel}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepMarker({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span
      className={cn(
        'relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500',
        done
          ? 'border-sea-400/70 bg-sea-500/20 text-sea-200'
          : active
            ? 'border-sea-400/50 text-sea-300'
            : 'border-white/15 text-transparent',
      )}
    >
      <AnimatePresence>
        {done && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...transitions.spring, duration: 0.3 }}
          >
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>

      {active && !done && (
        <motion.span
          className="absolute inset-0 rounded-full border border-sea-400/60"
          animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden
        />
      )}
      <span className="sr-only">{done ? 'complete' : active ? 'in progress' : 'pending'}</span>
    </span>
  )
}
