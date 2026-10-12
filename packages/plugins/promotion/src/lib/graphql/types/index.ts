/**
 * The GraphQL contribution's TypeScript surface.
 *
 * The interfaces and the two shape adapters the resolvers are written against live in one module, so
 * a resolver imports what it needs from here rather than reaching into the schema literal's own file.
 */
export * from './promotion.graphql.types';
