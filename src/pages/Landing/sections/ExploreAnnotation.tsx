import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

/**
 * The hand-written "Explore Tunisia" note and its curved arrow.
 *
 * Sits to the right of the photograph, so the arrow sweeps back leftward
 * toward the image and card cluster. Text and SVG rather than part of any
 * photograph, so it stays crisp, scales with the layout, and is readable.
 */
export function ExploreAnnotation({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
      className={cn('pointer-events-none w-[7.5rem] select-none text-right', className)}
    >
      <p className="font-script text-[1.75rem] leading-[0.95] text-terracotta-500">
        Explore
        <br />
        Tunisia
      </p>

      <svg
        viewBox="0 0 120 80"
        aria-hidden
        className="mt-1 h-14 w-full text-terracotta-400"
        fill="none"
      >
        {/* Sweeps right-to-left, back toward the photograph. */}
        <motion.path
          d="M112 6c4 24-6 47-34 59-21 9-45 8-70-3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 1 }}
        />
        {/* Arrowhead at the left end, pointing at the image. */}
        <motion.path
          d="M24 50c-6 4-11 8-16 11 6 2 11 6 14 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 1.8 }}
        />
      </svg>
    </motion.div>
  )
}
