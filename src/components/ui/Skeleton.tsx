import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
}

/** Loading placeholder. Uses the shared shimmer so every page waits alike. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl bg-ink-800/[0.06]', className)}
      aria-hidden
    >
      <div className="shimmer-sweep absolute inset-0" />
    </div>
  )
}

/** Matches the footprint of a `PlaceCard` so the grid does not jump. */
export function PlaceCardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-4/3 w-full rounded-3xl" />
      <div className="space-y-2 px-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

export function TimelineSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-5">
          <Skeleton className="h-4 w-12 shrink-0" />
          <Skeleton className="h-20 flex-1 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}
