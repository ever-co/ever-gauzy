import { CallHandler, ExecutionContext, HttpStatus, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, from, lastValueFrom } from 'rxjs';
import type { ID, JsonData } from '@gauzy/contracts';
import { executionRequest, executionResponse, readRequestHeader, setResponseHeader } from '../core/context/execution-context.util';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IdempotencyService } from './idempotency.service';
import {
	IDEMPOTENT_METADATA_KEY,
	IDEMPOTENCY_KEY_HEADER,
	IDEMPOTENCY_KEY_MEMBER,
	IDEMPOTENCY_ORIGINAL_REQUEST_HEADER,
	IDEMPOTENCY_REPLAYED_HEADER,
	RETRY_AFTER_HEADER,
	buildGraphqlRequestHash,
	buildRequestHash,
	clampRetentionSeconds,
	idempotencyKeyFromResolverArgs,
	normalizeIdempotencyKey,
	planIdempotentRequest,
	serializeResponseForStorage
} from './idempotency.policy';

/**
 * What a route declares about retrying it.
 */
export interface IIdempotentOptions {
	/** Operation namespace, for example `role.create`. Two operations may reuse one client key. */
	scope: string;
	/** Whether the key is mandatory. A route that is not safely repeatable should require one. */
	required?: boolean;
	/** Retention override, in seconds, clamped to the supported window. */
	ttlSeconds?: number;
	/** What the operation creates, recorded on the row for operators. */
	resourceType?: string;
}

