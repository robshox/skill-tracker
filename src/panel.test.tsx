// `orca plugin test .` runs this in Node with the same runtime and checks Orca uses.
import { assert, mockHost, mount, test } from 'orca/testing'
import * as panel from './panel'

const call = (id: string, skill: string, terminalId: string, at: number): SkillCall => ({
  id,
  skill,
  source: 'tool',
  agent: 'claude',
  workspaceId: 'wt-1',
  terminalId,
  at
})

test('shows an empty state with no calls', async () => {
  const view = await mount(panel, { host: mockHost({ requests: { 'skills.list': () => ({ calls: [] }) } }) })
  assert.ok(view.summary().includes('EmptyState "No skill calls yet"'))
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('shows the total and updates when the worker posts', async () => {
  const calls = [call('1', 'mt-build', 't1', 1000), call('2', 'mt-build', 't1', 2000), call('3', 'mt-verify', 't2', 3000)]
  const view = await mount(panel, { host: mockHost({ requests: { 'skills.list': () => ({ calls }) } }) })
  assert.equal(view.find({ role: 'status' })?.text, '3')

  await view.post('skills.changed', { calls: [...calls, call('4', 'mt-ship', 't2', 4000)] })
  assert.equal(view.find({ role: 'status' })?.text, '4')
  assert.deepEqual(view.errors, [])
  assert.deepEqual(view.refusals, [])
  await view.unmount()
})
