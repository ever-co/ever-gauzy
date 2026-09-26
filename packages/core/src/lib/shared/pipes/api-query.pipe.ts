import { ArgumentMetadata, Injectable, Optional, PipeTransform } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { ApiQuery, ApiQueryError, isApiQueryError, validateQueryStringLength } from '../../api/query-ast';
import { toApiQuery } from '../../api/query-parser';
import { ApiException } from '../../core/errors/api-exception';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import {
	ApiLegacyDataAdapter,
	DEPRECATED_FIELD_HEADER,
	DEPRECATED_PARAM_HEADER,
	DEPRECATED_RELATION_HEADER,
	LEGACY_DATA_PARAM,
	recordDeprecationNotice
} from '../../api/legacy-data';
import type { ApiQueryDTO } from '../../core/dto/api-query.dto';
import type { ApiQuerySchema } from '../../api/query-schema';
import { RequestContext } from '../../core/context/request-context';

/**
 * The query protocol's request pipe.
 *
 * It does three things and nothing else: it reads the protocol's parameters off the request, it
 * hands them to the pure pipeline that compiles them into one {@link ApiQuery}, and it publishes
 * the result where the rest of the request can find it. All the grammar — allow-lists, operators,
 * caps, cursors, the legacy alias — lives behind that call, so a route that adopts the protocol
 * adopts the same grammar the GraphQL surface compiles its inputs from and there is no per-route
 * validation to keep in step.
 *
 * Mounting is opt-in and per route:
 *
 * ```ts
 * @ApiResource(orderQuerySchema)
 * @Controller('/orders')
 * export class OrderController {
 * 	@ApiQuery()
 * 	@Get()
 * 	async findAll(@Query() query: ApiQueryDTO) { … }
 * }
 * ```
 *
 * A route that mounts the pipe without a schema is a no-op — the value passes through untouched —
 * which is what makes `@ApiQuery()` safe to place beside `@UseValidationPipe` while a resource's
 * declaration is still being written.
 */

/** How the pipe is configured. A bare schema is accepted as shorthand for `{ schema }`. */
export interface ApiQueryPipeOptions {
	/** The resource's declaration. */
	readonly schema?: ApiQuerySchema;
	/**
	 * The permission a caller needs to ask for soft-deleted rows.
	 *
	 * Unset by default, and deliberately so: the flag is accepted today without a permission on
	 * every route that carries it, and inventing a gate here would change what existing callers may
	 * ask for. A route that wants the gate declares it, and the refusal carries the same
	 * `PERMISSION_DENIED` code the catalogue defines.
	 */
	readonly withDeletedPermission?: PermissionsEnum;
}

/**
 * The property a request carries its compiled query under.
 *
 * The same name the accessors below read, and the same name a controller's `@Req()` sees, so a
 * handler can read the query from whichever of the two it already has.
 */
export const API_QUERY_PROPERTY = 'apiQuery';

/**
 * Publishes a compiled query on a request.
 *
 * @param request The request, when there is one.
 * @param query The compiled query.
 */
export function setApiQuery(request: unknown, query: ApiQuery): void {
	if (request && typeof request === 'object') {
		(request as Record<string, unknown>)[API_QUERY_PROPERTY] = query;
	}
}

/**
 * Reads the compiled query off a request.
 *
 * @param request The request. Defaults to the current one, which is how a service reaches the query
 *   without the controller having to thread it through every call.
 * @returns The compiled query, or `undefined` when the request did not go through the pipe.
 */
export function getApiQuery(request?: unknown): ApiQuery | undefined {
	const target = request ?? RequestContext.currentRequest();
	if (!target || typeof target !== 'object') {
		return undefined;
	}
	return (target as Record<string, unknown>)[API_QUERY_PROPERTY] as ApiQuery | undefined;
}

/**
 * Reads the compiled query off the current request.
 *
 * @returns The compiled query, or `undefined` when there is none.
 */
export function currentApiQuery(): ApiQuery | undefined {
	return getApiQuery(undefined);
}

/**
 * The pipe itself.
 */
@Injectable()
export class ApiQueryPipe implements PipeTransform<ApiQueryDTO | undefined, ApiQuery | ApiQueryDTO | undefined> {
	private readonly schema?: ApiQuerySchema;
	private readonly withDeletedPermission?: PermissionsEnum;

	constructor(@Optional() options?: ApiQuerySchema | ApiQueryPipeOptions) {
		const resolved: ApiQueryPipeOptions =
			options && typeof options === 'object' && 'resource' in options
				? { schema: options as ApiQuerySchema }
				: ((options as ApiQueryPipeOptions | undefined) ?? {});
		this.schema = resolved.schema;
		this.withDeletedPermission = resolved.withDeletedPermission;
	}

