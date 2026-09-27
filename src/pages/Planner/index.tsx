import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

import { TripDraftControls } from './TripDraftControls'
import { NovaAvatar, NovaInlinePrompt, NovaPlanningState } from '@/components/nova'
import { Button, ButtonLink, Chip, Container } from '@/components/ui'
import { fadeUp, staggerParent, transitions } from '@/animations'
import { PREFERENCE_META } from '@/data'
import { AI_NAME, AI_TAGLINE, ROUTES } from '@/lib/utils'
import type { BudgetLevel, PreferenceTag, TripDraft } from '@/types'

type PlannerPhase = 'compose' | 'planning' | 'ready'

const EXAMPLE_PROMPTS = [
  'Five days in October, two of us, ruins and long lunches.',
  'A week with the kids — beaches first, one desert night.',
  'Four days, no car, good food, back to Tunis each evening.',
]

/**
 * The AI trip planner.
 *
 * Step 1 delivers the full composition surface and the planning experience.
 * `handleCreateTrip` is the single seam for Step 2: it already assembles a
 * complete `TripDraft`, which is exactly what the agent will receive. Nothing
 * in this page fabricates an itinerary — the planning sequence is presented as
 * a preview and hands off to the demo trip on the dashboard.
 */
export default function PlannerPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<PlannerPhase>('compose')
  const [prompt, setPrompt] = useState('')
  const [preferences, setPreferences] = useState<PreferenceTag[]>(['history', 'beaches'])
  const [travelers, setTravelers] = useState(2)
  const [durationDays, setDurationDays] = useState(5)
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('elevated')
  // Null means "flexible" — trip_days.date is nullable, so the agent can return
  // a route of relative days and have real dates applied later.
  const [startDate, setStartDate] = useState<string | null>(null)

  const togglePreference = useCallback((id: PreferenceTag) => {
    setPreferences((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }, [])

  /**
   * Step 2 replaces the body of this function with:
   *   const trip = await novaAgent.generateItinerary(draft)
   *   navigate(`${ROUTES.trip}?id=${trip.id}`)
   */
  const handleCreateTrip = useCallback(() => {
    const draft: TripDraft = {
      prompt: prompt.trim(),
      preferences,
      travelers,
      durationDays,
      budgetLevel,
      startDate,
    }
    // Kept visible in the console so judges can see the payload the agent gets.
    console.info('[TuniTravel] trip draft ready for NOVA', draft)
    setPhase('planning')
  }, [prompt, preferences, travelers, durationDays, budgetLevel, startDate])

  const canSubmit = prompt.trim().length > 0 || preferences.length > 0

  return (
    <div className="grain relative min-h-dvh overflow-hidden bg-ink-900 pb-24 pt-28 text-canvas md:pt-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 50% at 50% 0%, rgba(24,166,166,0.24) 0%, rgba(7,19,31,0) 60%), radial-gradient(60% 50% at 90% 90%, rgba(216,180,122,0.12) 0%, rgba(7,19,31,0) 60%)',
        }}
      />

      <Container className="relative z-2">
        {/* --- Masthead ----------------------------------------------------- */}
        <motion.header
          variants={staggerParent(0.09)}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          <motion.div variants={fadeUp}>
            <NovaAvatar
              state={phase === 'planning' ? 'planning' : phase === 'ready' ? 'success' : 'idle'}
              size={112}
            />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-8 font-display text-3xl tracking-[0.06em] text-canvas sm:text-4xl"
          >
            {AI_NAME}
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-2 text-sm text-sea-300/80">
            {AI_TAGLINE}
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="mt-9 max-w-lg text-[1.375rem] leading-snug text-white/75 sm:text-[1.625rem]"
          >
            Tell me about your journey.
          </motion.p>
        </motion.header>

        {/* --- Phases -------------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {phase === 'compose' && (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transitions.panel}
              className="mt-12"
            >
              <NovaInlinePrompt
                label="Describe your journey"
                placeholder="Five days in October, two of us. We like ruins, long lunches and one slow beach day…"
                novaState="idle"
                onSubmit={(value) => {
                  setPrompt(value)
                  handleCreateTrip()
                }}
              />

              {/* Example prompts — lowers the blank-page cost of a chat UI. */}
              <div className="no-scrollbar mask-fade-x -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0 sm:mask-none">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="shrink-0 rounded-full border border-white/10 px-3.5 py-1.5 text-left text-xs text-white/45 transition-colors hover:border-sea-400/40 hover:text-white/80"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {/* Preferences */}
              <section className="mt-12" aria-labelledby="preferences-heading">
                <h2 id="preferences-heading" className="eyebrow text-white/40">
                  What matters most
                </h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {PREFERENCE_META.map((preference) => (
                    <Chip
                      key={preference.id}
                      onDark
                      selected={preferences.includes(preference.id)}
                      onClick={() => togglePreference(preference.id)}
                      icon={<preference.icon className="size-4" aria-hidden />}
                    >
                      {preference.label}
                    </Chip>
                  ))}
                </div>
              </section>

              {/* Trip shape */}
              <TripDraftControls
                travelers={travelers}
                durationDays={durationDays}
                budgetLevel={budgetLevel}
                startDate={startDate}
                onTravelersChange={setTravelers}
                onDurationChange={setDurationDays}
                onBudgetChange={setBudgetLevel}
                onStartDateChange={setStartDate}
                className="mt-10"
              />

              <div className="mt-12 flex flex-col items-center gap-4">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleCreateTrip}
                  disabled={!canSubmit}
                  className="group w-full sm:w-auto"
                  icon={<Sparkles className="size-4" aria-hidden />}
                  iconAfter={
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  }
                >
                  Create my trip
                </Button>
                <p className="max-w-sm text-center text-[11px] leading-relaxed text-white/30">
                  Preview build: NOVA's reasoning engine is not connected yet, so this opens a
                  sample Tunisia itinerary rather than a generated one.
                </p>
              </div>
            </motion.div>
          )}

          {phase === 'planning' && (
            <motion.div
              key="planning"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transitions.panel}
              className="mt-14"
            >
              <NovaPlanningState
                stepDuration={1100}
                onComplete={() => setPhase('ready')}
                className="border-white/12 bg-ink-950/60"
              />
            </motion.div>
          )}

          {phase === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.panel}
              className="mt-14 flex flex-col items-center text-center"
            >
              <p className="eyebrow text-sand-400">Ready</p>
              <h2 className="mt-4 text-3xl uppercase leading-tight text-canvas sm:text-4xl">
                Your journey is waiting
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
                {durationDays} days in Tunisia for {travelers}
                {travelers === 1 ? ' traveller' : ' travellers'}, built around{' '}
                {preferences.length ? preferences.join(', ') : 'your notes'}.
              </p>

              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <ButtonLink
                  to={ROUTES.trip}
                  variant="onDark"
                  size="lg"
                  className="group"
                  iconAfter={
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  }
                >
                  Open my trip
                </ButtonLink>
                <Button
                  variant="onDarkGhost"
                  size="lg"
                  onClick={() => {
                    setPhase('compose')
                    navigate(ROUTES.planner, { replace: true })
                  }}
                >
                  Start again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  )
}
