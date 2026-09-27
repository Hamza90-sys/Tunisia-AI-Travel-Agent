import { useCallback, useEffect, useRef, useState } from 'react'

import type { NovaPlanningStep } from '@/types'

export interface NovaPlanningOptions {
  /** Milliseconds each step takes to "complete". */
  stepDuration?: number
  /** Start as soon as the component mounts. */
  autoStart?: boolean
  onComplete?: () => void
}

export interface NovaPlanningController {
  /** Index of the step currently in progress; -1 when idle or finished. */
  activeIndex: number
  completedIds: string[]
  /** 0–1, used for the progress bar. */
  progress: number
  isRunning: boolean
  isComplete: boolean
  start: () => void
  reset: () => void
}

/**
 * Drives the NOVA planning sequence.
 *
 * Step 1 advances on a timer so the planning experience can be designed and
 * demoed. The controller's shape is what matters: in Step 2 the same component
 * is fed by real agent progress events (one per tool call) instead of a timer,
 * with no change to `NovaPlanningState`.
 */
export function useNovaPlanning(
  steps: NovaPlanningStep[],
  options: NovaPlanningOptions = {},
): NovaPlanningController {
  const { stepDuration = 900, autoStart = false, onComplete } = options

  const [activeIndex, setActiveIndex] = useState(autoStart ? 0 : -1)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)

  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  const start = useCallback(() => {
    setCompletedIds([])
    setIsComplete(false)
    setActiveIndex(0)
  }, [])

  const reset = useCallback(() => {
    setCompletedIds([])
    setIsComplete(false)
    setActiveIndex(-1)
  }, [])

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= steps.length) return

    const step = steps[activeIndex]
    const timer = window.setTimeout(() => {
      setCompletedIds((current) => [...current, step.id])
      if (activeIndex === steps.length - 1) {
        setActiveIndex(-1)
        setIsComplete(true)
        onCompleteRef.current?.()
      } else {
        setActiveIndex(activeIndex + 1)
      }
    }, stepDuration)

    return () => window.clearTimeout(timer)
  }, [activeIndex, steps, stepDuration])

  return {
    activeIndex,
    completedIds,
    progress: steps.length ? completedIds.length / steps.length : 0,
    isRunning: activeIndex >= 0,
    isComplete,
    start,
    reset,
  }
}
