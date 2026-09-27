import { motion } from 'framer-motion'
import { MessageSquare, Route, WandSparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Container, SectionHeading } from '@/components/ui'
import { fadeUp, scrollReveal, staggerParent } from '@/animations'

interface Step {
  index: string
  title: string
  body: string
  icon: LucideIcon
}

const STEPS: Step[] = [
  {
    index: '01',
    title: 'Say it in your own words',
    body: 'Five days, two of us, we like ruins and long lunches, nothing too far from the coast. That is the whole brief.',
    icon: MessageSquare,
  },
  {
    index: '02',
    title: 'NOVA builds the route',
    body: 'Places that fit your pace, timed around opening hours, distance and the heat of the afternoon.',
    icon: WandSparkles,
  },
  {
    index: '03',
    title: 'Change anything by asking',
    body: 'Make tomorrow cheaper. Add a beach. Move dinner later. The itinerary adjusts around what is already booked.',
    icon: Route,
  },
]

/** How the product works, in the traveller's language rather than the model's. */
export function HowItWorks() {
  return (
    <section className="bg-page py-24 md:py-32">
      <Container size="wide">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Like talking to a local
              <br />
              who never gets tired.
            </>
          }
          description="No forms, no filters, no twelve-tab research spiral. One conversation that ends in a plan you would actually follow."
        />

        <motion.ol
          variants={staggerParent(0.12)}
          {...scrollReveal}
          className="mt-16 grid gap-px overflow-hidden rounded-4xl border border-hairline bg-hairline md:grid-cols-3"
        >
          {STEPS.map((step) => (
            <motion.li
              key={step.index}
              variants={fadeUp}
              className="group relative bg-paper p-8 transition-colors duration-500 hover:bg-paper/60 md:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm tracking-[0.2em] text-terracotta-500">
                  {step.index}
                </span>
                <span className="flex size-10 items-center justify-center rounded-full bg-terracotta-500/10 text-terracotta-500 transition-colors duration-500 group-hover:bg-terracotta-500/15">
                  <step.icon className="size-4.5" aria-hidden />
                </span>
              </div>

              <h3 className="mt-8 text-xl leading-snug text-forest-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-body">{step.body}</p>
            </motion.li>
          ))}
        </motion.ol>
      </Container>
    </section>
  )
}
