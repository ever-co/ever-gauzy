import { CanActivate, ExecutionContext, HttpException, PipeTransform, Type } from '@nestjs/common';
import { PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import type { ID } from '@gauzy/contracts';
import { ApiErrorCode, DEFAULT_CODE_BY_STATUS } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import {
	describeDatabaseError,
	isDatabaseErrorPayload,
	safeMessageForDatabaseText
} from '../core/errors/database-error';
import { BulkItemRequest, BulkItemResult, BulkRequest, BulkResult, toBulkItemOutcomes } from './bulk';
import { IBulkItemContext } from './bulk-executor.service';

/**
 * The create-only batch: one request that creates many rows of a resource, each exactly as the
 * resource's single-item create would.
 *
 * The platform's bulk contract (`./bulk.ts`) and its executor are the batch; this module is what a
 * resource whose batch only *creates* adds on top of them, so that the six resources that serve one —
 * tags, tasks, expenses, time logs, organizations and users — state it once:
 *
 * - **the body** is the items and the `atomic` flag, and nothing else the contract offers: a create
 *   addresses no existing row, so a write mode means nothing, and the single-item paths these batches
 *   run have no "validate without writing" form, so a dry run would be answered with the writes it asked
 *   not to make. Both are refused before item 0 rather than accepted and ignored;
 * - **an item is the single-item create's body**, applied through that create's own path on the surface
 *   it arrived on — over REST the single route's own pipes (see {@link singleRouteBody}) and then its
 *   handler, over GraphQL the single-item field itself — so its command or service, its permission and
 *   scoping checks are the single create's, and never a bulk insert: a batch writes the rows and raises the
 *   events the same items would one by one, and refuses an item for the reason it would be refused alone;
 * - **a refusal keeps its reason**: the single-item paths refuse with Nest's `HttpException`s, which
 *   the executor would report as an internal failure without their text. They are restated in the
 *   batch's vocabulary — the status, the code the platform's envelope gives that status, the message —
 *   and a database error is described by its driver code rather than by its own text;
 * - **a batch is never atomic**: the single-item paths write through the repositories they were built
 *   with, so no batch transaction can cover them, and a route that applies items this way declares
 *   `atomic: false` on its `@BulkOperation` — the executor then refuses `atomic: true` before item 0
 *   with `400 BULK_ATOMIC_UNSUPPORTED`. A batch runs in no batch-wide transaction at all: each item is
 *   the single-item create, with exactly that create's own atomicity, and a refused item does not undo
 *   the ones before it.
 */

/**
 * The body a create-only batch route accepts: the items, and the `atomic` flag the platform contract
 * defines — read so that the route can refuse it (`BULK_ATOMIC_UNSUPPORTED`) rather than ignore it.
 */
export interface IBulkCreateRequest<T> extends Pick<BulkRequest<T>, 'items' | 'atomic'> {}

/**
 * What a create-only batch field takes over GraphQL: the route's body plus the retry key.
 *
 * GraphQL has no header that can say which of the mutations in a document a key belongs to, so the key
 * rides beside the input it qualifies, where the platform's idempotency kernel reads it.
 */
export interface IBulkCreateInput<T> {
	/** The items, in caller order; the answer refers to them by position. */
	items: T[];
	/** The platform contract's atomic flag: a create-only batch refuses `true` (`BULK_ATOMIC_UNSUPPORTED`). */
	atomic?: boolean;
	/** The client's retry key for this batch. */
	idempotencyKey?: string;
}

/** One item's outcome, as `BulkCreateItemResult` declares it. */
export interface IBulkCreateItemResult {
	/** The item's position in the request. */
	index: number;
	/** True when the item applied. */
	ok: boolean;
	/** The row the item created, when it applied. */
	id?: ID;
	/** The resource that changed. */
	resource?: string;
	/** Why the item did not apply, with the code the same item would have produced alone. */
	error?: {
		code: string;
		message: string;
		path: string[];
		details?: Record<string, unknown>;
	};
}

/** What a create-only batch field answers. */
export interface IBulkCreatePayload {
	/** One entry per request item, in request order. */
	results: IBulkCreateItemResult[];
	/** How many items applied. */
	succeeded: number;
	/** How many items did not. */
	failed: number;
	/** How many items the request carried. */
	total: number;
}

/** The members of the platform's contract a create-only batch does not declare, with the reason. */
const UNDECLARED_MEMBERS: ReadonlyArray<{ member: string; reason: string }> = [
	{
		member: 'dryRun',
		reason: 'This route writes every item it accepts through the single-item create; it declares no dry run.'
	},
	{
		member: 'mode',
		reason: 'This route only creates rows, so there is no existing row for a write mode to apply to.'
	}
];

/**
 * The batch the executor runs, read off a create-only route's body.
 *
 * A member the route does not declare is refused rather than dropped, before item 0, so nothing is
 * applied: a caller that asked for a dry run must not be answered with writes. The member is read off
 * the body rather than off the declared type, because the route declares no body type and a REST caller
 * reaches it with whatever the request carried. A body that is not an object is handed on as it is, for
 * the executor to refuse in the contract's own words.
 *
 * @param body The request body.
 * @returns The items and the atomic flag, and nothing else.
 * @throws ApiException `400 VALIDATION_FAILED` naming the undeclared member.
 */
export function bulkCreateRequest<T>(body: IBulkCreateRequest<T>): BulkRequest<T> {
	if (!body || typeof body !== 'object') {
		return body as BulkRequest<T>;
	}

	for (const { member, reason } of UNDECLARED_MEMBERS) {
		if ((body as unknown as Record<string, unknown>)[member] !== undefined) {
			throw new ApiException(400, ApiErrorCode.VALIDATION_FAILED, reason, { field: member });
		}
	}

	return { items: body.items, atomic: body.atomic };
}

/** A pipe as a route declares it: an instance, or a class Nest would instantiate. */
type DeclaredPipe = PipeTransform | Type<PipeTransform>;

/** The body pipelines read off routes, by controller and handler. */
const ROUTE_BODIES = new WeakMap<Function, Map<string, (body: unknown) => Promise<unknown>>>();

/**
 * The body pipeline of a single-item route, read off the route itself.
 *
 * Every pipe Nest runs on the route's `@Body()` — the controller's `@UsePipes`, the handler's, then the
 * ones stated on the parameter, in that order — with the body type the handler declares. A batch that
 * runs each item through this function validates, strips and transforms it with the route's own pipe
 * objects, so there is no second copy of the route's options that could drift from the first: changing
 * the route's validation changes the batch's.
 *
 * It is read the first time it is asked for, not when the module loads: a handler's decorators are
 * applied after the class body is evaluated, so the metadata is not there yet at that point.
 *
 * @param controller The controller class.
 * @param handler The single-item route's handler name.
 * @returns Runs one body through the route's pipes and answers what the handler would receive.
 * @throws Error when the route takes no body, or names a pipe class that needs injection — programming
 * mistakes, not request-level failures.
 */
export function singleRouteBody<T>(controller: Type<unknown>, handler: string): (body: unknown) => Promise<T> {
	let routes = ROUTE_BODIES.get(controller);

	if (!routes) {
		routes = new Map();
		ROUTE_BODIES.set(controller, routes);
	}

	const known = routes.get(handler);

	if (known) {
		return known as (body: unknown) => Promise<T>;
	}

	const prototype = controller.prototype as Record<string, Function>;
	const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {}) as Record<
		string,
		{ index: number; data?: string; pipes?: DeclaredPipe[] }
	>;
	const bodyKey = Object.keys(args).find((key) => key.split(':')[0] === String(RouteParamtypes.BODY));

	if (!bodyKey) {
		throw new Error(`${controller.name}.${handler} takes no @Body(), so there is no single-item body to validate.`);
	}

	const { index, data, pipes: parameterPipes = [] } = args[bodyKey];
	const metatype = (Reflect.getMetadata('design:paramtypes', controller.prototype, handler) ?? [])[index];
	const declared: DeclaredPipe[] = [
		...((Reflect.getMetadata(PIPES_METADATA, controller) ?? []) as DeclaredPipe[]),
		...((Reflect.getMetadata(PIPES_METADATA, prototype[handler]) ?? []) as DeclaredPipe[]),
		...parameterPipes
	];
	const pipes = declared.map((pipe) => instantiatePipe(pipe, controller, handler));

	const run = async (body: unknown): Promise<unknown> => {
		let value = body;

		for (const pipe of pipes) {
			value = await pipe.transform(value, { type: 'body', metatype, data });
		}

		return value;
	};

	routes.set(handler, run);

	return run as (body: unknown) => Promise<T>;
}

