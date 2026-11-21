// Records every skill an agent in an Orca terminal loads, from the agent.tool.after hook.
// A save restarts the worker and drops its memory, so the log lives in orca.storage.
import type { OrcaWorkerApi } from 'orca/worker'
import { detectSkill } from './detect'

const CALLS = 'calls'
/** Oldest calls drop off past this, to keep storage and the panel small. */
export const MAX_CALLS = 2000

async function storedCalls(orca: OrcaWorkerApi): Promise<SkillCall[]> {
  const value = await orca.storage.get(CALLS)
  return Array.isArray(value) ? (value as unknown as SkillCall[]) : []
}

export default function activate(orca: OrcaWorkerApi): void {
  // Tool calls can finish close together: run each read-modify-write in turn so none is lost.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work)
    queue = next.catch(() => undefined)
    return next
  }

  orca.panels.handle('skills.list', async () => ({ calls: await storedCalls(orca) }))

  orca.panels.handle('skills.clear', () =>
    serial(async () => {
      await orca.storage.set(CALLS, [])
      orca.panels.post('skills.changed', { calls: [] })
      return { calls: [] }
    })
  )

  // Observe only: Orca does not wait for this hook, and returning nothing leaves the call alone.
  orca.hooks.on('agent.tool.after', async (event) => {
    const found = detectSkill(event.tool, event.input)
    if (!found) return
    await serial(async () => {
      const calls = await storedCalls(orca)
      const id = event.callId ?? `${event.terminalId ?? 'none'}-${Date.now()}-${calls.length}`
      if (event.callId && calls.some((call) => call.id === id)) return
      const call: SkillCall = {
        id,
        skill: found.skill,
        source: found.source,
        agent: event.agent,
        workspaceId: event.workspaceId,
        terminalId: event.terminalId ?? null,
        at: Date.now(),
        ...(found.args ? { args: found.args } : {})
      }
      const next = [...calls, call].slice(-MAX_CALLS)
      await orca.storage.set(CALLS, next as unknown as never)
      orca.panels.post('skills.changed', { calls: next })
    })
  })
}
