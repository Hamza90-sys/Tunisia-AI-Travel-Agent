/**
 * Tiny class-name joiner.
 *
 * Deliberately dependency-free: we compose variants with explicit maps rather
 * than merging arbitrary Tailwind strings, so `clsx` + `tailwind-merge` would
 * be dead weight here.
 */
export type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[]

export function cn(...values: ClassValue[]): string {
  const out: string[] = []

  for (const value of values) {
    // `true` would stringify to "true"; only strings and numbers are classes.
    if (!value || value === true) continue
    if (Array.isArray(value)) {
      const nested = cn(...value)
      if (nested) out.push(nested)
    } else {
      out.push(String(value))
    }
  }

  return out.join(' ')
}