/**
 * Asks a guard of the single-item route about one item, as though the item were that route's body.
 *
 * Most guards decide about the caller, and the batch route carries those itself. A guard that decides
 * about what the body *names* — the organization-policy guard reads the `organizationId` of the request's
 * body, query and parameters — cannot see an item from the batch's body, so it is asked again per item
 * with a request whose body is the item and with the single-item route's handler and class, which is
 * where it reads the permissions and the policy target it evaluates. Its answer is the single route's:
 * a guard that answers `false` refuses with the 403 Nest answers a refused route with.
 *
 * @param guard The guard instance the module provides.
 * @param controller The single-item route's controller.
 * @param handler The single-item route's handler name.
 * @param body The item, as the single route's body.
 * @throws ApiException `403 PERMISSION_DENIED` when the guard refuses the item.
 */
export async function assertSingleRouteGuard(
	guard: CanActivate,
	controller: Type<unknown>,
	handler: string,
	body: unknown
): Promise<void> {
	const request = { body, query: {}, params: {} };
	const http = { getRequest: () => request, getResponse: () => undefined, getNext: () => undefined };
	const context = {
		getClass: () => controller,
		getHandler: () => (controller.prototype as Record<string, Function>)[handler],
		getArgs: () => [request],
		getArgByIndex: (index: number) => (index === 0 ? request : undefined),
		getType: () => 'http',
		switchToHttp: () => http,
		switchToRpc: () => {
			throw new Error('An item of a batch is read as an HTTP body.');
		},
		switchToWs: () => {
			throw new Error('An item of a batch is read as an HTTP body.');
		}
	} as unknown as ExecutionContext;

	const admitted = await guard.canActivate(context);

	if (admitted !== true) {
		throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Forbidden resource');
	}
}

