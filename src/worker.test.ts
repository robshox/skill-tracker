// Runs src/worker.ts's activate(orca) over a mock host and fires the agent.tool.after hook at it.
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import * as main from './worker'
import { detectSkill } from './detect'

const hooks = ['agent.tool.after']

const toolCall = (tool: string, input: unknown, extra: Record<string, unknown> = {}) =>
  ({ agent: 'claude', workspaceId: 'wt-1', terminalId: 't1', tool, input, ...extra }) as never

test('records a Claude Code Skill call and tells open panels', async () => {
  const host = mockHost()
  const worker = await mountWorker(main, { host, hooks })
  await worker.hooks.fire('agent.tool.after', toolCall('Skill', { skill: 'mt-build', args: '#12' }, { callId: 'c1' }))

  const { calls } = (await worker.request('skills.list')) as { calls: SkillCall[] }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].skill, 'mt-build')
  assert.equal(calls[0].args, '#12')
  assert.equal(calls[0].source, 'tool')
  assert.equal(calls[0].terminalId, 't1')
  assert.equal(worker.posts.length, 1)
  assert.deepEqual(worker.refusals, [])
  await worker.deactivate()
})

test('ignores other tools and does not double count a repeated call id', async () => {
  const worker = await mountWorker(main, { host: mockHost(), hooks })
  await worker.hooks.fire('agent.tool.after', toolCall('Bash', { command: 'ls' }))
  await worker.hooks.fire('agent.tool.after', toolCall('Skill', { skill: 'mt-verify' }, { callId: 'c2' }))
  await worker.hooks.fire('agent.tool.after', toolCall('Skill', { skill: 'mt-verify' }, { callId: 'c2' }))

  const { calls } = (await worker.request('skills.list')) as { calls: SkillCall[] }
  assert.deepEqual(calls.map((c) => c.skill), ['mt-verify'])
  await worker.deactivate()
})

test('keeps every call when several finish at once', async () => {
  const worker = await mountWorker(main, { host: mockHost(), hooks })
  await Promise.all(
    ['a', 'b', 'c', 'd'].map((skill, i) =>
      worker.hooks.fire('agent.tool.after', toolCall('Skill', { skill }, { callId: `p${i}` }))
    )
  )
  const { calls } = (await worker.request('skills.list')) as { calls: SkillCall[] }
  assert.equal(calls.length, 4)
  await worker.deactivate()
})

test('clear empties the log', async () => {
  const worker = await mountWorker(main, { host: mockHost(), hooks })
  await worker.hooks.fire('agent.tool.after', toolCall('Skill', { skill: 'mt-plan' }))
  assert.deepEqual(await worker.request('skills.clear'), { calls: [] })
  assert.deepEqual(await worker.request('skills.list'), { calls: [] })
  await worker.deactivate()
})

test('detects a skill another agent loads by reading its SKILL.md', () => {
  assert.deepEqual(detectSkill('exec_command', { cmd: 'cat ~/.codex/skills/mt-review/SKILL.md' }), {
    skill: 'mt-review',
    source: 'file'
  })
  assert.deepEqual(detectSkill('Read', { file_path: '/repo/.agents/skills/mt-spec/SKILL.md' }), {
    skill: 'mt-spec',
    source: 'file'
  })
})

test('detects a skill read through argv and inside a cd chain', () => {
  assert.deepEqual(detectSkill('shell', { command: ['bash', '-lc', "sed -n '1,200p' .agents/skills/mt-build/SKILL.md"] }), {
    skill: 'mt-build',
    source: 'file'
  })
  assert.deepEqual(detectSkill('Bash', { command: 'cd /repo && cat "/repo/.claude/skills/vercel:nextjs/SKILL.md"' }), {
    skill: 'vercel:nextjs',
    source: 'file'
  })
})

test('does not count editing a SKILL.md, or mentioning one, as loading it', () => {
  assert.equal(detectSkill('Edit', { file_path: '/repo/.agents/skills/mt-spec/SKILL.md' }), null)
  assert.equal(detectSkill('Bash', { command: "sed -i '' 's/a/b/' .agents/skills/mt-spec/SKILL.md" }), null)
  assert.equal(detectSkill('Bash', { command: 'cat .agents/skills/mt-spec/SKILL.md > /tmp/copy.md' }), null)
  assert.equal(detectSkill('Read', { file_path: '/repo/.agents/skills/mt-spec/references/notes.md' }), null)
  // A command whose text only mentions the read, as a test payload would.
  assert.equal(
    detectSkill('Bash', {
      command: `orca plugin dev hook . agent.tool.after --data '{"input":{"cmd":"cat ~/.codex/skills/mt-spec/SKILL.md"}}'`
    }),
    null
  )
  assert.equal(detectSkill('Bash', { command: 'grep -r SKILL.md .agents/skills/mt-spec/SKILL.md' }), null)
  assert.equal(detectSkill('Skill', { skill: '' }), null)
})
