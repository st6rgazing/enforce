declare module 'claude-code' {
  interface PluginState {
    enforce: {
      'rules-v1': Array<{
        id: string
        original: string
        type: 'file-protect' | 'bash-deny' | 'behavioral'
        pattern: string | null
        message: string
      }>
      'violations-v1': Record<string, number>
    }
  }
}
