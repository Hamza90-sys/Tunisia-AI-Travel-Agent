import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Play, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ExploreAnnotation } from './ExploreAnnotation'
import { NovaSuggestionCard } from './NovaSuggestionCard'
import { Container } from '@/components/ui'
import { getMedia } from '@/data/media'
import { ROUTES } from '@/lib/utils'

const EASE = [0.22, 1, 0.36, 1] as const

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}

/**
 * Landing hero — an editorial composition, not a full-bleed photo page.
 *
 * The section sizes the photograph, never the other way round. At lg the frame
 * is a fixed 20rem wide on a 4:5 ratio (320x400), which keeps header + hero +
 * feature strip inside roughly 780px — so all three are visible in the first
 * viewport on a standard desktop. Nothing here is viewport-height driven.
 *
 * Every card is positioned against the image wrapper, so the whole arrangement
 * scales with the frame instead of drifting against the page.
 */
export function Hero() {
  const reduceMotion = useReducedMotion()
  const [filmOpen, setFilmOpen] = useState(false)

  const coast = getMedia('hero-coast')
  const doors = getMedia('hero-blue-doors')
  const elJem = getMedia('hero-el-jem')

  return (
    <section className="relative overflow-hidden bg-page pb-16 pt-24 lg:pb-16 lg:pt-28">
      <PalmDecor />

      <Container size="wide" className="relative z-2">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-10">
          {/* ---------------------------------------------------- left column */}
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
            className="max-w-[30rem]"
          >
            <motion.p
              variants={rise}
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-terracotta-500"
            >
              Tunisia, more than a destination
            </motion.p>

            <motion.h1
              variants={rise}
              className="mt-5 font-display text-[clamp(2.25rem,4.4vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.022em] text-forest-900"
            >
              Your next
              <br />
              adventure is
              <br />
              in <span className="italic text-terracotta-500">Tunisia</span>
            </motion.h1>

            <motion.p
              variants={rise}
              className="mt-6 max-w-[26rem] text-[15px] leading-relaxed text-body"
            >
              Discover Tunisia&rsquo;s most beautiful places, plan your perfect trip, and create
              unforgettable memories &mdash; all in one place.
            </motion.p>

            <motion.div variants={rise} className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={ROUTES.discover}
                className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-forest-800 pl-6 pr-5 text-[14px] font-medium text-ivory-50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-forest-900 hover:shadow-float"
              >
                Start Exploring
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>

              <button
                type="button"
                onClick={() => setFilmOpen(true)}
                className="group inline-flex items-center gap-3 text-[14px] font-medium text-forest-800"
              >
                <span className="flex size-12 items-center justify-center rounded-full border border-hairline-strong bg-paper transition-all duration-300 group-hover:border-terracotta-400 group-hover:bg-terracotta-50">
                  <Play
                    className="size-[15px] translate-x-px fill-forest-800 text-forest-800 transition-colors duration-300 group-hover:fill-terracotta-500 group-hover:text-terracotta-500"
                    aria-hidden
                  />
                </span>
                Watch Video
              </button>
            </motion.div>
          </motion.div>

          {/* --------------------------------------------------- right column */}
          <div className="relative xl:pr-32">
            {/*
              The image wrapper is the positioning context for every floating
              element, so the composition holds together at any width.
            */}
            <motion.figure
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.12 }}
              className="relative mx-auto w-[15.5rem] sm:w-[18rem] lg:mx-0 lg:w-[20rem] xl:w-[22rem]"
            >
              {/*
                The arch: rounded-t-full clamps to half the frame width, giving a
                true semicircular crown over straight sides. The bottom stays
                square — no pill, no oval, no circular crop.
              */}
              <div className="overflow-hidden rounded-t-full rounded-b-none bg-ivory-200 shadow-photo">
                <img
                  src={coast?.src ?? ''}
                  alt={coast?.alt ?? ''}
                  width={coast?.width}
                  height={coast?.height}
                  fetchPriority="high"
                  decoding="async"
                  className="aspect-4/5 w-full object-cover object-center"
                />
              </div>

              {/* A floating detail over the upper right of the frame. */}
              <NovaSuggestionCard className="absolute -right-10 top-6 z-3 sm:-right-14 lg:-right-12" />

              {/* Blue doors, over the lower right of the photograph. */}
              <TiltedPhoto
                media={doors}
                delay={0.5}
                rotate={-5}
                className="absolute bottom-[4.5rem] right-2 z-3 w-[6.5rem] sm:w-[7.5rem] lg:w-[8.5rem]"
              />

              {/* El Jem, a step further right and lower. */}
              <TiltedPhoto
                media={elJem}
                delay={0.62}
                rotate={5}
                className="absolute -bottom-6 -right-10 z-3 w-[6rem] sm:-right-12 sm:w-[7rem] lg:w-[7.5rem]"
              />
            </motion.figure>

            {/* Beside the photograph, arrow sweeping back toward it. */}
            <ExploreAnnotation className="absolute right-0 top-[42%] z-3 hidden xl:block" />
          </div>
        </div>
      </Container>

      {filmOpen && <FilmNotice onClose={() => setFilmOpen(false)} />}
    </section>
  )
}

/** One tilted, white-framed photograph floating over the main image. */
function TiltedPhoto({
  media,
  rotate,
  delay,
  className,
}: {
  media: ReturnType<typeof getMedia>
  rotate: number
  delay: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.figure
      initial={reduceMotion ? { opacity: 1, rotate } : { opacity: 0, y: 16, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 0.75, ease: EASE, delay }}
      whileHover={reduceMotion ? undefined : { rotate: rotate * 0.3, y: -4 }}
      className={className}
    >
      <div className="overflow-hidden rounded-xl border-4 border-paper bg-ivory-200 shadow-float">
        <img
          src={media?.src ?? ''}
          alt={media?.alt ?? ''}
          width={media?.width}
          height={media?.height}
          loading="lazy"
          decoding="async"
          className="aspect-4/3 w-full object-cover"
        />
      </div>
    </motion.figure>
  )
}

/**
 * Honest stand-in for the brand film — there is no film yet, so this says so
 * rather than embedding a fake player or unlicensed stock footage.
 */
function FilmNotice({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="film-notice-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-forest-950/50 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative w-full max-w-md rounded-3xl border border-hairline bg-paper p-8 text-center shadow-photo"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2 text-muted transition-colors hover:bg-ivory-200 hover:text-forest-800"
        >
          <X className="size-4" aria-hidden />
        </button>

        <h2 id="film-notice-title" className="font-display text-2xl text-forest-900">
          The film is still in the edit
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-body">
          We would rather show you nothing than someone else&rsquo;s stock footage. Until our own
          Tunisia film is cut, the places are the best way in.
        </p>
        <Link
          to={ROUTES.discover}
          onClick={onClose}
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-ivory-50 transition-colors hover:bg-forest-900"
        >
          Explore Tunisia instead
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </motion.div>
    </div>
  )
}

/** Restrained botanical decoration, well behind the composition. */
function PalmDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 200 240"
        className="absolute -left-20 top-10 hidden w-[15rem] text-forest-500/[0.06] lg:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M100 240V96" />
        {[-70, -44, -18, 18, 44, 70].map((angle) => (
          <path
            key={angle}
            d="M100 96C100 96 128 70 150 74C150 74 124 60 100 96Z"
            transform={`rotate(${angle} 100 96)`}
          />
        ))}
      </svg>
    </div>
  )
}
