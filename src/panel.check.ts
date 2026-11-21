// `orca plugin check` renders the panel once per scenario, each with the worker on a fresh host.
import { defineCheck } from 'orca/testing'

const now = Date.now()
const call = (id: string, skill: string, terminalId: string, minutesAgo: number, agent = 'claude') => ({
  id,
  skill,
  source: agent === 'claude' ? 'tool' : 'file',
  agent,
  workspaceId: 'wt-1',
  terminalId,
  at: now - minutesAgo * 60_000
})

export default defineCheck({
  empty: {},
  busy: {
    storage: {
      calls: [
        call('1', 'mt-plan', 'term-aaaaaa', 90),
        call('2', 'mt-build', 'term-aaaaaa', 60),
        call('3', 'mt-build', 'term-aaaaaa', 40),
        call('4', 'mt-verify', 'term-aaaaaa', 20),
        call('5', 'mt-review', 'term-bbbbbb', 10, 'codex'),
        call('6', 'mt-build', 'term-aaaaaa', 2)
      ]
    }
  }
})