/**
 * Makes a retryable write safe to retry.
 *
 * A client that loses the response to a create has no way to know whether the row exists, so it
 * retries — and without this, retrying books the thing twice. The client presents a key; the first
 * request claims it, the response is recorded, and a repeat of the same key is answered from the
 * record instead of running the handler again. One key, one side effect.
 *
 * The interceptor is registered once for the whole application and does nothing unless the handler
 * declares `@Idempotent(...)`: a route that has not adopted the convention reads no header, hashes
 * nothing and behaves exactly as it did before. That is what lets this land without auditing every
 * route in the product, and it is also why both surfaces honour it identically — REST and GraphQL
 * run the same interceptor over the same stored key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
	private readonly logger = new Logger(IdempotencyInterceptor.name);

	constructor(
		private readonly idempotencyService: IdempotencyService,
		private readonly reflector: Reflector
	) {}

	/**
	 * Runs the request under its idempotency key, if it declares one.
	 *
	 * @param context The execution context.
	 * @param next The handler.
	 * @returns The first response for this key, or a refusal explaining why there cannot be one.
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const options = this.reflector.getAllAndOverride<IIdempotentOptions | undefined>(IDEMPOTENT_METADATA_KEY, [
			context.getHandler(),
			context.getClass()
		]);

		if (!options || !options.scope) {
			return next.handle();
		}

		return from(this.handleWithKey(context, next, options));
	}

	/**
	 * The body of {@link intercept}, written as an async method so the claim, the work and the
	 * recording read in the order they happen.
	 *
	 * @param context The execution context.
	 * @param next The handler.
	 * @param options What the route declared.
	 * @returns The response to answer with.
	 */
	private async handleWithKey(
		context: ExecutionContext,
		next: CallHandler,
		options: IIdempotentOptions
	): Promise<any> {
		const request = executionRequest(context);
		const response = executionResponse(context, request);
		const isGraphql = context.getType<'http' | 'graphql' | string>() === 'graphql';
		const method = String(request?.method ?? '').toUpperCase();

		// One HTTP request carries one `Idempotency-Key`, and the transport is what the key is
		// presented in. A GraphQL request carries as many mutations as its document selects, so the
		// key rides beside the input it qualifies and the fingerprint is the operation rather than
		// the request that carried it.
		const header = isGraphql
			? idempotencyKeyFromResolverArgs(context.getArgByIndex?.(1))
			: readRequestHeader(request, IDEMPOTENCY_KEY_HEADER);

		const requestHash = isGraphql
			? buildGraphqlRequestHash({
					operation: graphqlOperationOf(context),
					fieldName: graphqlFieldOf(context),
					args: context.getArgByIndex?.(1)
			  })
			: buildRequestHash({
					method,
					path: String(request?.originalUrl ?? request?.url ?? ''),
					query: request?.query,
					rawBody: request?.rawBody,
					body: request?.body
			  });

		const decision = planIdempotentRequest({ method, key: header, required: options.required, requestHash });

		if (decision.action === 'SKIP') {
			return lastValueFrom(next.handle());
		}

		if (decision.action === 'REQUIRE_KEY') {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED,
				isGraphql
					? `This operation must be retried safely and requires an \`${IDEMPOTENCY_KEY_MEMBER}\` input member.`
					: `This operation must be retried safely and requires an ${IDEMPOTENCY_KEY_HEADER} header.`
			);
		}

		if (decision.action === 'INVALID_KEY') {
			throw new ApiException(
				HttpStatus.BAD_REQUEST,
				ApiErrorCode.VALIDATION_FAILED,
				isGraphql
					? `The \`${IDEMPOTENCY_KEY_MEMBER}\` you stated is not usable.`
					: `The ${IDEMPOTENCY_KEY_HEADER} header is not usable.`,
				{ field: isGraphql ? IDEMPOTENCY_KEY_MEMBER : IDEMPOTENCY_KEY_HEADER, reason: decision.reason }
			);
		}

		const key = normalizeIdempotencyKey(header) as string;
		const ttlSeconds = clampRetentionSeconds(options.ttlSeconds);

		const claim = await this.idempotencyService.claim({
			scope: options.scope,
			key,
			requestHash,
			resourceType: options.resourceType,
			...(ttlSeconds ? { retentionMs: ttlSeconds * 1000 } : {})
		});

		const settled = planIdempotentRequest({ method, key, required: options.required, requestHash, claim });

		switch (settled.action) {
			case 'REPLAY': {
				// The first attempt's answer, returned without touching the handler. The headers tell
				// the client this is the same response it would have received then, not a new one.
				setResponseHeader(response, IDEMPOTENCY_REPLAYED_HEADER, 'true');

				if (settled.replayedAt) {
					setResponseHeader(response, IDEMPOTENCY_ORIGINAL_REQUEST_HEADER, settled.replayedAt);
				}

				if (typeof response?.status === 'function') {
					response.status(settled.status);
				}

				return settled.body ?? undefined;
			}

			case 'IN_FLIGHT': {
				// Another request holds the key. Running this one would duplicate its side effect, so
				// the caller is told to come back rather than being given a guess.
				setResponseHeader(
					response,
					RETRY_AFTER_HEADER,
					String(Math.max(1, Math.ceil(settled.retryAfterMs / 1000)))
				);

				throw new ApiException(
					HttpStatus.CONFLICT,
					ApiErrorCode.IDEMPOTENCY_IN_PROGRESS,
					'A request with this idempotency key is still in progress.',
					{ scope: options.scope, retryAfterMs: settled.retryAfterMs }
				);
			}

			case 'REUSED_KEY':
				throw new ApiException(
					HttpStatus.CONFLICT,
					ApiErrorCode.IDEMPOTENCY_KEY_REUSED,
					'This idempotency key was already used for a different request.',
					{
						scope: options.scope,
						expectedHashPrefix: settled.expectedHashPrefix,
						actualHashPrefix: settled.actualHashPrefix
					}
				);

			default:
				break;
		}

		const responseStatus = resolveResponseStatus(this.reflector, context, method);
		const result = await this.runAndRecord(context, next, claim.record.id, responseStatus, options);

		return result;
	}

	/**
	 * Runs the handler and records its response against the claimed key.
	 *
	 * A failure to record is logged rather than raised: the work has already been done, and failing
	 * the response would invite exactly the retry this whole mechanism exists to make safe.
	 *
	 * @param context The execution context.
	 * @param next The handler.
	 * @param recordId The claimed row id.
	 * @param responseStatus The status the caller will receive.
	 * @param options What the route declared.
	 * @returns The handler's result.
	 */
	private async runAndRecord(
		context: ExecutionContext,
		next: CallHandler,
		recordId: ID,
		responseStatus: number,
		options: IIdempotentOptions
	): Promise<any> {
		let result: any;

		try {
			result = await lastValueFrom(next.handle());
		} catch (error) {
			// The key is settled as failed with the status the caller saw **and the body it saw**, so a
			// retry of a request the server already refused is answered with that refusal rather than with
			// its status alone. The body is the whole reason the key stays claimed: a replayed `428` with
			// no `code` tells a client nothing about what to change, and a client that cannot tell which
			// refusal it met cannot act on it.
			await this.settleQuietly(() =>
				this.idempotencyService.fail(recordId, {
					responseStatus: resolveErrorStatus(error),
					responseBody: storedErrorBody(error)
				})
			);

			throw error;
		}

		const { stored, dropped } = serializeResponseForStorage(result);

		if (dropped) {
			// Over the storage cap. The row keeps the status, so a retry still learns the outcome
			// without the platform keeping a megabyte per call.
			this.logger.warn(
				`The response to ${options.scope} was not stored for replay because it exceeded the storage cap.`
			);
		}

		await this.settleQuietly(() =>
			this.idempotencyService.complete(recordId, {
				responseStatus,
				responseBody: stored,
				resourceType: options.resourceType,
				resourceId: extractResourceId(result)
			})
		);

		return result;
	}

	/**
	 * Runs a settle call, logging instead of raising when it fails.
	 *
	 * @param settle The settle call.
	 */
	private async settleQuietly(settle: () => Promise<unknown>): Promise<void> {
		try {
			await settle();
		} catch (error) {
			this.logger.error(
				`An idempotency key could not be settled: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
}

/**
 * The status the caller will receive for this handler.
 *
 * Read from the route's own metadata rather than from the response object: Nest applies `@HttpCode`
 * after the interceptor chain returns, so at this point the response still carries the transport
 * default and a stored `201` would be replayed as a `200`.
 *
 * @param reflector The reflector.
 * @param context The execution context.
 * @param method The HTTP method.
 * @returns The status to record.
 */
function resolveResponseStatus(reflector: Reflector, context: ExecutionContext, method: string): number {
	const declared = reflector.get<number>(HTTP_CODE_METADATA, context.getHandler());

	if (typeof declared === 'number') {
		return declared;
	}

	if (context.getType<'http' | 'graphql' | string>() === 'graphql') {
		return HttpStatus.OK;
	}

	return method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK;
}

/**
 * The status an error will be answered with.
 *
 * @param error The caught error.
 * @returns The status.
 */
function resolveErrorStatus(error: unknown): number {
	const status = (error as { getStatus?: () => number })?.getStatus?.();

	return typeof status === 'number' ? status : HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * The body a refusal will be answered with, in the form the record stores.
 *
 * `HttpException.getResponse()` is what the exception filter serialises, and it is either a string —
 * the everyday `new NotFoundException('CART_NOT_FOUND: …')` spelling — or the structured body a caller
 * raised with `new ApiException(status, code, message, details)`. Both belong in the record: what a
 * replayed refusal has to carry is the code, because that is what a client switches on.
 *
 * A thrown value that is not an HTTP exception carries no body of its own — the filter builds one for
 * it — so nothing is stored and the replay keeps the status alone, which is exactly what it did before
 * this. The same storage cap applies as for a successful response, so a refusal with a huge body cannot
 * put more in the table than a success can.
 *
 * @param error What the handler threw.
 * @returns The body to record, or undefined when the error carries none.
 */
function storedErrorBody(error: unknown): JsonData | undefined {
	const response = (error as { getResponse?: () => unknown })?.getResponse?.();

	if (response === undefined || response === null) {
		return undefined;
	}

	const envelope: Record<string, unknown> =
		typeof response === 'string' ? { message: response } : { ...(response as Record<string, unknown>) };

	// `code` and `details` are **not** in `getResponse()`: the exception filter adds them when it renders
	// the envelope, so an interceptor that stored only the response would keep a refusal a client cannot
	// branch on — which is the whole reason the row keeps a body at all. Read from the exception itself,
	// where `ApiException` declares them.
	const code = (error as { code?: unknown })?.code;
	const details = (error as { details?: unknown })?.details;

	if (typeof code === 'string') {
		envelope.code = code;
	}

	if (details !== undefined) {
		envelope.details = details;
	}

	const { stored } = serializeResponseForStorage(envelope);

	return stored;
}

/**
 * The id of what an operation created, when its response carries one.
 *
 * @param result The handler's result.
 * @returns The id, or undefined.
 */
function extractResourceId(result: any): ID | undefined {
	const id = result?.id;

	return typeof id === 'string' ? id : undefined;
}

/**
 * The root operation a GraphQL field was selected under.
 *
 * A failed read answers `mutation`, which is the safe default: it is what a key is normally required
 * on, and it keeps the fingerprint of a request whose identity cannot be read apart from a query's.
 *
 * @param context The execution context.
 * @returns The operation, or undefined when it cannot be read.
 */
function graphqlOperationOf(context: ExecutionContext): string | undefined {
	try {
		return GqlExecutionContext.create(context).getInfo?.()?.operation?.operation;
	} catch {
		return undefined;
	}
}

/**
 * The name of the root field being executed.
 *
 * This is what makes two mutations in one deployment's schema different requests. Without it, every
 * mutation without arguments would fingerprint identically and a retry of one would replay another.
 *
 * @param context The execution context.
 * @returns The field name, or undefined when it cannot be read.
 */
function graphqlFieldOf(context: ExecutionContext): string | undefined {
	try {
		return GqlExecutionContext.create(context).getInfo?.()?.fieldName;
	} catch {
		return undefined;
	}
}
