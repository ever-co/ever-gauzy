/**
 * Public API Surface of @gauzy/plugin-search
 *
 * The package exports the plugin class the host registers, the module that wires it, the catalogues it
 * contributes to the platform, its migration, its GraphQL document and resolvers, and every service,
 * definition and provider the surfaces run through.
 *
 * It exports **no entities**, and the omission is deliberate: the two tables this package searches over
 * are core tables with core entities, declared and migrated by the kernel. A package that re-declared
 * them would give one table two owners, and the owner would be whichever package loaded last.
 */
export * from './lib/search.plugin';
export * from './lib/search.module';
export * from './lib/search.types';
export * from './lib/search.permissions';
export * from './lib/search.features';
export * from './lib/search.settings';
export * from './lib/search.controller';
export * from './lib/search-index.consumer';

export * from './lib/database/migrations/1791000000400-SeedSearchIndexDefinitions';

export * from './lib/dto';

export * from './lib/graphql/schema-extensions';
export * from './lib/graphql/resolvers';
export * from './lib/graphql/wire';

export * from './lib/providers';

export * from './lib/registry';

export * from './lib/services';

export * from './lib/definitions';