/**
 * A declared pipe as an instance.
 *
 * Nest instantiates a pipe class through the module's injector; this one can only construct a class that
 * needs nothing injected, and refuses any other rather than constructing it without its dependencies.
 */
function instantiatePipe(pipe: DeclaredPipe, controller: Type<unknown>, handler: string): PipeTransform {
	if (typeof pipe !== 'function') {
		return pipe;
	}

	if (((Reflect.getMetadata('design:paramtypes', pipe) ?? []) as unknown[]).length > 0) {
		throw new Error(
			`${controller.name}.${handler} states the pipe ${pipe.name}, which needs injection; a batch cannot run it as the route does.`
		);
	}

	return new pipe();
}

/**
 * Applies one item of a create-only batch through the single-item create.
 *
 * The item is the single-item body, optionally stating `op: 'create'` — the platform's contract lets
 * an item name its operation, and an item of this batch may only name this one. What the item is
 * handed on as is the body without `op`, and a refusal the create raised is restated in the batch's
 * vocabulary with its reason intact.
 *
 * @param item The item.
 * @param context What the executor resolved for it.
 * @param create Runs the single-item create on the body and answers the row it created.
 * @returns The outcome: the item's position and the row it created.
 * @throws ApiException `400 VALIDATION_INVALID_ENUM` for an item naming another operation; the item's own
 * refusal otherwise.
 */
