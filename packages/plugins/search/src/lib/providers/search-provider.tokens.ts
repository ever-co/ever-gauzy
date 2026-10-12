/**
 * The token an external search provider is registered under.
 *
 * The built-in database provider is constructed by the registry itself and is therefore always
 * present; nothing has to be configured for search to work. An engine is the optional half of the
 * pair, and this token is the whole seam: a package that ships one provides its implementation
 * against this token, and a deployment that has none simply never binds it.
 *
 * The binding is optional on purpose. A required dependency here would make an installation without
 * an engine fail at boot, which would turn an accelerator into a requirement — the opposite of what
 * the built-in provider exists for. `SearchProviderRegistry` injects it with `@Optional()`, so the
 * two deployments differ by one provider and by nothing else: the same registry, the same contract,
 * the same query path and the same result shape.
 *
 * A single provider or an array of them may be bound. One engine is the common case and should not
 * have to be wrapped in an array to be registered; several are legitimate when a tenant keeps an old
 * index beside a new one under distinct keys.
 */
export const SEARCH_PROVIDERS = Symbol('SEARCH_PROVIDERS');
