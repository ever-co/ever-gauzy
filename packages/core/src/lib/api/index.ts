/**
 * The API layer's barrel.
 *
 * Everything a resource needs in order to speak the platform's conventions rather than invent its
 * own: the query protocol, field-level visibility, bulk application, and the accepted-operation
 * handle.
 *
 * The query protocol is split three ways, and the split is the point: the vocabulary (`query-ast`)
 * has no imports at all, the parsers are pure functions over the values a request carried, and only
 * the boundary knows what an HTTP request is. A grammar whose behaviour can only be observed
 * through a request is a grammar nobody can regression-test.
 *
 * One name is deliberately not re-exported from here. `ApiQuery` in this barrel is the compiled
 * query a handler receives, which is the name the protocol fixes for it; the `@ApiQuery()` route
 * decorator of the same name is mounted from `./api-query.decorator`. One barrel cannot carry both
 * — a module may export a type and a value under one name, but two wildcard re-exports may not
 * claim it — and shadowing the interface would break every handler that types its argument.
 */
export * from './query-ast';
export * from './query-schema';
export * from './query-schema.registry';
export * from './query-schemas';
export * from './field-selection';
export * from './filter-parser';
export * from './sort-parser';
export * from './cursor';
export * from './query-parser';
export * from './legacy-data';
export * from './deprecation-headers.interceptor';
export * from './visible-with.decorator';
export * from './visibility-metadata';
export * from './field-visibility.service';
export * from './resource-projection.interceptor';
export * from './bulk';
export * from './bulk-executor.service';
export * from './bulk.decorator';
export * from './async-operation';
export * from './accepted-operation.interceptor';
export * from './accepted.decorator';
/**
 * The storage translation. Exported by name rather than by wildcard because the protocol pipeline
 * it re-exports for callers that look for it there — `toApiQuery`, `parsePage` — is already
 * exported above, and two wildcards claiming one name is an ambiguity rather than a convenience.
 */
export { cursorToFilterNode, toFindManyOptions, toMikroOrmFindOptions, toMikroOrmWhere, toWhereClause } from './query-translator';
export type { ApiFindOptions, ApiMikroOrmFindOptions } from './query-translator';
/** The wire contract of the protocol, which a controller names as the type of its `@Query()`. */
export type { ApiPageDTO, ApiQueryDTO } from '../core/dto/api-query.dto';
