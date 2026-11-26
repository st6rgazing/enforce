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
    return next(e)
  })
}
