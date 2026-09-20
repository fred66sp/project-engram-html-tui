// Network-free check for the command catalog: src/api/commands.ts and its projection into
// src/api/projects.ts.
//
// This check opens no socket and spawns no process: it only reads the two modules and asserts
// their invariants. Nothing here touches the user's real memory store.
//
// Usage: npm run check:commands
// Node 24 strips the TypeScript types natively, so this needs no test framework.
import assert from 'node:assert/strict'

const { COMMAND_GROUPS, COMMANDS_BY_ID, COMMAND_COUNT, commandText } = await import(
  '../src/api/commands.ts'
)
const { PROJECT_COMMANDS } = await import('../src/api/projects.ts')

/** The five ids the /projects view copies from, in the order it renders them. */
const PROJECT_COMMAND_IDS = [
  'projects-list',
  'projects-prune-dry-run',
  'projects-prune',
  'projects-consolidate-dry-run',
  'projects-consolidate',
] as const

let failures = 0

async function check(name: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (cause) {
    failures += 1
    console.error(`FAIL ${name} — ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

await check('catalog -> group ids and command ids are unique', () => {
  const groupIds = COMMAND_GROUPS.map((group) => group.id)
  assert.equal(new Set(groupIds).size, groupIds.length, 'duplicated group id')
  const ids = COMMAND_GROUPS.flatMap((group) => group.entries.map((entry) => entry.id))
  assert.equal(new Set(ids).size, ids.length, 'duplicated command id')
  assert.equal(COMMANDS_BY_ID.size, COMMAND_COUNT)
  assert.equal(COMMANDS_BY_ID.size, ids.length)
})

await check('catalog -> no command text appears in two entries', () => {
  const commands = COMMAND_GROUPS.flatMap((group) => group.entries.map((entry) => entry.command))
  assert.equal(new Set(commands).size, commands.length, 'duplicated command text')
  assert.ok(commands.length > 0, 'empty catalog')
})

await check('catalog -> every group and entry is complete', () => {
  for (const group of COMMAND_GROUPS) {
    assert.ok(group.title.trim(), `group ${group.id} has no title`)
    assert.ok(group.intro.trim(), `group ${group.id} has no intro`)
    assert.ok(group.entries.length > 0, `group ${group.id} is empty`)
    for (const entry of group.entries) {
      assert.equal(entry.command, entry.command.trim(), `${entry.id} command is not trimmed`)
      assert.match(entry.command, /^(engram|npm) /, `${entry.id} is not an engram or npm command`)
      assert.ok(entry.label.trim(), `${entry.id} has no label`)
      assert.ok(entry.description.trim(), `${entry.id} has no description`)
      assert.ok(entry.purpose.trim(), `${entry.id} has no purpose`)
      assert.notEqual(
        entry.description.trim(),
        entry.purpose.trim(),
        `${entry.id} repeats the same text as description and purpose`,
      )
    }
  }
})

await check('commandText -> exact text, and an unknown id throws', () => {
  assert.equal(commandText('serve'), 'engram serve')
  assert.throws(() => commandText('nope'), /unknown command id: nope/)
})

await check('PROJECT_COMMANDS -> derived from the catalog, in render order', () => {
  assert.deepEqual(Object.values(PROJECT_COMMANDS), [
    'engram projects list',
    'engram projects prune --dry-run',
    'engram projects prune',
    'engram projects consolidate --all --dry-run',
    'engram projects consolidate --all',
  ])
  assert.deepEqual(
    PROJECT_COMMAND_IDS.map((id) => commandText(id)),
    Object.values(PROJECT_COMMANDS),
  )
})

if (failures > 0) {
  console.error(`check:commands: FAILED (${failures} case(s))`)
  process.exit(1)
}
console.log('check:commands: ok')
