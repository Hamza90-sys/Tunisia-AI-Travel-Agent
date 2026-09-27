-- =============================================================================
-- TuniTrip AI — NOVA persistence for the Gemini agent
--
-- Additive migration. Two columns, no destructive changes.
--
-- Why the display roles are NOT changing
--   The Gemini Interactions API keeps conversation state server-side and is
--   resumed with `previous_interaction_id`, so the client never replays a
--   wire-format transcript. `nova_messages` is therefore our own display and
--   audit log, and the existing nova_message_role ('user','nova','system')
--   remains exactly right for it. No enum change, and so no
--   `ALTER TYPE ... ADD VALUE` transaction hazard.
-- =============================================================================

-- Tool results, paired with the existing `tool_calls` column.
--
-- `tool_calls`   -> what the model asked for (Gemini `function_call` steps)
-- `tool_results` -> what our tools returned (Gemini `function_result` payloads)
--
-- Kept as jsonb rather than a child table: these are an append-only audit trail
-- read back as a unit with their message, never queried across conversations.
alter table public.nova_messages
  add column if not exists tool_results jsonb;

comment on column public.nova_messages.tool_results is
  'Results returned to the model for this message''s tool calls, mirroring tool_calls. Audit/display only.';

-- The provider-side conversation handle. Storing the most recent interaction id
-- is what lets a traveller resume a NOVA conversation across sessions without
-- us re-sending the whole history.
alter table public.nova_conversations
  add column if not exists provider_interaction_id text;

comment on column public.nova_conversations.provider_interaction_id is
  'Most recent Gemini interaction id for this conversation; passed as previous_interaction_id to resume server-side state.';

-- Existing RLS on both tables (owner-only, `for all`) already covers the new
-- columns — policies are row-scoped, not column-scoped. Nothing to re-grant.
