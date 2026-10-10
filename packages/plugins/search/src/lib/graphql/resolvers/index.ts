import { SearchIndexDefinitionResolver } from './search-index-definition.resolver';
import { SearchResolver } from './search.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controller does, so both surfaces
 * run through one implementation of every rule.
 */
export const resolvers = [SearchResolver, SearchIndexDefinitionResolver];

export { SearchResolver, SearchIndexDefinitionResolver };
