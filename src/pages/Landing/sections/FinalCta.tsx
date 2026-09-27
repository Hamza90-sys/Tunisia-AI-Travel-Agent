import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { NovaAvatar } from '@/components/nova'
import { ButtonLink, Container } from '@/components/ui'
import { fadeUp, scrollReveal, staggerParent } from '@/animations'
import { ROUTES } from '@/lib/utils'

export function FinalCta() {
  return (
    <section className="bg-page pb-24 md:pb-32">
      <Container size="wide">
        <motion.div
          variants={staggerParent(0.1)}
          {...scrollReveal}
          className="grain relative isolate overflow-hidden rounded-5xl bg-forest-800 px-6 py-20 text-center text-ivory-50 sm:px-12 md:py-28"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 70% at 50% 0%, rgba(24,166,166,0.32) 0%, rgba(11,31,51,0) 62%), radial-gradient(60% 60% at 80% 100%, rgba(216,180,122,0.2) 0%, rgba(11,31,51,0) 60%)',
            }}
          />

          <motion.div variants={fadeUp} className="relative z-2 flex justify-center">
            <NovaAvatar state="idle" size={96} />
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="relative z-2 mt-10 text-[clamp(2rem,6vw,3.5rem)] uppercase leading-[0.98] tracking-[-0.025em]"
          >
            What if visiting Tunisia
            <br />
            was as simple as talking to a local?
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="relative z-2 mx-auto mt-7 max-w-md text-[15px] leading-relaxed text-white/55"
          >
            Tell NOVA what kind of week you want. Get a route you can change with a sentence.
          </motion.p>

          <motion.div variants={fadeUp} className="relative z-2 mt-10 flex justify-center">
            <ButtonLink
              to={ROUTES.planner}
              variant="onDark"
              size="lg"
              className="group"
              iconAfter={
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden
                />
              }
            >
              Plan my journey
            </ButtonLink>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  )
}
