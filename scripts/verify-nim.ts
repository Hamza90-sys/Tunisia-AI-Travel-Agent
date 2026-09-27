/**
 * NOVA x NVIDIA NIM verifier.
 *
 *   npm run verify:nim
 *
 * Two modes, chosen automatically:
 *
 *   • NIM reachable  -> the real end-to-end demo. Sends "Find interesting
 *     places to visit in Tunis." through the actual agent and asserts that
 *     Llama called search_places, that the tool ran, and that the FINAL answer
 *     is prose naming catalogue places rather than a tool call.
 *
 *   • NIM unreachable -> the same assertions against a stub NIM that replays
 *     the OpenAI-compatible wire format. This proves the loop, the message
 *     shaping and the tool_call_id round-trip without a GPU. It does NOT prove
 *     the real model behaves, and it says so.
 *
 * Nothing here writes to the database beyond what the agent itself persists,
 * and no key is printed.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { runNovaAgent } from '../supabase/functions/nova-agent/orchestrator'
import { createNvidiaProvider, parseToolCalls } from '../supabase/functions/nova-agent/llm/nvidia'
import type { NovaServerEvent } from '../src/lib/nova/events'

const DEMO_MESSAGE = 'Find interesting places to visit in Tunis.'

let failures = 0

function expect(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`ok    ${name}${detail ? `  ${detail}` : ''}`)
    return
  }
  failures += 1
  console.error(`FAIL  ${name}${detail ? `  ${detail}` : ''}`)
}

/* --- Reachability ---------------------------------------------------------- */

async function probe(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/* --- Stub NIM -------------------------------------------------------------- */

/**
 * Replays exactly what the user observed from the real NIM: a tool call on the
 * first request, then prose once the tool result is present.
 *
 * It also asserts the REQUEST shape, which is the part most likely to be wrong:
 * the tool schema, and the assistant/tool message pairing with matching ids.
 */
function startStubNim(): Promise<{ baseUrl: string; close: () => Promise<void>; seen: unknown[] }> {
  const seen: unknown[] = []

  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url?.endsWith('/models')) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: [{ id: 'meta/llama-3.1-8b-instruct' }] }))
      return
    }

    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        messages: { role: string; content?: unknown; tool_call_id?: string }[]
      }
      seen.push(body)

      const hasToolResult = body.messages.some((message) => message.role === 'tool')

      response.writeHead(200, { 'Content-Type': 'application/json' })

      if (!hasToolResult) {
        response.end(
          JSON.stringify({
            model: 'meta/llama-3.1-8b-instruct',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'chatcmpl-tool-abc123',
                      type: 'function',
                      function: {
                        name: 'search_places',
                        arguments: JSON.stringify({
                          query: 'interesting places to visit',
                          city: 'Tunis',
                        }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 30 },
          }),
        )
        return
      }

      // Second pass: the tool result is in the transcript, so answer in prose
      // built from it — the same thing the real model is asked to do.
      const toolMessage = body.messages.find((message) => message.role === 'tool')
      const payload = JSON.parse(String(toolMessage?.content ?? '{}')) as {
        data?: { results?: { name: string }[] }
      }
      const names = (payload.data?.results ?? []).map((place) => place.name)

      response.end(
        JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  names.length
                    ? `Tunis is a good place to start. I would begin with ${names
                        .slice(0, 3)
                        .join(', ')} — all of them are close together and easy to do in a day.`
                    : 'I could not find anything in the catalogue for Tunis just now.',
              },
            },
          ],
          usage: { prompt_tokens: 400, completion_tokens: 60 },
        }),
      )
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        seen,
        close: () =>
          new Promise((done) => {
            server.close(() => done())
          }),
      })
    })
  })
}

/* --- Unit: wire format ----------------------------------------------------- */

function checkParsing() {
  console.log('\nNIM response parsing')

  const good = parseToolCalls([
    {
      id: 'chatcmpl-tool-1',
      function: { name: 'search_places', arguments: '{"query":"beaches","city":"Sousse"}' },
    },
  ])
  expect('a tool call is parsed', good.length === 1)
  expect('tool_call id is preserved', good[0]?.id === 'chatcmpl-tool-1')
  expect('tool name is preserved', good[0]?.name === 'search_places')
  expect('arguments are parsed into an object', good[0]?.arguments.city === 'Sousse')
  expect('a valid call carries no argument error', good[0]?.argumentsError === undefined)

  const malformed = parseToolCalls([
    { id: 'x', function: { name: 'search_places', arguments: '{"query": "beaches"' } },
  ])
  expect('malformed JSON does not throw', malformed.length === 1)
  expect('malformed JSON is reported, not guessed', Boolean(malformed[0]?.argumentsError))

  const nonObject = parseToolCalls([
    { id: 'y', function: { name: 'search_places', arguments: '"just a string"' } },
  ])
  expect('non-object arguments are rejected', Boolean(nonObject[0]?.argumentsError))

  const empty = parseToolCalls(undefined)
  expect('no tool_calls means no tool calls', empty.length === 0)
}

