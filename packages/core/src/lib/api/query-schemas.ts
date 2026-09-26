/**
 * The core resource query schemas.
 *
 * This barrel is the list the query protocol and the GraphQL input generator both read, and it is
 * maintained by hand for one reason: the generator runs as a build step with no Nest container and
 * no plugin registry behind it, so it needs the declarations as a plain module it can import. The
 * convention check in the contract gates fails when a `*.query-schema.ts` file exists and is absent
 * from this list, which is what keeps the hand-maintained part honest.
 *
 * A schema is declared beside the controller it describes and exported as `<resource>QuerySchema`:
 *
 * ```ts
 * // packages/core/src/lib/<resource>/<resource>.query-schema.ts
 * export const roleQuerySchema: ApiQuerySchema = {
 * 	resource: 'role',
 * 	filterable: ['id', 'name', 'tenantId', 'createdAt', 'updatedAt'],
 * 	sortable: ['name', 'createdAt', 'updatedAt'],
 * 	selectable: ['id', 'name', 'tenantId', 'createdAt', 'updatedAt'],
 * 	expandable: [],
 * 	searchable: ['name'],
 * 	defaultSort: ['-createdAt', '-id'],
 * 	kinds: { id: 'ID', name: 'STRING', tenantId: 'ID', createdAt: 'DATE', updatedAt: 'DATE' },
 * 	defaultPageSize: 20,
 * 	maxPageSize: 100
 * };
 * ```
 *
 * and re-exported here:
 *
 * ```ts
 * export * from '../<resource>/<resource>.query-schema';
 * ```
 *
 * The list is empty today. A resource lands in it together with its controller, which is why the
 * generated GraphQL inputs are empty until the first resource declares a schema — the generator
 * has nothing to project yet, and inventing a placeholder declaration here would put a resource in
 * the API surface that no route serves.
 */
export {};
