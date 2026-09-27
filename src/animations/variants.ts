import type { Transition, Variants } from 'framer-motion'

/**
 * Shared motion language.
 *
 * One rule governs everything here: motion should make the interface feel
 * considered, never draw attention to itself. Long, soft easing; short
 * distances; opacity and transform only.
 */
export const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const
export const EASE_SWIFT = [0.4, 0, 0.2, 1] as const

export const transitions = {
  soft: { duration: 0.6, ease: EASE_PREMIUM } satisfies Transition,
  swift: { duration: 0.28, ease: EASE_SWIFT } satisfies Transition,
  panel: { duration: 0.42, ease: EASE_PREMIUM } satisfies Transition,
  spring: { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 } satisfies Transition,
}

/** Fade + lift. The default entrance for almost everything. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transitions.soft },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.soft },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.soft },
}

/** Parent wrapper that staggers its children's `visible` state. */
export function staggerParent(stagger = 0.08, delayChildren = 0.04): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  }
}

/** Slide-in for the NOVA panel: from the right on desktop, bottom on mobile. */
export const panelFromRight: Variants = {
  hidden: { opacity: 0, x: 48 },
  visible: { opacity: 1, x: 0, transition: transitions.panel },
  exit: { opacity: 0, x: 48, transition: transitions.swift },
}

export const panelFromBottom: Variants = {
  hidden: { opacity: 0, y: 64 },
  visible: { opacity: 1, y: 0, transition: transitions.panel },
  exit: { opacity: 0, y: 64, transition: transitions.swift },
}

export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.swift },
  exit: { opacity: 0, transition: transitions.swift },
}

/** Viewport config for scroll-triggered sections. */
export const scrollReveal = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, amount: 0.25 },
}
