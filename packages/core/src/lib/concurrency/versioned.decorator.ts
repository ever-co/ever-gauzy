import { applyDecorators, SetMetadata, Type, UseGuards, UseInterceptors } from '@nestjs/common';
import { VERSIONED_METADATA_KEY } from './version.util';
import { VersionGuard } from './version.guard';
import { VersionInterceptor } from './version.interceptor';

/**
 * What a route declares about the version it carries.
 */
export interface IVersionedOptions {
	/**
	 * Whether the route changes the record.
	 *
	 * Defaults to the HTTP method — a write unless it is `GET`, `HEAD` or `OPTIONS`. A GraphQL
	 * operation is always a `POST`, so a resolver states this explicitly: a query resolver passes
	 * `false`, a mutation leaves it at the default.
	 */
	write?: boolean;

	/**
	 * Whether a write must state a version. Defaults to true, which is what makes the protection
	 * real; `false` makes the version optional and still checked when it is sent.
	 */
	required?: boolean;

	/**
	 * The service that owns the record, when the route wants the version compared before the
	 * handler runs. Any service with `findOneByIdString` works — every `CrudService` has one, on
	 * both ORMs. Omitted, the comparison happens in the conditional update instead.
	 */
	resource?: Type<any>;

	/**
	 * How to find the record's id. Defaults to the `:id` route parameter, the `id` member of the
	 * body, or the resolver's `id`/`input.id` argument.
	 */
	identify?: (request: any, context?: any) => string | undefined;

	/**
	 * The table whose row the stated version is a version of, when it is not the record the route
	 * itself writes.
	 *
	 * A stock correction, a hold or a put-away is posted against a document — an adjustment, a
	 * reservation, a bin — but the state a caller read and has to be protected against losing is the
	 * **level** row the document moves, so those routes state the level's version. The accepted
	 * version travels on the request, and an engine further down reads it from there rather than
	 * having it passed by hand through every caller in between.
	 *
	 * That is exactly why it has to say which row it is about. One request can reach more than one
	 * versioned engine: receiving a return writes the return under the version its caller read *and*
	 * posts stock movements, and before this the stock engine predicated the level row on the
	 * **return's** version — `409 { expectedVersion: 2, actualVersion: 1 }` for a return at 2 and a
	 * level at 1, on every attempt, so no client could receive a return. An engine that reads the
	 * version from the request therefore honours it only when the route named that engine's table
	 * here, and a route that states nothing keeps its version for its own record.
	 */
	target?: string;
}

/**
 * Declares that a route reads and writes a versioned record.
 *
 * One decorator carries the whole convention: the guard that refuses a stale write, the interceptor
 * that publishes the version, and the metadata both read. Both are instantiated from framework
 * providers only, so a controller can adopt this without touching its module.
 *
 * ```ts
 * @Versioned({ resource: InvoiceService })
 * @Put(':id')
 * async update(@Param('id') id: string, @Body() input: UpdateInvoiceDTO) {
 * 	return this.invoiceService.applyVersionedUpdate(id, input, request => versionExpectationOf(request));
 * }
 * ```
 *
 * A route that does not carry the decorator behaves exactly as it did: no header is read, no
 * version is required and no `ETag` is emitted.
 */
export function Versioned(options: IVersionedOptions = {}): MethodDecorator & ClassDecorator {
	return applyDecorators(
		SetMetadata(VERSIONED_METADATA_KEY, options),
		UseGuards(VersionGuard),
		UseInterceptors(VersionInterceptor)
	);
}
