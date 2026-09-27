import { useState } from 'react'
import { motion } from 'framer-motion'

import { NovaAvatar, NovaPlanningState } from '@/components/nova'
import { Container, SectionHeading } from '@/components/ui'
import { fadeUp, scrollReveal, staggerParent } from '@/animations'
import { cn } from '@/lib/utils'
import { NOVA_STATES } from '@/types'
import type { NovaState } from '@/types'

const STATE_COPY: Record<NovaState, string> = {
  idle: 'Waiting, listening.',
  thinking: 'Reading what you asked for.',
  searching: 'Looking through Tunisia.',
  planning: 'Assembling the route.',
  success: 'Your journey is ready.',
}

/**
 * NOVA's identity, shown rather than described.
 *
 * Doubles as a live component gallery: every orb below is the same
 * `<NovaAvatar />` the product uses, with only the `state` prop changed.
 */
export function NovaShowcase() {
  const [active, setActive] = useState<NovaState>('planning')

  return (
    <section className="grain relative overflow-hidden bg-forest-900 py-24 text-ivory-50 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/4 size-[36rem] rounded-full opacity-50 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(24,166,166,0.28) 0%, rgba(7,19,31,0) 68%)',
        }}
      />

      <Container size="wide" className="relative z-2">
        <SectionHeading
          onDark
          eyebrow="Meet Nova"
          title={
            <>
              Not a chatbot in a corner.
              <br />
              The centre of the product.
            </>
          }
          description="NOVA has a face made of light, not pixels of a robot. One orb, five states — you always know whether it is listening, looking or building."
        />

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          {/* State gallery */}
          <div>
            <motion.div
              variants={staggerParent(0.08)}
              {...scrollReveal}
              className="grid grid-cols-5 gap-2 sm:gap-4"
            >
              {NOVA_STATES.map((state) => (
                <motion.button
                  key={state}
                  variants={fadeUp}
                  type="button"
                  onClick={() => setActive(state)}
                  aria-pressed={active === state}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-3xl border px-1 py-5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    active === state
                      ? 'border-terracotta-400/40 bg-white/[0.06]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20',
                  )}
                >
                  <NovaAvatar state={state} size={48} glow={active === state} />
                  <span
                    className={cn(
                      'text-[10px] font-medium uppercase tracking-[0.12em]',
                      active === state ? 'text-terracotta-300' : 'text-white/35',
                    )}
                  >
                    {state}
                  </span>
                </motion.button>
              ))}
            </motion.div>

            <motion.div
              {...scrollReveal}
              variants={fadeUp}
              className="mt-10 flex items-center gap-6 rounded-4xl border border-white/[0.07] bg-white/[0.02] p-7"
            >
              <NovaAvatar state={active} size="lg" />
              <div>
                <p className="eyebrow text-white/35">{active}</p>
                <p className="mt-2 text-lg leading-snug text-ivory-50">{STATE_COPY[active]}</p>
              </div>
            </motion.div>
          </div>

          {/* Live planning surface */}
          <motion.div {...scrollReveal} variants={fadeUp}>
            <NovaPlanningState stepDuration={1400} />
            <p className="mt-4 px-1 text-xs leading-relaxed text-white/30">
              The planning surface shown above is the real component. In this preview build it
              advances on a timer — the reasoning engine connects next.
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
