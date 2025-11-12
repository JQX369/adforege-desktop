import type { CatalogProvider, ProviderName } from './types'

// Simple provider registry with env-driven enablement.
// Providers should call registerProvider() at module top-level or be
// registered by the orchestrator before use.

type ProviderFactory = () => CatalogProvider

const registry = new Map<ProviderName, CatalogProvider | ProviderFactory>()

export function registerProvider(
  name: ProviderName,
  provider: CatalogProvider | ProviderFactory
): void {
  registry.set(name, provider)
}

export function getRegisteredProviderNames(): ProviderName[] {
  return Array.from(registry.keys())
}

export function isProviderRegistered(name: ProviderName): boolean {
  return registry.has(name)
}

export function getEnabledProviderNames(
  env: NodeJS.ProcessEnv = process.env
): ProviderName[] {
  const raw = env.ENABLED_PROVIDERS ?? ''
  // Default to CSV if nothing specified to preserve local/dev workflows
  const list = raw.trim().length > 0 ? raw : 'csv'
  const names = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ProviderName[]
  // De-duplicate while preserving order
  const seen = new Set<string>()
  const unique: ProviderName[] = []
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n)
      unique.push(n)
    }
  }
  return unique
}

function materialize(entry: CatalogProvider | ProviderFactory): CatalogProvider {
  return typeof entry === 'function' ? (entry as ProviderFactory)() : entry
}

export function getEnabledProviders(
  env: NodeJS.ProcessEnv = process.env
): CatalogProvider[] {
  const names = getEnabledProviderNames(env)
  const providers: CatalogProvider[] = []
  for (const name of names) {
    const entry = registry.get(name)
    if (!entry) continue
    providers.push(materialize(entry))
  }
  return providers
}

export function getProviderByName(
  name: ProviderName
): CatalogProvider | undefined {
  const entry = registry.get(name)
  return entry ? materialize(entry) : undefined
}