/** A provider pointed at a dead port must report provider_unavailable. */
async function checkUnreachable() {
  console.log('\nNIM unreachable handling')

  const provider = createNvidiaProvider({
    baseUrl: 'http://127.0.0.1:1/v1',
    model: 'meta/llama-3.1-8b-instruct',
    timeoutMs: 1500,
  })

  try {
    await provider.generateWithTools({
      system: 'test',
      history: [],
      message: 'hello',
      tools: [],
      toolCycle: [],
    })
    expect('an unreachable NIM raises', false)
  } catch (error) {
    const kind = (error as { kind?: string }).kind
    expect('an unreachable NIM raises provider_unavailable', kind === 'provider_unavailable', `kind=${kind}`)
  }
}

/* --- End to end ------------------------------------------------------------ */

async function runDemo(baseUrl: string, label: string) {
  console.log(`\nEnd-to-end via ${label}`)
  console.log(`  > ${DEMO_MESSAGE}`)

  const events: NovaServerEvent[] = []
  for await (const event of runNovaAgent(
    {
      geminiApiKey: process.env.GEMINI_API_KEY,
      supabaseUrl: process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
      authorization: process.env.VITE_SUPABASE_ANON_KEY
        ? `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        : null,
      llmProvider: 'nvidia',
      nvidiaBaseUrl: baseUrl,
      nvidiaApiKey: process.env.NIM_API_KEY,
      nvidiaModel: process.env.NIM_MODEL ?? 'meta/llama-3.1-8b-instruct',
    },
    { message: DEMO_MESSAGE },
  )) {
    events.push(event)
  }

  const failure = events.find((event) => event.type === 'error')
  if (failure) {
    expect(`${label}: no error event`, false, `${failure.code}: ${failure.message}`)
    return
  }

  const toolEvents = events.filter((event) => event.type === 'tool')
  const searchRan = toolEvents.some((event) => event.name === 'search_places')
  const searchDone = toolEvents.some(
    (event) => event.name === 'search_places' && event.status === 'done',
  )
  const text = events.find((event) => event.type === 'text')
  const answer = text?.type === 'text' ? text.content : ''

  expect(`${label}: Llama called search_places`, searchRan)
  expect(`${label}: search_places executed successfully`, searchDone)
  expect(`${label}: a final answer was produced`, answer.length > 40, `${answer.length} chars`)
  expect(
    `${label}: the answer is prose, not a tool call`,
    !/"?tool_calls"?|"?function"?\s*:|^\s*\{/.test(answer),
  )
  expect(
    `${label}: the answer names a Tunis catalogue place`,
    /medina|bardo|carthage|sidi bou|zitouna|dar el jeld/i.test(answer),
    answer.slice(0, 160).replace(/\s+/g, ' '),
  )

  console.log('')
  console.log('  NOVA:')
  console.log(
    answer
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n'),
  )
}

/* --- Main ------------------------------------------------------------------ */

async function main() {
  const configured = process.env.NIM_BASE_URL ?? 'http://localhost:8000/v1'

  checkParsing()
  await checkUnreachable()

  const live = await probe(configured)
  console.log(`\nNIM at ${configured}: ${live ? 'reachable' : 'NOT reachable'}`)

  if (live) {
    await runDemo(configured, 'real NIM')
  } else {
    console.log(
      '  Falling back to a stub NIM. This verifies the tool-calling loop and the\n' +
        '  OpenAI wire format, but NOT that the real Llama model behaves.',
    )
    const stub = await startStubNim()
    try {
      await runDemo(stub.baseUrl, 'stub NIM')

      // The request shape is the part most likely to be silently wrong.
      console.log('\nRequest shape sent to NIM')
      const second = stub.seen[1] as
        | {
            tools?: { function?: { name?: string } }[]
            tool_choice?: string
            messages?: { role: string; tool_calls?: { id: string }[]; tool_call_id?: string }[]
          }
        | undefined

      expect('two requests were made (tool call, then answer)', stub.seen.length === 2, `${stub.seen.length}`)
      expect(
        'search_places was advertised in tools[]',
        Boolean(second?.tools?.some((tool) => tool.function?.name === 'search_places')),
      )
      expect('tool_choice is auto', second?.tool_choice === 'auto')

      const assistant = second?.messages?.find((message) => message.tool_calls?.length)
      const toolMessage = second?.messages?.find((message) => message.role === 'tool')
      expect('the assistant tool_calls message was replayed', Boolean(assistant))
      expect('a role=tool result message was appended', Boolean(toolMessage))
      expect(
        'tool_call_id matches the assistant tool call',
        Boolean(assistant?.tool_calls?.[0]?.id) &&
          assistant?.tool_calls?.[0]?.id === toolMessage?.tool_call_id,
        `${assistant?.tool_calls?.[0]?.id} === ${toolMessage?.tool_call_id}`,
      )
    } finally {
      await stub.close()
    }
  }
}

main()
  .catch((error) => {
    failures += 1
    console.error('\nERROR verifier crashed')
    console.error(error)
  })
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} case(s) failed.`)
      process.exitCode = 1
      return
    }
    console.log('\nAll cases passed.')
  })
