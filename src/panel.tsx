// Shows which skills agents loaded: per session (one Orca terminal) and across all sessions.
import {
  atom,
  Badge,
  Button,
  EmptyState,
  Heading,
  plugin,
  read,
  Row,
  Select,
  set,
  Stack,
  Tab,
  Table,
  Tabs,
  Text,
  type PanelContext,
  type TableColumn,
  type TableRow
} from 'orca'

/** Every recorded call, oldest first; null until the worker answers. */
const calls = atom<SkillCall[] | null>(null)
/** The session picked in "Session"; null follows the most recent one. */
const pickedSession = atom<string | null>(null)
const tab = atom('tab', 'session', { persist: 'plugin' })

const NO_TERMINAL = 'none'
const sessionKey = (call: SkillCall) => call.terminalId ?? NO_TERMINAL

export function setup(ctx: PanelContext): void {
  ctx.subscriptions.push(plugin.on('skills.changed', (payload) => set(calls, payload.calls)))
  void plugin.request('skills.list').then((answer) => set(calls, answer.calls))
}

async function clear(): Promise<void> {
  const answer = await plugin.request('skills.clear')
  set(calls, answer.calls)
  set(pickedSession, null)
}

type Session = { key: string; agent: string; first: number; last: number; count: number }

/** Sessions, most recently active first. */
function sessionsOf(list: SkillCall[]): Session[] {
  const byKey = new Map<string, Session>()
  for (const call of list) {
    const key = sessionKey(call)
    const found = byKey.get(key)
    if (found) {
      found.last = Math.max(found.last, call.at)
      found.count += 1
    } else {
      byKey.set(key, { key, agent: call.agent, first: call.at, last: call.at, count: 1 })
    }
  }
  return [...byKey.values()].sort((a, b) => b.last - a.last)
}

function sessionLabel(session: Session): string {
  const when = new Date(session.first).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const terminal = session.key === NO_TERMINAL ? 'no terminal' : session.key.slice(-6)
  return `${session.agent} · ${when} · ${terminal} (${session.count})`
}

const countColumns: TableColumn[] = [
  { key: 'skill', label: 'Skill', minWidth: 'sm' },
  { key: 'count', label: 'Calls', align: 'end', width: 'xs' },
  { key: 'last', label: 'Last', align: 'end', width: 'sm', hideBelow: 'sm' }
]

/** One row per skill, most called first. */
function countRows(list: SkillCall[]): TableRow[] {
  const bySkill = new Map<string, { count: number; last: number }>()
  for (const call of list) {
    const found = bySkill.get(call.skill)
    if (found) {
      found.count += 1
      found.last = Math.max(found.last, call.at)
    } else {
      bySkill.set(call.skill, { count: 1, last: call.at })
    }
  }
  return [...bySkill.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
    .map(([skill, { count, last }]) => ({
      key: skill,
      cells: { skill, count, last: { type: 'relative', at: last, format: 'short' } }
    }))
}

const timelineColumns: TableColumn[] = [
  { key: 'at', label: 'When', width: 'sm' },
  { key: 'skill', label: 'Skill', minWidth: 'sm' },
  { key: 'how', label: 'How', width: 'xs', hideBelow: 'sm' }
]

/** Newest first. */
function timelineRows(list: SkillCall[]): TableRow[] {
  return [...list].reverse().map((call) => ({
    key: call.id,
    cells: {
      at: { type: 'relative', at: call.at, format: 'short' },
      skill: call.args ? `${call.skill} ${call.args}` : call.skill,
      how: call.source === 'tool' ? 'Skill tool' : 'read file'
    }
  }))
}

function SessionView({ list }: { list: SkillCall[] }) {
  const sessions = sessionsOf(list)
  const picked = read(pickedSession)
  const current = sessions.find((s) => s.key === picked) ?? sessions[0]
  const inSession = list.filter((call) => sessionKey(call) === current.key)
  return (
    <Stack gap="md">
      <Select
        label="Session"
        value={current.key}
        options={sessions.map((s) => ({ value: s.key, label: sessionLabel(s) }))}
        onChange={(value) => set(pickedSession, value)}
      />
      <Table label="Skill counts in this session" columns={countColumns} rows={countRows(inSession)} />
      <Heading level={3}>Timeline</Heading>
      <Table label="Skill calls in this session" columns={timelineColumns} rows={timelineRows(inSession)} maxHeight="md" />
    </Stack>
  )
}

function AllView({ list }: { list: SkillCall[] }) {
  return (
    <Stack gap="md">
      <Text muted size="xs">
        {list.length} calls across {sessionsOf(list).length} sessions
      </Text>
      <Table label="Skill counts across all sessions" columns={countColumns} rows={countRows(list)} maxHeight="lg" />
    </Stack>
  )
}

export default function Panel() {
  const list = read(calls)
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>Skill calls</Heading>
        <Badge tone="accent">{list === null ? '-' : String(list.length)}</Badge>
      </Row>
      {list === null ? (
        <Text muted>Loading…</Text>
      ) : list.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No skill calls yet"
          description="When an agent in an Orca terminal loads a skill, it shows up here."
        />
      ) : (
        <Stack gap="md">
          <Tabs label="View" value={read(tab)} onChange={(value) => set(tab, value)}>
            <Tab value="session" label="Session">
              <SessionView list={list} />
            </Tab>
            <Tab value="all" label="All sessions">
              <AllView list={list} />
            </Tab>
          </Tabs>
          <Row justify="end">
            <Button variant="ghost" size="sm" icon="delete" onPress={clear}>
              Clear log
            </Button>
          </Row>
        </Stack>
      )}
    </Stack>
  )
}
