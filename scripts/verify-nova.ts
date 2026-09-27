/**
 * NOVA production verification.
 *
 * Exercises the real agent end to end against the real Supabase project and
 * the real Gemini API, then asserts persistence, RLS isolation and error
 * handling. Nothing here is mocked.
 *
 *   npm run verify:nova
 *   npm run verify:nova -- --endpoint=https://<ref>.supabase.co/functions/v1/nova-agent
 *
 * Defaults to the Vite dev proxy on localhost, which runs the identical
 * `agent.ts` the edge function deploys. Point `--endpoint` at the deployed
 * function to verify production with the same assertions.
 *
 * Service-role use is confined to test fixtures: creating and deleting the two
 * throwaway users. Every assertion about persistence and isolation is made
 * through a client holding only the anon key plus a real user JWT, so RLS is
 * doing the work — it is never bypassed.
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

import type { NovaServerEvent } from '../src/lib/nova/events'
import type { Database } from '../src/types/database'

const DEFAULT_ENDPOINT = 'http://localhost:5173/api/nova'
const PROMPT = 'historic Roman sites near Tunis'

const fileEnv = loadEnv('development', process.cwd(), '')
const readEnv = (name: string) => (process.env[name] ?? fileEnv[name])?.trim() || undefined

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail = '') {
  checks += 1
  if (condition) {
    console.log(`  ok    ${label}`)
    return
  }
  failures += 1
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

function section(title: string) {
  console.log(`\n${title}`)
}

function parseEndpoint(): string {
  const flag = process.argv.slice(2).find((arg) => arg.startsWith('--endpoint='))
  return flag ? flag.slice('--endpoint='.length) : DEFAULT_ENDPOINT
}

interface AgentCall {
  events: NovaServerEvent[]
  status: number
}

/** Posts one message and collects the SSE event stream. */
async function callAgent(
  endpoint: string,
  anonKey: string,
  body: unknown,
  accessToken?: string,
  raw?: string,
): Promise<AgentCall> {
  /*
   * Mirrors src/lib/nova/client.ts exactly.
   *
   * Supabase's function gateway rejects a request with no Authorization header
   * before the function runs, and the anon key is itself a valid project JWT.
   * So an "anonymous" caller still sends Authorization — just the anon key
   * rather than a user token. Omitting it would test a request the real client
   * never makes, and would 401 at the gateway instead of reaching the agent.
   */
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken ?? anonKey}`,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
  })

  const events: NovaServerEvent[] = []
  if (response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const line = buffer
          .slice(0, boundary)
          .split('\n')
          .find((candidate) => candidate.startsWith('data:'))
        if (line) {
          try {
            events.push(JSON.parse(line.slice(5).trim()) as NovaServerEvent)
          } catch {
            /* a malformed frame must not abort verification */
          }
        }
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    }
  }

  return { events, status: response.status }
}

function firstText(events: NovaServerEvent[]): string | null {
  for (const event of events) if (event.type === 'text') return event.content
  return null
}

function firstError(events: NovaServerEvent[]) {
  for (const event of events) if (event.type === 'error') return event
  return null
}

function doneEvent(events: NovaServerEvent[]) {
  for (const event of events) if (event.type === 'done') return event
  return null
}

interface TestUser {
  id: string
  email: string
  accessToken: string
  client: SupabaseClient<Database>
}

async function main() {
  const endpoint = parseEndpoint()
  const url = readEnv('VITE_SUPABASE_URL')
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY')

  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !anonKey && 'VITE_SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY (test fixtures only)',
  ].filter(Boolean)

  if (missing.length) {
    console.error(`\nCannot verify — missing: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  console.log(`\nNOVA verification`)
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Project:  ${url!.replace(/https:\/\/([^.]{4})[^.]*/, 'https://$1…')}`)
  console.log(
    `Boundary: ${endpoint.includes('/functions/v1/') ? 'Supabase gateway (JWT verification ON)' : 'Vite dev proxy (no gateway)'}`,
  )

  // Fixtures only. Never used for an assertion.
  const admin = createClient<Database>(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = Date.now()
  const created: string[] = []

  async function makeUser(tag: string): Promise<TestUser> {
    const email = `nova-verify-${tag}-${stamp}@example.com`
    const password = `Verify-${stamp}-${tag}!`

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
    created.push(data.user.id)

    // Sign in with the ANON key: this is the JWT a real browser would hold.
    const authClient = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signIn = await authClient.auth.signInWithPassword({ email, password })
    if (signIn.error || !signIn.data.session) {
      throw new Error(`signIn failed: ${signIn.error?.message}`)
    }

    const token = signIn.data.session.access_token
    const scoped = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    return { id: data.user.id, email, accessToken: token, client: scoped }
  }

  let userA: TestUser | null = null
  let userB: TestUser | null = null

  try {
    section('Fixtures (service role — setup only)')
    userA = await makeUser('a')
    userB = await makeUser('b')
    check('two real auth users created', Boolean(userA.id && userB.id))

    // profiles is FK target for nova_conversations.user_id, seeded by the
    // handle_new_user trigger. If that trigger is broken, persistence cannot work.
    const profileA = await userA.client.from('profiles').select('id').eq('id', userA.id).maybeSingle()
    check('handle_new_user created a profile row', profileA.data?.id === userA.id, profileA.error?.message)

    /* --- Authenticated request + persistence --------------------------- */
    section('Authenticated request through the real agent')
    const authed = await callAgent(endpoint, anonKey!, { message: PROMPT }, userA.accessToken)
    const authedError = firstError(authed.events)
    const authedDone = doneEvent(authed.events)
    const answer = firstText(authed.events)

    check('no error event', authedError === null, authedError?.message)
    check('an answer was produced', Boolean(answer && answer.length > 40))
    check(
      'search_places actually ran',
      authed.events.some((e) => e.type === 'tool' && e.status === 'done'),
    )
    check('done event reports persisted', authedDone?.type === 'done' && authedDone.persisted === true)
    check('done event returns a conversationId', Boolean(authedDone?.type === 'done' && authedDone.conversationId))

    const conversationId = authedDone?.type === 'done' ? authedDone.conversationId : null

    if (conversationId) {
      section('Persistence, read back with the user’s own JWT (no service role)')

      const convo = await userA.client
        .from('nova_conversations')
        .select('id, user_id, title, trip_id')
        .eq('id', conversationId)
        .maybeSingle()

      check('conversation row is readable by its owner', convo.data?.id === conversationId, convo.error?.message)
      check('conversation user_id matches the authenticated user', convo.data?.user_id === userA.id)
      check('conversation title was set from the message', Boolean(convo.data?.title))

      const msgs = await userA.client
        .from('nova_messages')
        .select('role, content, tool_calls, tool_results, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at')

      const rows = msgs.data ?? []
      const userRow = rows.find((r) => r.role === 'user')
      const novaRow = rows.find((r) => r.role === 'nova')

      check('two messages persisted', rows.length === 2, `got ${rows.length}`)
      check('user message persisted', userRow?.content === PROMPT)
      check('assistant message persisted with the answer', novaRow?.content === answer)
      check('tool_calls persisted on the assistant message', Array.isArray(novaRow?.tool_calls))
      check('tool_results persisted on the assistant message', Array.isArray(novaRow?.tool_results))
      check(
        'tool_results store slugs, not vectors',
        JSON.stringify(novaRow?.tool_results ?? '').includes('slugs') &&
          !JSON.stringify(novaRow?.tool_results ?? '').includes('embedding'),
      )

      /* --- RLS isolation ------------------------------------------------- */
      section('RLS isolation')

      const otherConvo = await userB!.client
        .from('nova_conversations')
        .select('id')
        .eq('id', conversationId)
      check('user B cannot read user A’s conversation', (otherConvo.data ?? []).length === 0, otherConvo.error?.message)

      const otherMsgs = await userB!.client
        .from('nova_messages')
        .select('id')
        .eq('conversation_id', conversationId)
      check('user B cannot read user A’s messages', (otherMsgs.data ?? []).length === 0)

      const otherProfile = await userB!.client.from('profiles').select('id').eq('id', userA.id)
      check('user B cannot read user A’s profile', (otherProfile.data ?? []).length === 0)

      const anonClient = createClient<Database>(url!, anonKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const anonConvos = await anonClient.from('nova_conversations').select('id')
      check('anonymous cannot read any conversation', (anonConvos.data ?? []).length === 0)

      const anonMsgs = await anonClient.from('nova_messages').select('id')
      check('anonymous cannot read any message', (anonMsgs.data ?? []).length === 0)

      const anonEmbeddings = await anonClient.from('place_embeddings').select('id').limit(1)
      check('anonymous still cannot read place_embeddings', (anonEmbeddings.data ?? []).length === 0)

      const hijack = await userB!.client
        .from('nova_messages')
        .insert({ conversation_id: conversationId, role: 'user', content: 'injected' })
      check('user B cannot write into user A’s conversation', hijack.error !== null, 'insert unexpectedly succeeded')
    }

    /* --- Multi-turn conversation --------------------------------------- */
    section('Multi-turn conversation (real semantic continuity)')

    const turn1 = await callAgent(
      endpoint,
      anonKey!,
      { message: 'I am in Hammamet.' },
      userA.accessToken,
    )
    const turn1Done = doneEvent(turn1.events)
    const threadId =
      turn1Done?.type === 'done' ? turn1Done.conversationId : null

    check('turn 1 opened a persisted conversation', Boolean(threadId))
    check('turn 1 produced an answer', Boolean(firstText(turn1.events)))

    if (threadId) {
      const turn2 = await callAgent(
        endpoint,
        anonKey!,
        {
          message: 'What historical places should I visit nearby?',
          conversationId: threadId,
        },
        userA.accessToken,
      )

      const turn2Text = firstText(turn2.events) ?? ''
      const turn2Tools = turn2.events
        .filter((event): event is Extract<NovaServerEvent, { type: 'tool' }> => event.type === 'tool')
        .map((event) => event.summary)
        .join(' ')
      const turn2All = `${turn2Text} ${turn2Tools}`

      check('turn 2 produced an answer', turn2Text.length > 0)
      check(
        'turn 2 stayed in the same conversation',
        doneEvent(turn2.events)?.type === 'done' &&
          (doneEvent(turn2.events) as { conversationId: string | null }).conversationId === threadId,
      )

      /*
       * The real test. Turn 2 never says "Hammamet" — it says "nearby". Only a
       * model that received turn 1 can resolve that, so naming Hammamet (or
       * searching for it) proves history actually reached Gemini. A 200 alone
       * would prove nothing.
       */
      check(
        'turn 2 resolved "nearby" using turn 1 context',
        /hammamet/i.test(turn2All),
        turn2All.slice(0, 140),
      )

      const stored = await userA.client
        .from('nova_messages')
        .select('role')
        .eq('conversation_id', threadId)
      check('all four turns persisted', (stored.data ?? []).length === 4, `rows=${(stored.data ?? []).length}`)

      /* --- Cross-user and anonymous access to that thread --------------- */
      section('Conversation ownership')

      const hijack = await callAgent(
        endpoint,
        anonKey!,
        { message: 'What did I just tell you?', conversationId: threadId },
        userB!.accessToken,
      )
      const hijackError = firstError(hijack.events)

      check(
        'user B cannot continue user A’s conversation',
        hijackError?.code === 'conversation_not_found',
        hijackError?.code,
      )
      check('the refusal yields no answer', firstText(hijack.events) === null)
      check(
        'the refusal does not reveal that the conversation exists',
        !/(exists|belongs|another user|permission|forbidden|owner)/i.test(hijackError?.message ?? ''),
        hijackError?.message,
      )

      const anonThread = await callAgent(endpoint, anonKey!, {
        message: 'What did I just tell you?',
        conversationId: threadId,
      })
      const anonThreadDone = doneEvent(anonThread.events)
      const anonThreadText = firstText(anonThread.events) ?? ''

      check(
        'anonymous cannot attach to a persisted conversation',
        anonThreadDone?.type === 'done' &&
          anonThreadDone.conversationId === null &&
          anonThreadDone.persisted === false,
      )
      check(
        'no history leaks to an anonymous caller',
        !/hammamet/i.test(anonThreadText),
        anonThreadText.slice(0, 120),
      )
    }

    const bogusThread = await callAgent(
      endpoint,
      anonKey!,
      { message: 'hello', conversationId: 'not-a-uuid' },
      userA.accessToken,
    )
    check(
      'a malformed conversationId fails cleanly',
      firstError(bogusThread.events)?.code === 'conversation_not_found',
      firstError(bogusThread.events)?.code,
    )
    check('a malformed conversationId never reaches Gemini', firstText(bogusThread.events) === null)

    /* --- Anonymous behaviour ------------------------------------------- */
    section('Anonymous request')
    const anon = await callAgent(endpoint, anonKey!, { message: PROMPT })
    const anonDone = doneEvent(anon.events)
    check('anonymous request still gets an answer', Boolean(firstText(anon.events)))
    check('anonymous reports persisted: false', anonDone?.type === 'done' && anonDone.persisted === false)
    check('anonymous gets no conversationId', anonDone?.type === 'done' && anonDone.conversationId === null)

    /* --- Error handling ------------------------------------------------- */
    section('Error handling')

    const malformed = await callAgent(endpoint, anonKey!, null, undefined, 'not json at all')
    check('malformed JSON is a clean bad_request', firstError(malformed.events)?.code === 'bad_request')

    const noMessage = await callAgent(endpoint, anonKey!, {})
    check('missing message is a clean bad_request', firstError(noMessage.events)?.code === 'bad_request')

    const blank = await callAgent(endpoint, anonKey!, { message: '   ' })
    check('blank message is a clean bad_request', firstError(blank.events)?.code === 'bad_request')

    const huge = await callAgent(endpoint, anonKey!, { message: 'x'.repeat(5000) })
    check('oversized message is a clean bad_request', firstError(huge.events)?.code === 'bad_request')

    /*
     * A malformed JWT is rejected by the Supabase gateway with
     * 401 UNAUTHORIZED_INVALID_JWT_FORMAT *before* the function executes. That
     * is stricter than anything the application could do, so the contract to
     * assert is the boundary's, not the agent's.
     *
     * Against the dev proxy there is no gateway, so the request reaches the
     * agent, every Supabase call fails, and the grounding guard converts that
     * into retrieval_error. Both are correct for their transport; what must
     * hold everywhere is: no answer, no persistence, no leak.
     */
    const badToken = await callAgent(endpoint, anonKey!, { message: PROMPT }, 'not-a-real-jwt')
    const badTokenDone = doneEvent(badToken.events)
    const badTokenError = firstError(badToken.events)
    const badTokenText = firstText(badToken.events)
    const rejectedAtGateway = badToken.status === 401

    check(
      'a broken JWT never produces an answer',
      badTokenText === null,
      badTokenText ? `model answered anyway: ${badTokenText.slice(0, 80)}…` : '',
    )
    check(
      'a broken JWT is refused at the auth boundary',
      rejectedAtGateway || badTokenError !== null,
      `status=${badToken.status} error=${badTokenError?.code ?? 'none'}`,
    )
    /*
     * Off the gateway (dev proxy), a broken JWT breaks every Supabase call, so
     * the turn dies somewhere in the agent. Exactly where varies: usually the
     * grounding guard (retrieval_error), but a model call can hit a per-minute
     * limit first (rate_limited) or fail outright (provider_error). All of
     * those are correct, safe endings — the invariants that must always hold
     * are asserted separately above: no answer, and no persistence.
     */
    const safeFailures = ['retrieval_error', 'rate_limited', 'provider_error', 'quota_exceeded']
    check(
      rejectedAtGateway
        ? 'gateway rejects the malformed JWT before the function runs (401)'
        : 'agent ends the turn on a safe failure rather than answering',
      rejectedAtGateway || safeFailures.includes(badTokenError?.code ?? ''),
      badTokenError?.code,
    )
    check(
      'a broken JWT never persists',
      badTokenDone === null || (badTokenDone.type === 'done' && badTokenDone.persisted === false),
    )
    check(
      'a broken JWT never reaches another user’s data',
      badTokenDone === null || (badTokenDone.type === 'done' && badTokenDone.conversationId === null),
    )

    section('Leak audit on the wire')
    const wire = JSON.stringify([...authed.events, ...anon.events, ...malformed.events])
    const secrets: [string, string | undefined][] = [
      ['GEMINI_API_KEY', readEnv('GEMINI_API_KEY')],
      ['SUPABASE_SERVICE_ROLE_KEY', readEnv('SUPABASE_SERVICE_ROLE_KEY')],
    ]
    for (const [name, value] of secrets) {
      check(`${name} never appears in a response`, !value || !wire.includes(value))
    }
    check('no SQL error text on the wire', !/relation|syntax error|pg_|SQLSTATE/i.test(wire))
    check('no stack traces on the wire', !/\bat \w+ \(|\.ts:\d+:\d+/.test(wire))
    check('no internal file paths on the wire', !/supabase\/functions|src\/lib/.test(wire))
    check(
      'system instruction is never echoed',
      !wire.includes('You are NOVA, the AI travel companion'),
    )
  } finally {
    section('Cleanup')
    for (const id of created) {
      const { error } = await admin.auth.admin.deleteUser(id)
      check(`test user ${id.slice(0, 8)}… deleted`, !error, error?.message)
    }
  }

  console.log(`\n${checks - failures}/${checks} checks passed`)
  if (failures > 0) {
    console.error(`${failures} check(s) failed.`)
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(`\nVerification aborted: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
