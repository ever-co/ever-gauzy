import { ExecutionContext, Injectable, Logger, NotFoundException, CanActivate } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { ID } from '@gauzy/contracts';
import { executionRequest, readRequestHeader } from '../core/context/execution-context.util';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	IF_MATCH_HEADER,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY,
	isReadOnlyMethod,
	parseEntityVersion,
	evaluateVersionPrecondition
} from './version.util';
import type { IVersionedOptions } from './versioned.decorator';

/**
 * Refuses a write that was based on a version the record no longer holds.
 *
 * A caller reads a record at version 3, someone else writes it to version 4, and the first caller
 * saves what it read: without this, the second write wins and the change made in between is gone
 * with nobody told. The caller instead states the version it saw, and a version that has moved on
 * is answered with a conflict — the caller re-reads and decides again, which is the only correct
 * outcome once the value it reasoned about no longer exists.
 *
 * Two halves, and both matter. This guard is the half that answers before the handler runs, so a
 * refused write does not reach a service, open a transaction or touch a row. The other half is
 * `commitVersionedUpdate`, which predicates the UPDATE itself on the same version — because the
 * guard's read and the handler's write are two statements and only the second one is atomic.
 *
 * The guard reads the record only when the route names a `resource`. Without one it validates the
 * header and leaves the comparison to the write, which is the same guarantee with a slightly later
 * answer.
 */
@Injectable()
export class VersionGuard implements CanActivate {
	private readonly logger = new Logger(VersionGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * Decides whether the request may reach its handler.
	 *
	 * @param context The execution context.
	 * @returns True when the request carries the version it needs, or states none and needs none.
	 * @throws ApiException when the version is missing, unusable or stale.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const options = this.reflector.getAllAndOverride<IVersionedOptions | undefined>(VERSIONED_METADATA_KEY, [
			context.getHandler(),
			context.getClass()
		]);

		if (options === undefined) {
			// Mounted by hand rather than through `@Versioned()`. With nothing declared there is
			// nothing to enforce, and refusing the request would break a route that never opted in.
			return true;
		}

		const request = executionRequest(context);
		const isGraphql = context.getType<'http' | 'graphql' | string>() === 'graphql';
		const method = String(request?.method ?? '').toUpperCase();
		// A GraphQL operation travels over POST whichever root type it selects, so the method says
		// nothing about whether it writes: the resolver's own declaration is the only honest source.
		const write = options.write ?? (isGraphql ? true : !isReadOnlyMethod(method));

		const id = this.resolveResourceId(options, context, request);
		const row = options.resource && id ? await this.readRow(options.resource, id) : undefined;

		const decision = evaluateVersionPrecondition({
			ifMatch: readRequestHeader(request, IF_MATCH_HEADER),
			write,
			required: options.required,
			...(row ? { exists: row.exists, currentVersion: row.version } : {})
		});

		switch (decision.action) {
			case 'SKIP':
				return true;

			case 'REQUIRE':
				throw new ApiException(
					428,
					ApiErrorCode.VERSION_REQUIRED,
					`This operation changes a record that carries a version; state the version you read in an ${IF_MATCH_HEADER} header.`,
					{ header: IF_MATCH_HEADER }
				);

			case 'INVALID':
				throw new ApiException(
					400,
					ApiErrorCode.VALIDATION_FAILED,
					`The ${IF_MATCH_HEADER} header is not a version.`,
					{ field: IF_MATCH_HEADER, reason: decision.reason }
				);

			case 'NOT_FOUND':
				throw new ApiException(404, ApiErrorCode.RESOURCE_NOT_FOUND, 'The requested record was not found.', {
					id
				});

			case 'CONFLICT':
				throw new ApiException(
					409,
					ApiErrorCode.ENTITY_VERSION_CONFLICT,
					'The record changed since you read it. Read it again and reapply your change.',
					{ expectedVersion: decision.expectedVersion, actualVersion: decision.actualVersion }
				);

			case 'PROCEED':
			default:
				// The accepted version travels on the request so the write does not have to parse the
				// header a second time — and cannot parse it differently.
				if (request) {
					request[VERSION_EXPECTATION_PROPERTY] = {
						wildcard: decision.wildcard,
						versions: decision.wildcard ? [] : [decision.expected]
					};
				}

				return true;
		}
	}

	/**
	 * The id of the record the request acts on.
	 *
	 * @param options What the route declared.
	 * @param context The execution context.
	 * @param request The request.
	 * @returns The id, or undefined when the request does not name one.
	 */
	private resolveResourceId(
		options: IVersionedOptions,
		context: ExecutionContext,
		request: any
	): ID | undefined {
		if (options.identify) {
			return options.identify(request, context);
		}

		const fromRoute = request?.params?.id;

		if (typeof fromRoute === 'string' && fromRoute) {
			return fromRoute;
		}

		const fromBody = request?.body?.id;

		if (typeof fromBody === 'string' && fromBody) {
			return fromBody;
		}

		// A GraphQL resolver receives its arguments as the second positional argument.
		const args = context.getArgByIndex?.(1);
		const fromArgs = args?.id ?? args?.input?.id;

		return typeof fromArgs === 'string' && fromArgs ? fromArgs : undefined;
	}

	/**
	 * Reads the version the record holds.
	 *
	 * A failure to read is not a refusal: the version-predicated update is the half that cannot be
	 * skipped, so a route whose reader is unreachable still refuses a stale write — one statement
	 * later. The warning is what keeps that degradation visible instead of silent.
	 *
	 * @param resource The service that owns the record.
	 * @param id The record id.
	 * @returns What is known about the row.
	 */
	private async readRow(resource: Function, id: ID): Promise<{ exists: boolean; version: number | null }> {
		try {
			const service = this.moduleRef.get<any>(resource as any, { strict: false });

			if (!service || typeof service.findOneByIdString !== 'function') {
				this.logger.warn(
					`@Versioned() names ${resource?.name ?? 'a provider'} as the reader of ${id}, but it has no findOneByIdString. The version is compared by the conditional update instead.`
				);

				return { exists: true, version: null };
			}

			const record = await service.findOneByIdString(id);

			return { exists: !!record, version: parseEntityVersion(record?.['version']) };
		} catch (error) {
			if (error instanceof NotFoundException) {
				return { exists: false, version: null };
			}

			this.logger.warn(
				`The current version of ${id} could not be read (${error instanceof Error ? error.message : String(error)}); the conditional update decides.`
			);

			return { exists: true, version: null };
		}
	}
}
