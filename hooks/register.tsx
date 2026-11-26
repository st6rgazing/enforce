import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

interface Rule {
  id: string
  original: string
  type: 'file-protect' | 'bash-deny' | 'behavioral'
  pattern: string | null
  message: string
}

const rulesAtom = atom(
  { plugin: 'enforce', key: 'rules-v1' } as const,
  [] as Rule[],
  { shape: 'rules-v1' },
)

const violationsAtom = atom(
  { plugin: 'enforce', key: 'violations-v1' } as const,
  {} as Record<string, number>,
  { shape: 'violations-v1' },
)

const PROMPT = (md: string) => `\
Classify each rule from this CLAUDE.md into one of three types and output JSON only.

Types:
- file-protect: prevents writing/editing specific files or paths. Set pattern to a regex matching the file_path.
- bash-deny: prevents specific shell commands. Set pattern to a regex matching the command string.
- behavioral: style, process, or judgment rules that cannot be mechanically enforced. Set pattern to null.

Output this shape exactly, no prose:
{"rules":[{"id":"kebab-id","original":"original rule text","type":"file-protect|bash-deny|behavioral","pattern":"regex or null","message":"short denial message for hooks"}]}

CLAUDE.md:
${md}

JSON:`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'enforce',
      description: 'Compile CLAUDE.md rules into live hooks',
    })
    await $.command.register({
      name: 'enforce-violations',
      description: 'Show rule violation counts for this session',
    })
    return next(e)
  })

  on('command.run', { command: 'enforce' }, async $ => {
    let claudeMd: string
    try {
      claudeMd = await $.fs.read('CLAUDE.md')
    } catch {
      return { text: 'No CLAUDE.md found in this project.' }
    }

    $.ui.status('enforce: analyzing…')

    const result = await $.model.complete({
      model: 'haiku',
      prompt: PROMPT(claudeMd),
      effort: 'low',
    })

    $.ui.status(undefined)

    if (!result.isAnswered) {
      return { text: `enforce: analysis failed (${result.reason})` }
    }

    let parsed: { rules: Rule[] }
    try {
      const json = result.text.match(/\{[\s\S]*\}/)?.at(0) ?? result.text
      parsed = JSON.parse(json) as { rules: Rule[] }
    } catch {
      return { text: `enforce: could not parse model output\n${result.text}` }
    }

    await update($, rulesAtom, () => parsed.rules)

    const enforced = parsed.rules.filter(r => r.type !== 'behavioral')
    const behavioral = parsed.rules.filter(r => r.type === 'behavioral')

    const lines: string[] = [
      `Compiled ${parsed.rules.length} rules from CLAUDE.md`,
      `  ${enforced.length} enforced by hooks`,
      `  ${behavioral.length} behavioral (noted only)`,
    ]
    if (enforced.length > 0) {
      lines.push('', 'Enforced:')
      enforced.forEach(r => lines.push(`  • ${r.original}`))
    }
    if (behavioral.length > 0) {
      lines.push('', 'Behavioral (not enforced):')
      behavioral.forEach(r => lines.push(`  • ${r.original}`))
    }

    return { text: lines.join('\n') }
  })

  on('command.run', { command: 'enforce-violations' }, async $ => {
    const counts = await read($, violationsAtom)
    const list = await read($, rulesAtom)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    if (total === 0) return { text: 'No violations blocked yet.' }

    const lines: string[] = [`${total} violation${total === 1 ? '' : 's'} blocked:`]
    for (const rule of list) {
      const n = counts[rule.id] ?? 0
      if (n > 0) lines.push(`  ${n}x  ${rule.original}`)
    }
    return { text: lines.join('\n') }
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const list = await read($, rulesAtom)
    for (const rule of list) {
      if (rule.type === 'file-protect' && rule.pattern && new RegExp(rule.pattern).test(e.file_path)) {
        await update($, violationsAtom, v => ({ ...v, [rule.id]: (v[rule.id] ?? 0) + 1 }))
        return { deny: `[enforce] ${rule.message}` }
      }
    }
    return next(e)
  }).catch(($, e, next) => next.called ? next(e) : next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const list = await read($, rulesAtom)
    for (const rule of list) {
      if (rule.type === 'file-protect' && rule.pattern && new RegExp(rule.pattern).test(e.file_path)) {
        await update($, violationsAtom, v => ({ ...v, [rule.id]: (v[rule.id] ?? 0) + 1 }))
        return { deny: `[enforce] ${rule.message}` }
      }
    }
    return next(e)
  }).catch(($, e, next) => next.called ? next(e) : next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const list = await read($, rulesAtom)
    for (const rule of list) {
      if (rule.type === 'bash-deny' && rule.pattern && new RegExp(rule.pattern).test(e.command)) {
        await update($, violationsAtom, v => ({ ...v, [rule.id]: (v[rule.id] ?? 0) + 1 }))
        return { deny: `[enforce] ${rule.message}` }
      }
    }
    return next(e)
  }).catch(($, e, next) => next.called ? next(e) : next(e))
}
