// The panel <-> worker contract, declared once: src/panel.tsx and src/worker.ts both read it.
export {}

declare global {
  /** One skill an agent loaded, as the worker recorded it. */
  type SkillCall = {
    /** The tool call id when the agent gives one, else a generated id. */
    id: string
    /** Skill name as the agent named it, e.g. `mt-build` or `vercel:nextjs`. */
    skill: string
    /** Arguments passed to the Skill tool, when any. */
    args?: string
    /** `tool`: the agent called a Skill tool (Claude Code). `file`: it read a SKILL.md (Codex and others). */
    source: 'tool' | 'file'
    /** The agent CLI, e.g. `claude` or `codex`. */
    agent: string
    workspaceId: string | null
    /** The Orca terminal the agent runs in: one session. */
    terminalId: string | null
    /** Milliseconds since the epoch. */
    at: number
  }
}

declare module 'orca' {
  interface PluginRequests {
    /** Every recorded call, oldest first. */
    'skills.list': { output: { calls: SkillCall[] } }
    /** Forgets every recorded call. */
    'skills.clear': { output: { calls: SkillCall[] } }
  }
  interface PluginPanelEvents {
    /** Posted to every open panel after a call is recorded or the log is cleared. */
    'skills.changed': { calls: SkillCall[] }
  }
}
