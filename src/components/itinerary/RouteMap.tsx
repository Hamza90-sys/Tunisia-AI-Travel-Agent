import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Navigation } from 'lucide-react'

import { TUNISIA_OUTLINE, getCityCoordinates } from '@/data'
import { cn, distanceKm, projectToViewport } from '@/lib/utils'
import type { Coordinates } from '@/types'

/**
 * Schematic route map.
 *
 * This is a placeholder for a real map, but not a grey box: the country outline
 * and every city marker are projected from true coordinates through
 * `projectToViewport`. When a tile-based map arrives in Step 2 the data
 * contract is already correct — only the renderer changes.
 */
export interface RouteMapProps {
  /** Ordered city names, e.g. ["Tunis", "Hammamet", "Sousse"]. */
  route: string[]
  /** Highlights one leg of the route (0-based city index). */
  activeIndex?: number
  onSelectCity?: (city: string, index: number) => void
  className?: string
}

interface RouteNode {
  city: string
  index: number
  coordinates: Coordinates
  x: number
  y: number
}

export function RouteMap({ route, activeIndex, onSelectCity, className }: RouteMapProps) {
  const reduceMotion = useReducedMotion()

  const outlinePath = useMemo(() => {
    const points = TUNISIA_OUTLINE.map(projectToViewport)
    if (!points.length) return ''
    const [first, ...rest] = points
    return `M${first.x.toFixed(2)} ${first.y.toFixed(2)} ${rest
      .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')} Z`
  }, [])

  const nodes = useMemo<RouteNode[]>(
    () =>
      route
        .map((city, index) => {
          const coordinates = getCityCoordinates(city)
          if (!coordinates) return null
          const { x, y } = projectToViewport(coordinates)
          return { city, index, coordinates, x, y }
        })
        .filter((node): node is RouteNode => node !== null),
    [route],
  )

  const routePath = nodes.length
    ? `M${nodes.map((node) => `${node.x.toFixed(2)} ${node.y.toFixed(2)}`).join(' L')}`
    : ''

  const totalDistance = nodes.reduce((total, node, index) => {
    if (index === 0) return 0
    return total + distanceKm(nodes[index - 1].coordinates, node.coordinates)
  }, 0)

  return (
    <div
      className={cn(
        'grain relative overflow-hidden rounded-4xl border border-white/[0.07] bg-ink-900',
        className,
      )}
    >
      {/* Sea glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 78% 18%, rgba(24,166,166,0.24) 0%, rgba(7,19,31,0) 58%)',
        }}
      />

      {/* Latitude/longitude grid */}
      <svg
        aria-hidden
        className="absolute inset-0 size-full opacity-[0.16]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 9 }).map((_, index) => (
          <line
            key={`h${index}`}
            x1={0}
            y1={(index + 1) * 10}
            x2={100}
            y2={(index + 1) * 10}
            stroke="#A6E6E2"
            strokeWidth={0.15}
          />
        ))}
        {Array.from({ length: 9 }).map((_, index) => (
          <line
            key={`v${index}`}
            x1={(index + 1) * 10}
            y1={0}
            x2={(index + 1) * 10}
            y2={100}
            stroke="#A6E6E2"
            strokeWidth={0.15}
          />
        ))}
      </svg>

      <div className="relative z-2 aspect-4/3 w-full sm:aspect-16/10">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className="size-full"
          role="img"
          aria-label={`Route map: ${route.join(' to ')}`}
        >
          <defs>
            <linearGradient id="route-land" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#12304C" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#0B1F33" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#6E5228" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="route-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#35BDBB" />
              <stop offset="100%" stopColor="#D8B47A" />
            </linearGradient>
          </defs>

          {/* Country */}
          <path
            d={outlinePath}
            fill="url(#route-land)"
            stroke="#6ED4D0"
            strokeWidth={0.4}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />

          {/* Route */}
          {routePath && (
            <>
              <path
                d={routePath}
                fill="none"
                stroke="#0B1F33"
                strokeWidth={1.6}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
              <motion.path
                d={routePath}
                fill="none"
                stroke="url(#route-line)"
                strokeWidth={0.9}
                strokeLinecap="round"
                strokeDasharray="3 2.2"
                initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              />
            </>
          )}

          {/* City markers */}
          {nodes.map((node) => {
            const isActive = activeIndex === node.index
            return (
              <g key={node.city}>
                {isActive && (
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={2.4}
                    fill="none"
                    stroke="#6ED4D0"
                    strokeWidth={0.35}
                    animate={
                      reduceMotion
                        ? { opacity: 0.4 }
                        : { r: [2.4, 5.2], opacity: [0.7, 0] }
                    }
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isActive ? 1.7 : 1.2}
                  fill={isActive ? '#D8B47A' : '#A6E6E2'}
                  stroke="#07131F"
                  strokeWidth={0.4}
                />
              </g>
            )
          })}
        </svg>

        {/* City labels live in HTML so they stay legible at any map size. */}
        {nodes.map((node) => (
          <button
            key={node.city}
            type="button"
            onClick={() => onSelectCity?.(node.city, node.index)}
            disabled={!onSelectCity}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            className={cn(
              'absolute -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300 disabled:cursor-default',
              activeIndex === node.index
                ? 'bg-sand-500 text-ink-900'
                : 'bg-ink-950/70 text-white/75 backdrop-blur-sm hover:bg-ink-950/90 hover:text-canvas',
            )}
          >
            {node.city}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="relative z-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4 text-[11px] text-white/45 sm:px-6">
        <span className="flex items-center gap-2">
          <Navigation className="size-3.5 text-sea-300" aria-hidden />
          {route.join(' → ')}
        </span>
        <span className="flex items-center gap-4">
          {totalDistance > 0 && <span>{totalDistance} km total</span>}
          <span className="text-white/30">Schematic view · live map in development</span>
        </span>
      </div>
    </div>
  )
}
