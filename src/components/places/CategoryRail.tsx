import { Chip } from '@/components/ui'
import { PLACE_CATEGORY_META } from '@/data'
import { cn } from '@/lib/utils'
import type { PlaceCategory } from '@/types'

export type CategoryFilter = PlaceCategory | 'all'

export interface CategoryRailProps {
  value: CategoryFilter
  onChange: (value: CategoryFilter) => void
  /** Category id -> number of places, shown as a superscript count. */
  counts?: Partial<Record<CategoryFilter, number>>
  className?: string
}

/**
 * Horizontal category filter. Scrolls on mobile with faded edges rather than
 * wrapping into a tall block that pushes the content off-screen.
 */
export function CategoryRail({ value, onChange, counts, className }: CategoryRailProps) {
  return (
    <div
      role="group"
      aria-label="Filter by category"
      className={cn(
        'no-scrollbar mask-fade-x -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mask-none sm:flex-wrap sm:px-0',
        className,
      )}
    >
      <Chip selected={value === 'all'} onClick={() => onChange('all')}>
        All
        {counts?.all !== undefined && (
          <span className="text-[11px] opacity-50">{counts.all}</span>
        )}
      </Chip>

      {PLACE_CATEGORY_META.map((category) => (
        <Chip
          key={category.id}
          selected={value === category.id}
          onClick={() => onChange(category.id)}
          icon={<category.icon className="size-3.5" aria-hidden />}
        >
          {category.label}
          {counts?.[category.id] !== undefined && (
            <span className="text-[11px] opacity-50">{counts[category.id]}</span>
          )}
        </Chip>
      ))}
    </div>
  )
}
