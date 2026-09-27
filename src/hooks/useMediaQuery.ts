import { useEffect, useState } from 'react'

/** Subscribes to a CSS media query. SSR-safe and cleans up after itself. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    // Re-sync on mount and whenever `query` changes: the lazy initialiser only
    // runs once, so a changed query would otherwise keep the stale result.
    setMatches((current) => (current === list.matches ? current : list.matches))
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind's `md` breakpoint. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
