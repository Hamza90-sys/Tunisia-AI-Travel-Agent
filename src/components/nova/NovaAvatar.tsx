import { useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'
import type { NovaState } from '@/types'

/**
 * NOVA — the AI's visual identity.
 *
 * A luminous Mediterranean orb: turquoise core, wave patterns moving inside,
 * soft glow. No face, no robot, no stock AI iconography. Everything is drawn
 * in SVG so it stays crisp at 24px in a nav bar and at 320px on the hero.
 *
 * Each state changes tempo and adds one signal, never the whole composition —
 * so the orb stays recognisable as the same object throughout the product:
 *
 *   idle       calm breath, slow waves
 *   thinking   faster pulse, ring accelerates
 *   searching  a satellite point orbits the rim
 *   planning   concentric rings expand outward
 *   success    a single bloom settles into a sand-lit rim
 */

export type NovaAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<NovaAvatarSize, number> = {
  xs: 24,
  sm: 36,
  md: 56,
  lg: 104,
  xl: 176,
}

interface StateConfig {
  /** Seconds for one breath cycle of the orb body. */
  breath: number
  /** Seconds for one wave period. */
  waveSpeed: number
  /** Seconds for a full rotation of the accent ring; negative reverses. */
  ringSpin: number
  /** Outer glow opacity. */
  glow: number
  /** Peak scale of the breath. */
  breathScale: number
}

const STATES: Record<NovaState, StateConfig> = {
  idle: { breath: 6, waveSpeed: 9, ringSpin: 26, glow: 0.42, breathScale: 1.025 },
  thinking: { breath: 2.4, waveSpeed: 3.4, ringSpin: 9, glow: 0.72, breathScale: 1.05 },
  searching: { breath: 3.2, waveSpeed: 2.4, ringSpin: 4.5, glow: 0.66, breathScale: 1.035 },
  planning: { breath: 4, waveSpeed: 5, ringSpin: -12, glow: 0.7, breathScale: 1.04 },
  success: { breath: 5, waveSpeed: 7, ringSpin: 30, glow: 0.8, breathScale: 1.03 },
}

const WAVE_ROWS = [
  { y: 54, amp: 5, width: 1.1, opacity: 0.85, speed: 1 },
  { y: 62, amp: 4, width: 0.9, opacity: 0.6, speed: 1.35 },
  { y: 70, amp: 3, width: 0.8, opacity: 0.4, speed: 1.75 },
]

export interface NovaAvatarProps {
  state?: NovaState
  size?: NovaAvatarSize | number
  /** Outer atmospheric glow. Turn off in dense layouts. */
  glow?: boolean
  className?: string
  /** Overrides the accessible label. */
  label?: string
}

export function NovaAvatar({
  state = 'idle',
  size = 'md',
  glow = true,
  className,
  label,
}: NovaAvatarProps) {
  const uid = useId().replace(/:/g, '')
  const reduceMotion = useReducedMotion()
  const px = typeof size === 'number' ? size : SIZE_PX[size]
  const config = STATES[state]

  // Below ~40px the interior detail turns to mud; simplify instead.
  const isCompact = px < 40

  const ids = {
    core: `nova-core-${uid}`,
    rim: `nova-rim-${uid}`,
    wave: `nova-wave-${uid}`,
    clip: `nova-clip-${uid}`,
    ring: `nova-ring-${uid}`,
  }

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: px, height: px }}
      role="img"
      aria-label={label ?? `NOVA, ${state}`}
    >
      {/* Atmospheric glow — sits behind the orb, never clipped by it. */}
      {glow && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[35%] rounded-full"
          style={{
            background:
              state === 'success'
                ? 'radial-gradient(circle, rgba(216,180,122,0.55) 0%, rgba(24,166,166,0.32) 42%, transparent 68%)'
                : 'radial-gradient(circle, rgba(53,189,187,0.55) 0%, rgba(24,166,166,0.22) 45%, transparent 68%)',
            filter: 'blur(10px)',
          }}
          animate={
            reduceMotion
              ? { opacity: config.glow * 0.8 }
              : { opacity: [config.glow * 0.6, config.glow, config.glow * 0.6] }
          }
          transition={{ duration: config.breath, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.svg
        viewBox="0 0 100 100"
        className="relative size-full overflow-visible"
        aria-hidden
        animate={reduceMotion ? { scale: 1 } : { scale: [1, config.breathScale, 1] }}
        transition={{ duration: config.breath, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          {/* Orb body: bright turquoise core falling away to deep navy. */}
          <radialGradient id={ids.core} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#9BEDE8" />
            <stop offset="24%" stopColor="#35BDBB" />
            <stop offset="58%" stopColor="#0D6B6D" />
            <stop offset="86%" stopColor="#0B1F33" />
            <stop offset="100%" stopColor="#07131F" />
          </radialGradient>

          {/* Rim light along the lower-right edge. */}
          <linearGradient id={ids.rim} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D2F2F0" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#18A6A6" stopOpacity="0.25" />
            <stop
              offset="100%"
              stopColor={state === 'success' ? '#E3C795' : '#6ED4D0'}
              stopOpacity="0.9"
            />
          </linearGradient>

          <linearGradient id={ids.wave} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D2F2F0" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#EDFAF9" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#D2F2F0" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id={ids.ring} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ED4D0" stopOpacity="0" />
            <stop offset="55%" stopColor="#6ED4D0" stopOpacity="0.55" />
            <stop
              offset="100%"
              stopColor={state === 'success' ? '#D8B47A' : '#A6E6E2'}
              stopOpacity="0.95"
            />
          </linearGradient>

          <clipPath id={ids.clip}>
            <circle cx="50" cy="50" r="37" />
          </clipPath>
        </defs>

        {/* Orb body */}
        <circle cx="50" cy="50" r="37" fill={`url(#${ids.core})`} />

        {/* Wave interior — the Mediterranean inside the orb. */}
        {!isCompact && (
          <g clipPath={`url(#${ids.clip})`}>
            {WAVE_ROWS.map((wave, index) => (
              <motion.g
                key={index}
                animate={reduceMotion ? { x: 0 } : { x: [0, -50] }}
                transition={{
                  duration: config.waveSpeed * wave.speed,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <path
                  d={`M-50 ${wave.y} q 12.5 -${wave.amp} 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0`}
                  fill="none"
                  stroke={`url(#${ids.wave})`}
                  strokeWidth={wave.width}
                  strokeLinecap="round"
                  opacity={wave.opacity}
                />
              </motion.g>
            ))}

            {/* Specular highlight, kept inside the sphere. */}
            <ellipse cx="37" cy="31" rx="15" ry="10" fill="#EDFAF9" opacity="0.16" />
          </g>
        )}

        {/* Rim light */}
        <circle cx="50" cy="50" r="37" fill="none" stroke={`url(#${ids.rim})`} strokeWidth="1.1" />

        {/* Accent ring — an incomplete orbit, so rotation reads clearly. */}
        {!isCompact && (
          <motion.g
            style={{ transformOrigin: '50px 50px' }}
            animate={reduceMotion ? { rotate: 0 } : { rotate: config.ringSpin > 0 ? 360 : -360 }}
            transition={{
              duration: Math.abs(config.ringSpin),
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={`url(#${ids.ring})`}
              strokeWidth="0.9"
              strokeDasharray="96 190"
              strokeLinecap="round"
            />
          </motion.g>
        )}

        <StateSignal state={state} reduceMotion={Boolean(reduceMotion)} compact={isCompact} />
      </motion.svg>
    </div>
  )
}

/** The one extra mark that distinguishes each state. */
function StateSignal({
  state,
  reduceMotion,
  compact,
}: {
  state: NovaState
  reduceMotion: boolean
  compact: boolean
}) {
  if (compact) return null

  return (
    <AnimatePresence mode="wait">
      {state === 'searching' && (
        <motion.g
          key="searching"
          style={{ transformOrigin: '50px 50px' }}
          initial={{ opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 360 }}
          exit={{ opacity: 0 }}
          transition={{
            rotate: { duration: 2.6, repeat: Infinity, ease: 'linear' },
            opacity: { duration: 0.3 },
          }}
        >
          <circle cx="50" cy="5" r="2.6" fill="#A6E6E2" />
          <circle cx="50" cy="5" r="5.4" fill="#A6E6E2" opacity="0.22" />
        </motion.g>
      )}

      {state === 'planning' && (
        <motion.g
          key="planning"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[0, 1, 2].map((index) => (
            <motion.circle
              key={index}
              cx="50"
              cy="50"
              r="37"
              fill="none"
              stroke="#6ED4D0"
              strokeWidth="0.7"
              style={{ transformOrigin: '50px 50px' }}
              initial={{ scale: 0.72, opacity: 0 }}
              animate={
                reduceMotion
                  ? { scale: 1.08, opacity: 0.22 }
                  : { scale: [0.72, 1.3], opacity: [0.5, 0] }
              }
              transition={{
                duration: 2.8,
                repeat: Infinity,
                delay: index * 0.9,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.g>
      )}

      {state === 'success' && (
        <motion.g
          key="success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.circle
            cx="50"
            cy="50"
            r="37"
            fill="none"
            stroke="#D8B47A"
            strokeWidth="1"
            style={{ transformOrigin: '50px 50px' }}
            initial={{ scale: 0.9, opacity: 0.9 }}
            animate={{ scale: 1.34, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
          <motion.circle
            cx="50"
            cy="50"
            r="37"
            fill="#EDFAF9"
            style={{ transformOrigin: '50px 50px' }}
            initial={{ opacity: 0.42, scale: 1 }}
            animate={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </motion.g>
      )}
    </AnimatePresence>
  )
}
