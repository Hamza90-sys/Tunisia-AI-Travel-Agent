import { motion } from 'framer-motion'
import { CloudSun, Compass, Headset, MapPinned, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Container } from '@/components/ui'

interface Feature {
  icon: LucideIcon
  title: string
  detail: string
}

const FEATURES: Feature[] = [
  { icon: Sparkles, title: 'AI Trip Planner', detail: 'Personalized itineraries' },
  { icon: CloudSun, title: 'Real-time Info', detail: 'Weather, transport, events' },
  { icon: Compass, title: 'Local Experiences', detail: 'Authentic & unique' },
  { icon: MapPinned, title: '100% Tunisia', detail: 'From north to south' },
  { icon: Headset, title: '24/7 Support', detail: 'Always here for you' },
]

/**
 * The horizontal strip under the hero.
 *
 * Thin hairline separators and generous whitespace on desktop; a single
 * horizontal scroller on small screens so five items never crush into an
 * unreadable grid. `id="about"` anchors the header's About link, which has no
 * page of its own yet.
 */
export function FeatureStrip() {
  return (
    <section id="about" className="border-y border-hairline bg-page" aria-label="What TuniTrip offers">
      <Container size="wide">
        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ staggerChildren: 0.07 }}
          className="no-scrollbar mask-fade-x -mx-5 flex gap-0 overflow-x-auto px-5 py-6 sm:mx-0 sm:mask-none sm:px-0 md:py-7 lg:grid lg:grid-cols-5"
        >
          {FEATURES.map((feature, index) => (
            <motion.li
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
              }}
              className={[
                'flex min-w-[14rem] shrink-0 items-center gap-3 px-5 lg:min-w-0 lg:px-6',
                index > 0 ? 'border-l border-hairline' : '',
              ].join(' ')}
            >
              <feature.icon className="size-[18px] shrink-0 text-terracotta-500" strokeWidth={1.6} aria-hidden />
              <div className="min-w-0">
                <p className="text-[14px] font-medium leading-tight text-forest-900">{feature.title}</p>
                <p className="mt-0.5 truncate text-[12px] leading-tight text-muted">{feature.detail}</p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  )
}
