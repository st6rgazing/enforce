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

export const register: Register = on => {
  // placeholder — hooks added next
}
