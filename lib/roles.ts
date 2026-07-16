// Role → allowed module IDs (client-safe, no server imports)
// Modules are being rebuilt from scratch; HR is the only live module.
export const ROLE_MODULES: Record<string, string[]> = {
  admin:      ['hr'],
  hr:         ['hr'],
  production: ['hr'],
  quality:    ['hr'],
  sales:      ['hr'],
  warehouse:  ['hr'],
  manager:    ['hr'],
}

export function canAccess(role: string, moduleId: string): boolean {
  const allowed = ROLE_MODULES[role] || []
  const base = moduleId.startsWith('hr') ? 'hr' : moduleId
  return allowed.includes(base)
}
