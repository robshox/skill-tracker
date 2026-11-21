# Skill Tracker

An Orca sidebar panel that shows which skills agents load, per session and across sessions: a count per skill, when each was last used, and a timeline.

## How it works

- `src/worker.ts` listens to Orca's `agent.tool.after` hook (observe only: Orca never waits on it), keeps matching calls in the plugin's own storage (last 2,000) and posts each change to open panels.
- `src/detect.ts` decides what counts as loading a skill:
  - **Claude Code**: a `Skill` tool call (`input.skill`, `input.args`). Shown as "Skill tool".
  - **Codex and others**: reading a `.../skills/<name>/SKILL.md`, either with a read tool or a shell step that starts with `cat`/`head`/`sed -n`/… on that path. Shown as "read file". Edits, redirects and commands that only mention the path don't count.
- `src/panel.tsx`: a **Session** tab (pick an Orca terminal: counts + timeline) and an **All sessions** tab (totals), plus Clear log.

## Known gaps

- Skills you invoke yourself with `/skill-name` are expanded into the prompt by Claude Code and never go through a tool, so they aren't recorded.
- Recording starts once the plugin is loaded; there is no backfill.
- Orca doesn't hook agents on SSH or WSL hosts yet.
- Skill calls made inside subagents are untested.

## Develop

```sh
orca plugin test .          # worker + panel tests
orca plugin check .         # renders the panel in each src/panel.check.ts scenario
npx -p typescript tsc -p .  # type-check
orca plugin dev watch .     # load into Orca and stream logs/reloads
orca plugin dev hook . agent.tool.after --data '{"agent":"claude","workspaceId":null,"terminalId":"t1","tool":"Skill","input":{"skill":"mt-build"}}'
```
