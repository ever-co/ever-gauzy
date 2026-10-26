/**
 * The GraphQL surface of the pricing plugin.
 *
 * `schemaExtensions` is the document the platform extends its schema with; `resolvers` are the
 * classes that answer it. Both are declared together in the plugin metadata, so a schema without its
 * resolvers — or resolvers without their schema — cannot be contributed by accident.
 */
export * from './graphql.types';
export * from './pagination';
export * from './resolvers';
export { schemaExtensions } from './schema-extensions';