export async function applyAsSingleCreate<T extends object>(
	item: BulkItemRequest<T>,
	context: IBulkItemContext,
	create: (body: T) => Promise<{ id?: ID } | null | undefined>
): Promise<BulkItemResult> {
	const { op, ...body } = item as T & { op?: unknown };

	if (op !== undefined && op !== 'create') {
		throw new ApiException(
			400,
			ApiErrorCode.VALIDATION_INVALID_ENUM,
			`Item ${context.index} declares the operation "${String(op)}"; this route only creates.`,
			{ field: 'op', allowed: ['create'] }
		);
	}

	try {
		const created = await create(body as T);

		return { index: context.index, id: created?.id };
	} catch (error) {
		throw toBulkItemRefusal(error);
	}
}

/**
 * Restates a single-item refusal in the batch's vocabulary.
 *
 * The executor reports an `ApiException` with its code, message and details and anything else as an
 * internal failure without its text — the right default for an error nobody shaped for a client, and
 * the wrong one for the `BadRequestException` a validation pipe raises or the `ForbiddenException` a
 * role check raises, whose whole point is the reason. So:
 *
 * - an `ApiException` is the item's failure as it stands;
 * - an `HttpException` below 500 becomes one with the same status, the code the platform's envelope
 *   gives that status, and its message — a validation pipe's list of messages is joined, and kept whole
 *   in `details.messages`;
 * - a database error, raw or carried inside an `HttpException`, is described by its driver code and
 *   never by its own text, which names tables, columns and the offending values;
 * - anything else — a 5xx, a plain `Error` — is handed back unchanged, for the executor to report as
 *   the internal failure it is.
 *
 * @param error The caught error.
 * @returns The error the executor reports.
 */
export function toBulkItemRefusal(error: unknown): unknown {
	if (error instanceof ApiException) {
		return error;
	}

	if (!(error instanceof HttpException)) {
		return isDatabaseErrorPayload(error)
			? new ApiException(500, ApiErrorCode.INTERNAL_ERROR, describeDatabaseError(error))
			: error;
	}

	const status = error.getStatus();
	const response = error.getResponse() as unknown;
	const body = response && typeof response === 'object' ? (response as Record<string, unknown>) : undefined;
	const driver = [response, body?.message, body?.error].find((candidate) => isDatabaseErrorPayload(candidate));

	if (driver) {
		return new ApiException(status, ApiErrorCode.INTERNAL_ERROR, describeDatabaseError(driver));
	}

	if (status >= 500) {
		return error;
	}

	const stated = typeof response === 'string' ? response : body?.message;
	const messages = (Array.isArray(stated) ? stated : [stated])
		.filter((message): message is string => typeof message === 'string' && message.length > 0)
		.map((message) => safeMessageForDatabaseText(message) ?? message);
	const message =
		messages.length > 0 ? messages.join('; ') : (safeMessageForDatabaseText(error.message) ?? error.message);

	return new ApiException(
		status,
		DEFAULT_CODE_BY_STATUS[status] ?? ApiErrorCode.INTERNAL_ERROR,
		message,
		Array.isArray(stated) ? { messages } : undefined
	);
}

/**
 * The GraphQL payload of a create-only batch.
 *
 * The per-item view is the platform's own projection of the batch result, so the counters and the item
 * codes are the numbers the REST body carries; the path each failure belongs to is stated here because
 * only the payload knows where its items came from.
 *
 * @param result What the executor answered.
 * @returns The payload.
 */
export function toBulkCreatePayload<T>(result: BulkResult<T>): IBulkCreatePayload {
	return {
		results: toBulkItemOutcomes(result).map((outcome) => ({
			index: outcome.index,
			ok: outcome.ok,
			id: outcome.id,
			resource: outcome.resource,
			error: outcome.error ? { ...outcome.error, path: ['items', String(outcome.index)] } : undefined
		})),
		succeeded: result.succeededCount,
		failed: result.failedCount,
		total: result.total
	};
}
