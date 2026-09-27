import type { MediaMotif as MotifName, MediaTone } from '@/data/media'

/**
 * Procedural artwork for media slots that have no photograph yet.
 *
 * Built from the brand palette so an un-photographed catalogue still looks
 * designed rather than broken — and so the prototype carries no low-quality
 * stock imagery. Each Tunisia motif is drawn, not sourced.
 */

export const TONE_GRADIENTS: Record<MediaTone, string> = {
  sea: 'linear-gradient(162deg, #07131F 0%, #0B1F33 34%, #0A5155 70%, #18A6A6 100%)',
  medina: 'linear-gradient(168deg, #0B1F33 0%, #1F4E78 48%, #D8E2EB 88%, #F7F5F0 100%)',
  desert: 'linear-gradient(160deg, #4A3719 0%, #9A7539 46%, #D8B47A 78%, #F2E6CE 100%)',
  night: 'linear-gradient(168deg, #050D16 0%, #07131F 44%, #0A5155 82%, #128C8D 100%)',
  garden: 'linear-gradient(160deg, #04262A 0%, #0D6B6D 52%, #6ED4D0 86%, #D2F2F0 100%)',
  stone: 'linear-gradient(162deg, #102B45 0%, #6E5228 52%, #BF9553 80%, #EBD7B2 100%)',
}

const STROKE = 'rgba(255,255,255,0.34)'
const FILL_SOFT = 'rgba(255,255,255,0.1)'

function Waves() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((row) => (
        <path
          key={row}
          d={`M-40 ${150 + row * 26} q 55 -20 110 0 t 110 0 t 110 0 t 110 0 t 110 0`}
          fill="none"
          stroke={STROKE}
          strokeWidth={1.1}
          opacity={0.9 - row * 0.14}
        />
      ))}
      <circle cx={318} cy={78} r={26} fill={FILL_SOFT} />
    </>
  )
}

function Arches() {
  return (
    <>
      {[0, 1, 2, 3].map((column) => {
        const x = 34 + column * 96
        return (
          <g key={column} opacity={0.85 - column * 0.08}>
            <path
              d={`M${x} 250 L${x} 150 a 32 34 0 0 1 64 0 L${x + 64} 250`}
              fill="none"
              stroke={STROKE}
              strokeWidth={1.2}
            />
            <path
              d={`M${x + 14} 250 L${x + 14} 158 a 18 20 0 0 1 36 0 L${x + 50} 250`}
              fill={FILL_SOFT}
              stroke="none"
            />
          </g>
        )
      })}
      <line x1={-20} y1={250} x2={420} y2={250} stroke={STROKE} strokeWidth={1.2} />
    </>
  )
}

function Dunes() {
  return (
    <>
      <path d="M-20 210 q 120 -70 220 -14 t 220 -26 v 140 h -440 z" fill={FILL_SOFT} />
      <path
        d="M-20 210 q 120 -70 220 -14 t 220 -26"
        fill="none"
        stroke={STROKE}
        strokeWidth={1.2}
      />
      <path
        d="M-20 252 q 150 -46 250 6 t 190 -18"
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.7}
      />
      <circle cx={300} cy={72} r={22} fill="rgba(255,255,255,0.18)" />
    </>
  )
}

function Skyline() {
  return (
    <>
      <g opacity={0.9}>
        <rect x={40} y={168} width={54} height={92} fill={FILL_SOFT} stroke={STROKE} />
        <rect x={112} y={196} width={40} height={64} fill={FILL_SOFT} stroke={STROKE} />
        <path d="M170 260 v-84 a 26 26 0 0 1 52 0 v 84 z" fill={FILL_SOFT} stroke={STROKE} />
        <rect x={244} y={126} width={22} height={134} fill={FILL_SOFT} stroke={STROKE} />
        <path d="M244 126 h22 l-11 -22 z" fill={STROKE} />
        <rect x={286} y={188} width={64} height={72} fill={FILL_SOFT} stroke={STROKE} />
      </g>
      <line x1={-20} y1={260} x2={420} y2={260} stroke={STROKE} strokeWidth={1.2} />
      <path
        d="M-20 284 q 60 -12 120 0 t 120 0 t 120 0 t 120 0"
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.6}
      />
    </>
  )
}

function Terrace() {
  return (
    <>
      <circle cx={288} cy={96} r={34} fill="rgba(255,255,255,0.2)" />
      <line x1={-20} y1={158} x2={420} y2={158} stroke={STROKE} strokeWidth={1} opacity={0.7} />
      <rect x={-20} y={196} width={440} height={6} fill={STROKE} opacity={0.5} />
      {Array.from({ length: 13 }).map((_, index) => (
        <line
          key={index}
          x1={8 + index * 32}
          y1={202}
          x2={8 + index * 32}
          y2={262}
          stroke={STROKE}
          strokeWidth={1}
          opacity={0.55}
        />
      ))}
      <rect x={-20} y={262} width={440} height={4} fill={STROKE} opacity={0.5} />
    </>
  )
}

function Peaks() {
  return (
    <>
      <path d="M-20 260 L 92 128 L 176 214 L 258 112 L 372 260 z" fill={FILL_SOFT} stroke={STROKE} />
      <path d="M176 214 L 258 112 L 300 168" fill="none" stroke={STROKE} strokeWidth={1} opacity={0.7} />
      <line x1={-20} y1={260} x2={420} y2={260} stroke={STROKE} strokeWidth={1.2} />
      <circle cx={84} cy={74} r={18} fill="rgba(255,255,255,0.18)" />
    </>
  )
}

const MOTIFS: Record<MotifName, () => React.ReactElement> = {
  waves: Waves,
  arches: Arches,
  dunes: Dunes,
  skyline: Skyline,
  terrace: Terrace,
  peaks: Peaks,
}

export interface MediaPlaceholderProps {
  tone: MediaTone
  motif: MotifName
  className?: string
}

export function MediaPlaceholder({ tone, motif, className }: MediaPlaceholderProps) {
  const Motif = MOTIFS[motif]

  return (
    <div
      className={className}
      style={{ backgroundImage: TONE_GRADIENTS[tone] }}
      aria-hidden
      data-media-placeholder={motif}
    >
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
        role="presentation"
      >
        <Motif />
      </svg>
    </div>
  )
}
