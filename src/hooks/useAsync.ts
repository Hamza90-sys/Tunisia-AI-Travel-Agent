import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  error: string | null
  status: AsyncStatus
  isLoading: boolean
  /** Re-runs the loader — wired to the retry button in `ErrorState`. */
  reload: () => void
}

/**
 * Runs an async loader on mount (and whenever `deps` change) and exposes the
 * loading / success / error triple every page in this product renders.
 *
 * Small on purpose: React Query would be the right call once we have mutations
 * and cache invalidation, which arrives with the AI write-path in Step 2.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [nonce, setNonce] = useState(0)

  // Keep the latest loader without making it a dependency of the effect.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let active = true
    setStatus('loading')
    setError(null)

    loaderRef
      .current()
      .then((result) => {
        if (!active) return
        setData(result)
        setStatus('success')
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Something went wrong.')
        setStatus('error')
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data, error, status, isLoading: status === 'loading' || status === 'idle', reload }
}
