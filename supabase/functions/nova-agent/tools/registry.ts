/**
 * Tool registry.
 *
 * The single list of what NOVA can do. The orchestrator asks this for the
 * definitions it hands the model, and looks a tool up by name to run it — so
 * the model can never invoke anything that is not registered here.
 *
 * Only tools backed by real data or real arithmetic are listed. Availability,
 * live pricing and booking are deliberately absent: there is no provider
 * behind them, and a tool that returns invented answers is worse than none.
 */
import { getPlaceDetailsTool, searchPlacesTool } from './places.ts'
import { buildItineraryTool, calculateBudgetTool, optimizeRouteTool } from './planning.ts'
import type { NovaTool } from './types.ts'
import type { LLMToolDefinition } from '../llm/types.ts'

export * from './types.ts'

const TOOLS: NovaTool[] = [
  searchPlacesTool,
  getPlaceDetailsTool,
  optimizeRouteTool,
  buildItineraryTool,
  calculateBudgetTool,
]

const BY_NAME = new Map<string, NovaTool>(TOOLS.map((tool) => [tool.definition.name, tool]))

export function toolDefinitions(): LLMToolDefinition[] {
  return TOOLS.map((tool) => tool.definition)
}

export function toolNames(): string[] {
  return TOOLS.map((tool) => tool.definition.name)
}

export function findTool(name: string): NovaTool | undefined {
  return BY_NAME.get(name)
}
