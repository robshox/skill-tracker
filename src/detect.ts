// Works out whether a tool call loaded a skill. Kept apart from the worker so tests can hit it directly.

export type Detected = { skill: string; args?: string; source: 'tool' | 'file' }

/** Tools that read one file by path. */
const READ_TOOLS = new Set(['Read', 'read_file', 'view'])

/** `.../skills/<name>/SKILL.md`, the layout Claude Code, Codex and skills.sh all use. */
const SKILL_PATH = /(?:^|\/)skills\/([A-Za-z0-9._:-]+)\/SKILL\.md$/

/** A shell step that prints a file: the verb, its flags, then the path as its last word. */
const READ_STEP = /^(?:cat|head|tail|less|more|bat|nl|sed\s+-n|Get-Content|type)\b[^|<>]*?\s["']?([^\s"']*skills\/[A-Za-z0-9._:-]+\/SKILL\.md)["']?$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** The command line a shell tool ran: Claude's `command`, Codex's `cmd`, or argv like ["bash", "-lc", "..."]. */
function commandOf(fields: Record<string, unknown>): string | null {
  const raw = fields.command ?? fields.cmd
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw.every((part) => typeof part === 'string')) {
    const parts = raw as string[]
    const shellFlag = parts.findIndex((part) => part === '-c' || part === '-lc')
    return shellFlag >= 0 ? (parts[shellFlag + 1] ?? null) : parts.join(' ')
  }
  return null
}

/** Only a step that starts by reading the SKILL.md counts; a path merely mentioned in text does not. */
function skillReadIn(command: string): string | null {
  for (const step of command.split(/&&|\|\||;|\n|\|/)) {
    const match = READ_STEP.exec(step.trim())
    if (match) return SKILL_PATH.exec(match[1])?.[1] ?? null
  }
  return null
}

export function detectSkill(tool: string, input: unknown): Detected | null {
  const fields = asRecord(input)
  if (!fields) return null

  // Claude Code: the Skill tool, input { skill, args? }.
  if (tool === 'Skill') {
    const skill = fields.skill
    if (typeof skill !== 'string' || skill.trim() === '') return null
    const args = typeof fields.args === 'string' && fields.args.trim() !== '' ? fields.args : undefined
    return { skill: skill.trim(), args, source: 'tool' }
  }

  // Agents without a Skill tool (Codex and others) load a skill by reading its SKILL.md.
  if (READ_TOOLS.has(tool)) {
    const path = fields.file_path ?? fields.path
    const skill = typeof path === 'string' ? SKILL_PATH.exec(path)?.[1] : undefined
    return skill ? { skill, source: 'file' } : null
  }
  const command = commandOf(fields)
  const skill = command ? skillReadIn(command) : null
  return skill ? { skill, source: 'file' } : null
}