	/**
	 * Compiles the protocol's parameters into one query and publishes it.
	 *
	 * @param value The query object, as the route's DTO received it.
	 * @param metadata The argument metadata — unused, kept because the contract requires it.
	 * @returns The compiled query, or the value untouched when no schema was configured.
	 * @throws HttpException carrying the catalogue code for the first violation found.
	 */
	transform(value: ApiQueryDTO | undefined, metadata: ArgumentMetadata): ApiQuery | ApiQueryDTO | undefined {
		void metadata;
		if (!this.schema) {
			return value;
		}

		const request = RequestContext.currentRequest();
		const dto = (value ?? {}) as ApiQueryDTO;

		try {
			validateQueryStringLength(readRawQueryString(request));

			const query =
				dto.data !== undefined && dto.data !== null
					? this.fromLegacy(dto, request)
					: this.fromProtocol(dto);
			this.assertWithDeletedAllowed(query);
			setApiQuery(request, query);
			return query;
		} catch (error) {
			if (isApiQueryError(error)) {
				throw toApiException(error);
			}
			throw error;
		}
	}

	/** Compiles a request written in the protocol's own parameters. */
	private fromProtocol(dto: ApiQueryDTO): ApiQuery {
		return toApiQuery(
			{
				filter: dto.filter,
				sort: dto.sort,
				page: dto.page,
				fields: dto.fields,
				expand: dto.expand,
				q: dto.q,
				withDeleted: dto.withDeleted,
				context: {
					locale: dto.locale,
					currency: dto.currency,
					channelId: dto.channelId,
					regionId: dto.regionId
				}
			},
			this.schema
		);
	}

	/** Translates the legacy single-JSON parameter, and records what it had to leave out. */
	private fromLegacy(dto: ApiQueryDTO, request: unknown): ApiQuery {
		ApiLegacyDataAdapter.assertNoConflict(presentProtocolParameters(dto));

		const adapter = new ApiLegacyDataAdapter({
			schema: this.schema,
			scope: {
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			pageLimit: dto.page?.limit,
			context: {
				locale: dto.locale,
				currency: dto.currency,
				channelId: dto.channelId,
				regionId: dto.regionId
			}
		});
		const result = adapter.toApiQuery(dto.data);

		// The headers are what turn a silent translation into a migration notice: the caller is told
		// that the parameter is deprecated, and told precisely which of its contents were dropped.
		recordDeprecationNotice(request, DEPRECATED_PARAM_HEADER, LEGACY_DATA_PARAM);
		for (const relation of result.droppedRelations) {
			recordDeprecationNotice(request, DEPRECATED_RELATION_HEADER, relation);
		}
		for (const field of result.droppedFields) {
			recordDeprecationNotice(request, DEPRECATED_FIELD_HEADER, field);
		}

		return result.query;
	}

	/** Enforces the soft-delete permission, when the route declared one. */
	private assertWithDeletedAllowed(query: ApiQuery): void {
		if (!query.withDeleted || !this.withDeletedPermission) {
			return;
		}
		let allowed = false;
		try {
			allowed = RequestContext.hasPermission(this.withDeletedPermission);
		} catch {
			// A caller without a resolvable identity is not "allowed by accident": the guard chain
			// answers for the request, and this check is an additional gate the route asked for.
			allowed = false;
		}
		if (!allowed) {
			throw new ApiQueryError('PERMISSION_DENIED', 'Soft-deleted rows require a permission the caller does not have.', {
				permission: this.withDeletedPermission
			});
		}
	}
}

/** The protocol parameters a request actually carried. */
function presentProtocolParameters(dto: ApiQueryDTO): string[] {
	const present: string[] = [];
	if (dto.filter !== undefined && dto.filter !== null) present.push('filter');
	if (dto.sort !== undefined && dto.sort !== null) present.push('sort');
	if (dto.fields !== undefined && dto.fields !== null) present.push('fields');
	if (dto.expand !== undefined && dto.expand !== null) present.push('expand');
	if (dto.q !== undefined && dto.q !== null) present.push('q');
	if (dto.withDeleted !== undefined && dto.withDeleted !== null) present.push('withDeleted');
	if (dto.page?.number !== undefined && dto.page?.number !== null) present.push('page[number]');
	if (dto.page?.after !== undefined && dto.page?.after !== null) present.push('page[after]');
	if (dto.page?.before !== undefined && dto.page?.before !== null) present.push('page[before]');
	return present;
}

/** The query string of a request, without the path. */
function readRawQueryString(request: unknown): string | undefined {
	const url = (request as { originalUrl?: unknown; url?: unknown } | null | undefined)?.originalUrl ??
		(request as { url?: unknown } | null | undefined)?.url;
	if (typeof url !== 'string') {
		return undefined;
	}
	const index = url.indexOf('?');
	return index >= 0 ? url.slice(index + 1) : undefined;
}

/**
 * Turns a protocol violation into the exception the platform's error contract answers with.
 *
 * The grammar raises a plain `Error` because it must run without a framework; this is the one place
 * that becomes an HTTP error, and it becomes the platform's own `ApiException` rather than a
 * hand-built body. That is what puts the query protocol's codes on the same footing as every other
 * code in the catalogue: the same filter renders them, the same envelope carries them, and the
 * GraphQL surface can map them without knowing anything about queries.
 *
 * The status comes from the code, never from the call site, so one violation cannot answer 400 on
 * one route and 422 on another.
 *
 * @param error The violation.
 * @returns The exception to throw.
 */
export function toApiException(error: ApiQueryError): ApiException {
	const details = error.details && Object.keys(error.details).length > 0 ? { ...error.details } : undefined;
	return new ApiException(error.status, error.code as ApiErrorCode, error.wireMessage, details);
}
