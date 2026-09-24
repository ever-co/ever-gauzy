import { ExecutionContext, Injectable, Logger, NotFoundException, CanActivate } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { IdempotencyStatus, type ID } from '@gauzy/contracts';
import { executionRequest, readRequestHeader } from '../core/context/execution-context.util';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	IDEMPOTENT_METADATA_KEY,
	IDEMPOTENCY_KEY_HEADER,
	idempotencyKeyFromResolverArgs,
	normalizeIdempotencyKey
} from '../idempotency/idempotency.policy';
// The token, not the class. `IdempotencyService` reaches the persistence graph, and a guard that
// imported it would pull that graph into every module — and every test module — that loads a route
// carrying `@Versioned()`. `idempotency-constant.ts` imports nothing, and the type below is erased.
import { IDEMPOTENCY_SERVICE } from '../idempotency/idempotency-constant';
import type { IdempotencyService } from '../idempotency/idempotency.service';
import {
	IF_MATCH_HEADER,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY,
	isReadOnlyMethod,
	parseEntityVersion,
	evaluateVersionPrecondition,
	versionFromResolverArgs
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
 *
 * ## Why retry safety is answered before the version is
 *
 * A route may carry both conventions, and on that route the two kernels disagree about what a
 * *retry* is. Nest runs every guard before every interceptor, so without the check below this guard
 * decided first — and it decided against exactly the caller the other kernel exists for. A client
 * that lost the response to its first attempt retries the byte-identical request: the same
 * `Idempotency-Key`, and the same `If-Match` it read before the write it never saw the answer to.
 * The record has moved on, so the version precondition failed and the caller was told `409
 * ENTITY_VERSION_CONFLICT` for a write it had already made. Re-reading and reapplying — which is
 * what that code instructs — would then have applied the change twice, which is the one thing the
 * key was presented to prevent.
 *
 * So a request whose key already has a settled record yields: the version is not compared, and the
 * idempotency interceptor answers from the record instead. Nothing is loosened by that, because a
 * settled record means the handler does not run at all — the interceptor either replays the stored
 * response or refuses the key as reused. The precondition is skipped only where there is no write
 * left for it to guard.
 */
@Injectable()
export class VersionGuard implements CanActivate {
	private readonly logger = new Logger(VersionGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * The retry-safety store, resolved lazily.
	 *
	 * `@Versioned()` mounts this guard from framework providers only, so it cannot declare a
	 * constructor dependency on a service whose module the route's own module may not import. The
	 * lookup is non-strict for the same reason `readRow` is, and a missing service is not a refusal:
	 * an installation that does not run the idempotency kernel simply has no record to yield to.
	 *
	 * @returns The service, or undefined when the kernel is not installed.
	 */
	private idempotency(): IdempotencyService | undefined {
		if (this.idempotencyService === undefined) {
			try {
				this.idempotencyService = this.moduleRef.get<IdempotencyService>(IDEMPOTENCY_SERVICE, {
					strict: false
				}) ?? null;
			} catch {
				this.idempotencyService = null;
			}
		}

		return this.idempotencyService ?? undefined;
	}

	/** Resolved once per process: `null` once a lookup has failed, so it is not retried per request. */
	private idempotencyService: IdempotencyService | null | undefined;

	/**
	 * Whether this request is a retry the other kernel has already answered.
	 *
	 * Only a *settled* record counts. A record still in progress is a concurrent attempt rather than a
	 * repeat of a finished one, and the write it is racing has not landed yet — the version it states
	 * is still the version it should be compared against, so that request is left to the ordinary
	 * precondition and the interceptor tells it to come back.
	 *
	 * @param context The execution context.
	 * @param request The request.
	 * @param isGraphql Whether the operation arrived over GraphQL.
	 * @returns True when the handler will not run, so there is no write for the version to guard.
	 */
	private async isSettledRetry(context: ExecutionContext, request: any, isGraphql: boolean): Promise<boolean> {
		const idempotent = this.reflector.getAllAndOverride<{ scope?: string } | undefined>(
			IDEMPOTENT_METADATA_KEY,
			[context.getHandler(), context.getClass()]
		);

		if (!idempotent?.scope) {
			return false;
		}

		const key = normalizeIdempotencyKey(
			isGraphql
				? idempotencyKeyFromResolverArgs(context.getArgByIndex?.(1))
				: readRequestHeader(request, IDEMPOTENCY_KEY_HEADER)
		);

		if (!key) {
			return false;
		}

		try {
			const record = await this.idempotency()?.findByKey(idempotent.scope, key);

			return record?.status === IdempotencyStatus.COMPLETED || record?.status === IdempotencyStatus.FAILED;
		} catch (error) {
			// A store that cannot be read is not a reason to refuse a write. The precondition still
			// applies, and the conditional update is the half that cannot be skipped.
			this.logger.warn(
				`The idempotency record for ${idempotent.scope} could not be read; the version precondition is applied as usual. ${
					(error as Error)?.message ?? error
				}`
			);

			return false;
		}
	}

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

		// Retry safety is answered first — see the class comment. The handler does not run for a
		// settled key, so there is no write left for the precondition to guard.
		if (await this.isSettledRetry(context, request, isGraphql)) {
			return true;
		}

		const method = String(request?.method ?? '').toUpperCase();
		// A GraphQL operation travels over POST whichever root type it selects, so the method says
		// nothing about whether it writes: the resolver's own declaration is the only honest source.
		const write = options.write ?? (isGraphql ? true : !isReadOnlyMethod(method));

		const id = this.resolveResourceId(options, context, request);
		const row = options.resource && id ? await this.readRow(options.resource, id) : undefined;

		const decision = evaluateVersionPrecondition({
			// One HTTP request carries one `If-Match`, so REST states the version in a header. A
			// GraphQL request carries as many mutations as its document selects, and a header could
			// not say which of them the version belongs to, so the version rides beside the input it
			// qualifies. Both forms reach the same comparison, and both answer the same codes.
			ifMatch: isGraphql
				? versionFromResolverArgs(context.getArgByIndex?.(1))
				: readRequestHeader(request, IF_MATCH_HEADER),
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
					isGraphql
						? 'This operation changes a record that carries a version; state the version you read as the input member `version`.'
						: `This operation changes a record that carries a version; state the version you read in an ${IF_MATCH_HEADER} header.`,
					isGraphql ? { field: 'version' } : { header: IF_MATCH_HEADER }
				);

			case 'INVALID':
				throw new ApiException(
					400,
					ApiErrorCode.VALIDATION_FAILED,
					isGraphql
						? 'The `version` you stated is not a version.'
						: `The ${IF_MATCH_HEADER} header is not a version.`,
					isGraphql ? { field: 'version', reason: decision.reason } : { field: IF_MATCH_HEADER, reason: decision.reason }
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
				// The route's `target` travels with it, so an engine that reads the version from the
				// request can tell a version stated for its own row from one stated for the record the
				// route writes.
				if (request) {
					request[VERSION_EXPECTATION_PROPERTY] = {
						wildcard: decision.wildcard,
						versions: decision.wildcard ? [] : [decision.expected],
						...(options.target ? { target: options.target } : {})
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
