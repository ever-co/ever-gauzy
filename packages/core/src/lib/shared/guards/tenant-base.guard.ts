import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { isJSON } from 'class-validator';
import { RequestMethodEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';

// Per-request trace lines: printed at debug level, i.e. only when LOG_LEVEL is debug/verbose (or unset).
const logger = new Logger('TenantBaseGuard');

@Injectable()
export class TenantBaseGuard implements CanActivate {
	/**
	 * Authorises a request against the tenant the caller authenticated as.
	 *
	 * A REST request states its tenant in a header, a query parameter or the payload, and the guard
	 * compares that statement with the authenticated tenant. A GraphQL operation states nothing of
	 * the kind — it carries no query string and its payload is shaped by the operation — and asking
	 * the execution context for an HTTP request throws, so the two are handled separately.
	 *
	 * @param context
	 * @returns
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const currentTenantId = RequestContext.currentTenantId();

		if (context.getType<string>() === 'graphql') {
			return this.canActivateGraphqlOperation(context, currentTenantId);
		}

		logger.debug('TenantBaseGuard canActivate called');

		const request: any = context.switchToHttp().getRequest();
		const method: RequestMethodEnum = request.method;
		const { query, headers, rawHeaders } = request;

		let isAuthorized = false;

		if (!currentTenantId) {
			console.log('Guard TenantBase: Unauthorized access blocked. TenantId:', currentTenantId);
			return isAuthorized;
		}

		// Get tenant-id from request headers. Node lower-cases every incoming header name, so this holds the header
		// whatever casing the client sent it in.
		const headerTenantId = headers['tenant-id'];

		if (this.statesAnotherTenant(request, currentTenantId)) {
			// Whichever path the request takes below, nothing in it may name another tenant: not the header (in any
			// casing), not the query string, not a `:tenantId` route parameter, not the body. Only the header path
			// used to look past its one field; without the header a request was judged by a single field and let
			// through whatever the others said, and a header spelled e.g. `TENANT-ID` was not read at all.
			isAuthorized = false;
		} else if (headerTenantId && (rawHeaders.includes('tenant-id') || rawHeaders.includes('Tenant-Id'))) {
			// The header names the caller's tenant — and, checked above, nothing else in the request names another
			// one. The header used to be the whole check, and a `PUT` with header A and body {"tenantId": B} reached
			// an update that wrote the payload's tenant as given (SEC-A-03, SEC-D-12).
			//
			// 🛑 Only the two spellings this has always accepted open this path. Every spelling is READ (a header
			// naming another tenant is refused above, however it is cased), but letting `TENANT-ID: <own tenant>`
			// open it would allow a read that names no tenant at all, which is refused today. Refused requests stay
			// refused.
			isAuthorized = currentTenantId === headerTenantId;
		} else {
			//If request to get/delete data using another tenantId then reject request.
			const httpMethods = [RequestMethodEnum.GET, RequestMethodEnum.DELETE];
			if (httpMethods.includes(method)) {
				if ('tenantId' in query) {
					const queryTenantId = query['tenantId'];
					isAuthorized = currentTenantId === queryTenantId;
				} else if (query.hasOwnProperty('data')) {
					const data: any = query.data;
					const isJson = isJSON(data);
					if (isJson) {
						try {
							const parse = JSON.parse(data);
							//Match provided tenantId with logged in tenantId
							if ('findInput' in parse && 'tenantId' in parse['findInput']) {
								const queryTenantId = parse['findInput']['tenantId'];
								isAuthorized = currentTenantId === queryTenantId;
							} else {
								//If tenantId not found in query params
								return false;
							}
						} catch (e) {
							console.log('Json Parser Error:', e);
							return isAuthorized;
						}
					}
				} else {
					// If tenantId not found in query params
					isAuthorized = false;
				}
			}

			// If request to save/update data using another tenantId then reject request.
			const payloadMethods = [RequestMethodEnum.POST, RequestMethodEnum.PUT, RequestMethodEnum.PATCH];

			if (payloadMethods.includes(method)) {
				// A write with no parsed body (Express 5 leaves `req.body` unset), a body that is not an object, or
				// `tenant: null` names no tenant and is refused. Reading those used to throw a `TypeError` here,
				// which reached the caller as a 500 instead of a 403.
				isAuthorized = currentTenantId === this.payloadTenantId(request.body);
			}
		}

		if (!isAuthorized) {
			console.log('Guard TenantBase: Unauthorized access blocked. TenantId:', headerTenantId);
		} else {
			logger.debug(`Guard TenantBase: Access Allowed. TenantId: ${headerTenantId}`);
		}
		return isAuthorized;
	}

	/**
	 * Whether anything in the request names a tenant other than the caller's.
	 *
	 * Only explicit statements count, and the same two members — `tenantId` and `tenant.id` — are read wherever a
	 * tenant can arrive:
	 * - the `tenant-id` header, read under the lower-case name Node gives it whatever casing the client used;
	 * - the query string: top level, `where` (the pagination shape, `?where[tenantId]=…`) and the read shape the
	 *   path without a header checks, `?data={"findInput":{…}}`;
	 * - the route parameters (`:tenantId`);
	 * - the body, and every object of a body array (bulk routes).
	 *
	 * A request that names no tenant states nothing. An empty header, query value or route parameter states
	 * nothing either. A tenant id is a string or a number; anything else stated in a tenant field (an object, an
	 * array, a boolean) counts as naming another tenant, and is never coerced to compare it.
	 *
	 * @param request The HTTP request.
	 * @param currentTenantId The tenant the caller authenticated as.
	 * @returns True when another tenant is named anywhere.
	 */
	private statesAnotherTenant(request: any, currentTenantId: string): boolean {
		const named: unknown[] = [];

		const headerTenantId = request?.headers?.['tenant-id'];
		if (headerTenantId) {
			named.push(headerTenantId);
		}

		const query = request?.query;
		for (const source of [query, query?.['where'], request?.params]) {
			named.push(...this.tenantIdsIn(source, { emptyStatesNothing: true }));
		}

		// The read shape the no-header path checks: `?data={"findInput":{"tenantId":…}}`.
		const data = query?.['data'];
		if (typeof data === 'string' && isJSON(data)) {
			try {
				named.push(...this.tenantIdsIn(JSON.parse(data)?.['findInput']));
			} catch {
				// Not parsable after all: it states no tenant.
			}
		}

		const body = request?.body;
		for (const item of Array.isArray(body) ? body : [body]) {
			named.push(...this.tenantIdsIn(item));
		}

		return named.some((tenantId) => !this.isCallersTenant(tenantId, currentTenantId));
	}

	/**
	 * Whether a stated tenant id is the caller's.
	 *
	 * Only a string or a number can be: anything else is refused as it is, never passed to `String()`. Coercing a
	 * payload value runs whatever the caller put in its place — `{"tenantId":{"toString":null}}` throws
	 * (`Cannot convert object to primitive value`), which reached the caller as a 500 instead of a 403, and an
	 * object whose conversion yields the caller's own id would be read as that id.
	 *
	 * @param tenantId The tenant id as the request states it.
	 * @param currentTenantId The tenant the caller authenticated as.
	 * @returns True only for a string or number equal to the caller's tenant.
	 */
	private isCallersTenant(tenantId: unknown, currentTenantId: string): boolean {
		if (typeof tenantId !== 'string' && typeof tenantId !== 'number') {
			return false;
		}
		return String(tenantId) === String(currentTenantId);
	}

	/**
	 * The tenants an object names: its `tenantId`, and the `id` of its `tenant` object.
	 *
	 * @param source The object to read; anything that is not an object names nothing.
	 * @param options `emptyStatesNothing`: an empty string is not a statement (query strings and route parameters).
	 * @returns The tenant ids named, as given.
	 */
	private tenantIdsIn(source: unknown, options: { emptyStatesNothing?: boolean } = {}): unknown[] {
		if (!source || typeof source !== 'object') {
			return [];
		}

		const isStated = (value: unknown): boolean =>
			value !== undefined && value !== null && !(options.emptyStatesNothing && value === '');

		const record = source as Record<string, any>;
		const named: unknown[] = [];
		if (isStated(record['tenantId'])) {
			named.push(record['tenantId']);
		}
		const tenant = record['tenant'];
		if (tenant && typeof tenant === 'object' && isStated(tenant['id'])) {
			named.push(tenant['id']);
		}
		return named;
	}

	/**
	 * The tenant a write's body names for the path without a header: its `tenantId`, else its `tenant.id`.
	 *
	 * @param body The parsed body, if any.
	 * @returns The tenant id, or `undefined` when the body names none — including when there is no body, the body
	 * is not an object, or `tenant` is null.
	 */
	private payloadTenantId(body: unknown): unknown {
		if (!body || typeof body !== 'object') {
			return undefined;
		}

		const record = body as Record<string, any>;
		if ('tenantId' in record) {
			return record['tenantId'];
		}
		if ('tenant' in record) {
			return record['tenant']?.['id'];
		}
		return undefined;
	}

	/**
	 * Authorises a GraphQL operation.
	 *
	 * The operation is scoped by the tenant the caller authenticated as. A caller that additionally
	 * states a tenant, through the same header the REST surface uses, must state its own; a caller
	 * that states nothing is authorised on the strength of its authentication alone, because the
	 * only tenant it can reach is the one carried by its own token.
	 *
	 * @param context The execution context of the operation.
	 * @param currentTenantId The tenant carried by the caller's credentials.
	 * @returns True when the operation may proceed.
	 */
	private canActivateGraphqlOperation(context: ExecutionContext, currentTenantId?: string): boolean {
		if (!currentTenantId) {
			return false;
		}

		const gqlContext = GqlExecutionContext.create(context).getContext();
		const request = gqlContext?.req ?? gqlContext?.request ?? gqlContext;
		const headerTenantId = request?.headers?.['tenant-id'];

		if (headerTenantId) {
			return currentTenantId === headerTenantId;
		}

		return true;
	}
}
