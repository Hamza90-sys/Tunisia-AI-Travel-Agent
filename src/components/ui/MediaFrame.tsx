import { useState } from 'react'
import type { ReactNode } from 'react'

import { MediaPlaceholder } from './MediaMotif'
import { getMedia } from '@/data/media'
import type { MediaSlot } from '@/data/media'
import { getMediaPublicUrl } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * Renders a media slot.
 *
 * Resolution order (see src/data/media.ts):
 *   1. Supabase Storage object  2. curated remote image  3. procedural artwork
 *
 * A failed image load falls back to the artwork rather than a broken icon, so
 * the UI degrades gracefully on a conference wifi network.
 */
function resolveSrc(slot: MediaSlot | null): string | null {
  if (!slot) return null
  return getMediaPublicUrl(slot.storagePath) ?? slot.src
}

export type MediaRatio = 'square' | 'photo' | 'landscape' | 'portrait' | 'panorama' | 'fill'

const RATIOS: Record<MediaRatio, string> = {
  square: 'aspect-square',
  photo: 'aspect-4/3',
  landscape: 'aspect-16/10',
  portrait: 'aspect-3/4',
  panorama: 'aspect-21/9',
  fill: 'h-full w-full',
}

export interface MediaFrameProps {
  mediaKey?: string | null
  ratio?: MediaRatio
  className?: string
  /** Absolutely-positioned content layered over the image. */
  overlay?: ReactNode
  /** Darkens the image so overlaid text stays readable. */
  scrim?: 'none' | 'soft' | 'strong'
  rounded?: string
  loading?: 'eager' | 'lazy'
}

const SCRIMS = {
  none: '',
  soft: 'bg-gradient-to-t from-ink-950/55 via-ink-950/10 to-transparent',
  strong: 'bg-gradient-to-t from-ink-950/85 via-ink-950/40 to-ink-950/10',
} as const

export function MediaFrame({
  mediaKey,
  ratio = 'photo',
  className,
  overlay,
  scrim = 'none',
  rounded = 'rounded-3xl',
  loading = 'lazy',
}: MediaFrameProps) {
  const slot = getMedia(mediaKey)
  const [failed, setFailed] = useState(false)
  const src = failed ? null : resolveSrc(slot)

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-ink-800/5',
        RATIOS[ratio],
        rounded,
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={slot?.alt ?? ''}
          loading={loading}
          onError={() => setFailed(true)}
          className="size-full object-cover"
          style={slot?.focus ? { objectPosition: slot.focus } : undefined}
        />
      ) : (
        <MediaPlaceholder
          tone={slot?.tone ?? 'sea'}
          motif={slot?.motif ?? 'waves'}
          className="size-full"
        />
      )}

      {scrim !== 'none' && (
        <div className={cn('pointer-events-none absolute inset-0', SCRIMS[scrim])} aria-hidden />
      )}

      {overlay && <div className="absolute inset-0">{overlay}</div>}
    </div>
  )
}
