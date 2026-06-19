// Role → allowed module IDs (client-safe, no server imports)
export const ROLE_MODULES: Record<string, string[]> = {
  admin:      ['analytics','inventory','production','orders','purchasing','suppliers','quality','dispatch','subcontract','hr'],
  hr:         ['hr'],
  production: ['analytics','inventory','production'],
  quality:    ['analytics','inventory','quality'],
  sales:      ['analytics','orders','inventory'],
  warehouse:  ['analytics','inventory','dispatch'],
  manager:    ['analytics','inventory','production','orders','purchasing','suppliers','quality','dispatch','subcontract','hr'],
}

export function canAccess(role: string, moduleId: string): boolean {
  const allowed = ROLE_MODULES[role] || []
  const base = moduleId.startsWith('hr') ? 'hr' : moduleId
  return allowed.includes(base)
}
