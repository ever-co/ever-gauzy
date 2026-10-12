import { ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { IdempotencyStatus } from '@gauzy/contracts';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY, IDEMPOTENCY_KEY_HEADER } from '../idempotency/idempotency.policy';
// The token the guard asks for, not the service class — importing the class here would pull the
// persistence graph into a suite that stubs everything it needs.
import { IDEMPOTENCY_SERVICE } from '../idempotency/idempotency-constant';
import { VersionGuard } from './version.guard';
import { IF_MATCH_HEADER, VERSION_EXPECTATION_PROPERTY, VERSIONED_METADATA_KEY } from './version.util';
import type { IVersionedOptions } from './versioned.decorator';
import { versionExpectationOf } from './versioned-write';

/**
 * The guard that refuses a stale write before the handler runs.
 *
 * This is the half of the mechanism that answers *before* a service is called, a transaction is
 * opened or a row is touched, so the cases here are the three things it can decide — let the request
 * through, refuse it with a status the caller can act on, or leave the accepted version on the
 * request for the write to consume — and the two transports it decides them for.
 *
 * Both transports are asserted on purpose. A REST client states its version in an `If-Match` header;
 * a GraphQL request is one POST carrying whatever the document selected, so a header could not say
 * which mutation a version belonged to and the version travels beside the input it qualifies. They
 * have to reach the same comparison and answer the same codes, or the same stale write is a 409 on
 * one surface and a silent overwrite on the other.
 *
 * The framework providers are stubbed rather than booted: the guard reads exactly two of them — the
 * metadata a route declared, and the service it names as the reader of its record — and asserting on
 * those two is what makes a case here a statement about the guard rather than about Nest.
 */

/** The controller and the handler the framework would hand the guard. */
class InvoiceController {}

function updateInvoice(): void {
	// The route body is never reached: the guard answers before the handler runs.
}

/** The service a route names as the reader of its record. */
class InvoiceService {}

/** The HTTP surface: one request, one response, and the handler behind them. */
function httpContext(request: any, response: any = {}): ExecutionContext {
	const positions = [request, response, undefined];

	return {
		getType: () => 'http',
		getClass: () => InvoiceController,
		getHandler: () => updateInvoice,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => response,
			getNext: () => undefined
		})
	} as unknown as ExecutionContext;
}

/**
 * The GraphQL surface: the root, the resolver's arguments, the context the platform builds and the
 * field info — the four positions `GqlExecutionContext` reads.
 */
function graphqlContext(args: any, gqlContext: any = {}): ExecutionContext {
	const positions = [{}, args, gqlContext, undefined];

	return {
		getType: () => 'graphql',
		getClass: () => InvoiceController,
		getHandler: () => updateInvoice,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => {
			// A resolver has no HTTP request. Reaching for one is how a guard reads the GraphQL root
			// object by mistake, which is why the request helper branches on the operation type first.
			throw new Error('a GraphQL operation has no HTTP surface');
		}
	} as unknown as ExecutionContext;
}

/**
 * The reader a `@Versioned({ resource })` route names.
 *
 * It answers the row the case is about, or raises: a record that is not there is a
 * `NotFoundException` from the service, and anything else stands for a reader that cannot be reached.
 */
function readerAnswering(row: any) {
	const findOneByIdString = jest.fn(async (_id: unknown) => {
		if (row instanceof Error) {
			throw row;
		}

		return row;
	});

	return { findOneByIdString };
}

/**
 * The guard, with the two framework providers it reads stubbed rather than booted.
 *
 * `Reflector` is the real one with its metadata lookup spied, so the guard's own lookup is asserted
 * against the targets the framework would give it — and a class-level `@Versioned()` is therefore
 * covered as well as a handler-level one. `ModuleRef` is a register of the one service a route names.
 */
function guardFor(options: IVersionedOptions | undefined, reader?: any) {
	const reflector = new Reflector();
	const metadata = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options);
	const moduleRef = { get: () => undefined } as unknown as ModuleRef;
	const get = jest.spyOn(moduleRef, 'get').mockImplementation(() => reader);

	return { guard: new VersionGuard(reflector, moduleRef), metadata, get };
}

/** The refusal a call raises, so a case asserts on a refusal instead of on a resolved promise. */
async function refusalFrom(work: () => unknown): Promise<ApiException> {
	try {
		await work();
	} catch (error) {
		return error as ApiException;
	}

	// Control: a request that was let through fails here rather than leaving an `undefined` for the
	// assertions below to read as a pass.
	throw new Error('expected the request to be refused, and it was allowed through');
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe('a route that never opted in', () => {
	it('lets a write through untouched, because there is nothing declared to enforce', async () => {
		const { guard, metadata, get } = guardFor(undefined);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: {} };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// Control: this is the route that has to behave exactly as it did before the convention existed —
		// no header read, no 428, and no property left behind on a request nobody declared anything about.
		expect(request).not.toHaveProperty(VERSION_EXPECTATION_PROPERTY);
		expect(get).not.toHaveBeenCalled();
		// The metadata is read from the handler *and* the class, which is what lets a controller put
		// `@Versioned()` above all of its routes instead of on each one.
		expect(metadata).toHaveBeenCalledWith(VERSIONED_METADATA_KEY, [updateInvoice, InvoiceController]);
	});
});

describe('an HTTP write', () => {
	it('demands the version the caller read, and names the header it belongs in', async () => {
		const { guard } = guardFor({});
		const refusal = await refusalFrom(() => guard.canActivate(httpContext({ method: 'PUT', headers: {} })));

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.getStatus()).toBe(428);
		expect(refusal.code).toBe(ApiErrorCode.VERSION_REQUIRED);
		// The caller is told where the version goes, which is the difference between a 428 it can act on
		// and one it can only log.
		expect(refusal.details).toEqual({ header: IF_MATCH_HEADER });
	});

	it('refuses a header that is not a version as a validation failure, not as a demand', async () => {
		const { guard } = guardFor({});
		const request: any = { method: 'PUT', headers: { [IF_MATCH_HEADER]: 'three' } };
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(request)));

		expect(refusal.getStatus()).toBe(400);
		expect(refusal.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(refusal.details).toEqual({ field: IF_MATCH_HEADER, reason: 'malformed' });
		// Control: 428 and 400 are different instructions. A guard that answered 428 here would tell a
		// client that sent a version to send one; one that answered 400 to a missing header would tell a
		// client that sent nothing that what it sent is wrong.
		expect(request).not.toHaveProperty(VERSION_EXPECTATION_PROPERTY);
	});

	it('finds the header however the transport cased it', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { 'If-Match': '"4"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// Control: a guard that looked up the lower-cased name only would answer 428 to every request from
		// a client that spelled the header the way the specification writes it.
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [4] });
	});

	it('refuses a write based on a version the record has moved past', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"3"' } };
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(request)));

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		// Both versions travel, which is what lets the caller tell "the row moved on" from "I sent the
		// wrong number" without paying for a second read.
		expect(refusal.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
		// The record was read at the id the route names, and read once.
		expect(reader.findOneByIdString).toHaveBeenCalledWith('invoice-1');
		expect(reader.findOneByIdString).toHaveBeenCalledTimes(1);
		// Control: the refused write never left the guard, so nothing downstream can consume a version for
		// a request that was refused.
		expect(request).not.toHaveProperty(VERSION_EXPECTATION_PROPERTY);
	});

	it('lets a matching write through and leaves the accepted version on the request', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PATCH', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"4"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(request[VERSION_EXPECTATION_PROPERTY]).toEqual({ wildcard: false, versions: [4] });
		// Asserted through the consumer rather than through the field, because the point of the property is
		// that the write reads the version the guard validated instead of parsing the header a second time
		// — where it could be read differently. A rename that broke that contract fails here.
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [4] });
	});

	it('carries the table the route says the version belongs to, and states none when it names none', async () => {
		// A request can reach more than one versioned engine: receiving a return writes the return and
		// posts stock movements. The stock engine reads the version from the request too, so the route
		// has to say which row it is the version of — or the level is predicated on the return's
		// number. The target travels with the version for exactly that reader.
		const targeted: any = { method: 'POST', params: { id: 'adjustment-1' }, headers: { [IF_MATCH_HEADER]: '"7"' } };
		const { guard } = guardFor({ target: 'warehouse_product_variant' });

		expect(await guard.canActivate(httpContext(targeted))).toBe(true);
		expect(versionExpectationOf(targeted)).toEqual({
			wildcard: false,
			versions: [7],
			target: 'warehouse_product_variant'
		});

		// Control: a route that names no target leaves no member at all, rather than one set to
		// `undefined`, so an engine that asks "was this stated for my table?" is told no.
		const own: any = { method: 'POST', params: { id: 'return-1' }, headers: { [IF_MATCH_HEADER]: '"2"' } };
		const { guard: ownGuard } = guardFor({});

		expect(await ownGuard.canActivate(httpContext(own))).toBe(true);
		expect(versionExpectationOf(own)).not.toHaveProperty('target');
	});

	it('checks a version that was stated on a route where it is optional', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService, required: false }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"3"' } };
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(request)));

		// `required: false` means the caller may state no version, not that a version it did state is
		// ignored. Control: a guard that skipped the comparison whenever the route made it optional would
		// turn every conditional write on that route into an unconditional one.
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
	});

	it('lets an optional write through when no version was stated at all', async () => {
		const { guard, get } = guardFor({ required: false });
		const request: any = { method: 'PUT', headers: {} };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// The write is then unpredicated, which is what the route asked for; the version-predicated update
		// is the half that still guards the row.
		expect(request).not.toHaveProperty(VERSION_EXPECTATION_PROPERTY);
		expect(get).not.toHaveBeenCalled();
	});

	it('checks a stated version against a wildcard expectation without naming one', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '*' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// `If-Match: *` states a condition rather than a number: collapsing it to the row's version here
		// would predicate the update on a number the caller never stated, and a row that moved on between
		// this read and the write would then be overwritten with the guard's blessing.
		expect(versionExpectationOf(request)).toEqual({ wildcard: true, versions: [] });
	});
});

describe('a GraphQL operation', () => {
	it('states its version in the input and is refused with the same code a header write is', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const args = { input: { id: 'invoice-1', version: 3 } };
		const refusal = await refusalFrom(() => guard.canActivate(graphqlContext(args)));

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
		// The id came from the resolver's input, which is where a mutation names its record.
		expect(reader.findOneByIdString).toHaveBeenCalledWith('invoice-1');
	});

	it('demands the version in the input member rather than in a header', async () => {
		const { guard } = guardFor({});
		const refusal = await refusalFrom(() => guard.canActivate(graphqlContext({ input: { id: 'invoice-1' } })));

		expect(refusal.getStatus()).toBe(428);
		expect(refusal.code).toBe(ApiErrorCode.VERSION_REQUIRED);
		// A GraphQL request carries one POST with whatever the document selected, so a header could not
		// say which mutation a version qualified for. The refusal has to name the member instead.
		expect(refusal.details).toEqual({ field: 'version' });
		expect(refusal.message).not.toContain(IF_MATCH_HEADER);
	});

	it('reads the version a resolver takes as its own argument', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const args = { id: 'invoice-1', version: 3 };
		const refusal = await refusalFrom(() => guard.canActivate(graphqlContext(args)));

		expect(refusal.getStatus()).toBe(409);
		expect(refusal.details).toEqual({ expectedVersion: 3, actualVersion: 4 });
	});

	it('refuses an unusable version as a validation failure that names the member', async () => {
		const { guard } = guardFor({});
		const refusal = await refusalFrom(() => guard.canActivate(graphqlContext({ input: { version: 'three' } })));

		expect(refusal.getStatus()).toBe(400);
		expect(refusal.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(refusal.details).toEqual({ field: 'version', reason: 'malformed' });
	});

	it('does not read an If-Match header off a GraphQL request', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'POST', headers: { [IF_MATCH_HEADER]: '"4"' } };
		const refusal = await refusalFrom(() =>
			guard.canActivate(graphqlContext({ input: { id: 'invoice-1' } }, { req: request }))
		);

		// Control: the header is present and it is correct for the row, and it is still not an answer — it
		// cannot say which of the document's operations it qualifies. A guard that read it would accept a
		// write whose version was never stated for this mutation.
		expect(refusal.getStatus()).toBe(428);
		expect(refusal.details).toEqual({ field: 'version' });
		// The row was read on the way to that refusal, because the guard reads the record it names before
		// it decides. Pinned as the kernel stands: the read is what a 428 costs here.
		expect(reader.findOneByIdString).toHaveBeenCalledWith('invoice-1');
	});

	it('skips the check on a resolver that declares it reads', async () => {
		const { guard, get } = guardFor({ write: false });

		// A query resolver states `write: false`: it changes nothing, so it is not asked for a version and
		// its record is not read.
		expect(await guard.canActivate(graphqlContext({ input: { id: 'invoice-1' } }))).toBe(true);
		expect(get).not.toHaveBeenCalled();
	});

	it('treats a resolver as a write whatever the HTTP method behind it says', async () => {
		const { guard } = guardFor({});
		const request: any = { method: 'GET', headers: {} };
		const refusal = await refusalFrom(() => guard.canActivate(graphqlContext({ input: {} }, { req: request })));

		// Every GraphQL operation travels over POST — and a persisted query may be fetched with GET — so
		// the method says nothing about whether the resolver writes. Control: a guard that defaulted from
		// the method would let this one through unchecked.
		expect(refusal.getStatus()).toBe(428);
		expect(refusal.details).toEqual({ field: 'version' });
	});
});

describe('the record the request names', () => {
	it('reads nothing when the route names no record', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard, get } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', headers: { [IF_MATCH_HEADER]: '"4"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// Control: with no id there is no row to read, so the comparison is deferred to the conditional
		// update rather than guessed at — the same guarantee, answered one statement later.
		expect(get).not.toHaveBeenCalled();
		expect(reader.findOneByIdString).not.toHaveBeenCalled();
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [4] });
	});

	it('reads the record the body names when the route carries no id', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PATCH', body: { id: 'invoice-9' }, headers: { [IF_MATCH_HEADER]: '"4"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(reader.findOneByIdString).toHaveBeenCalledWith('invoice-9');
	});

	it('lets the route say how to find the record', async () => {
		const reader = readerAnswering({ version: 3 });
		const identify = jest.fn(() => 'invoice-from-header');
		const { guard } = guardFor({ resource: InvoiceService, identify }, reader);
		const request: any = { method: 'PUT', params: { id: 'ignored' }, headers: { [IF_MATCH_HEADER]: '"3"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(identify).toHaveBeenCalled();
		expect(reader.findOneByIdString).toHaveBeenCalledWith('invoice-from-header');
	});

	it('answers a record that is not there as not found, before comparing anything', async () => {
		const reader = readerAnswering(new NotFoundException());
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'DELETE', params: { id: 'invoice-404' }, headers: { [IF_MATCH_HEADER]: '"3"' } };
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(request)));

		expect(refusal.getStatus()).toBe(404);
		expect(refusal.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
		expect(refusal.details).toEqual({ id: 'invoice-404' });
		// Control: a row that is gone is not a version conflict. Answering 409 would send the caller to
		// re-read a record that does not exist, and to reapply a change to nothing.
		expect(refusal.code).not.toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
	});

	it('proceeds when the record could not be read at all, and says so', async () => {
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const reader = readerAnswering(new Error('connection terminated unexpectedly'));
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"3"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// The version-predicated update is the half that cannot be skipped, so an unreachable reader refuses
		// nothing — but the degradation is warned about rather than silent, which is what keeps a broken
		// reader from looking like a healthy guard.
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('conditional update decides'));
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [3] });
	});

	it('carries a wildcard it could not compare, instead of leaving the write to demand a version', async () => {
		// The route names no record, so the row's version is unknown here. `If-Match: *` still states a
		// condition — the row must exist — and the write resolves it against the row. Before this the guard
		// answered SKIP, left nothing on the request, and the handler's `versionExpectationOf` then refused
		// the caller with `428 VERSION_REQUIRED`: "state a version", to a caller that had just stated one.
		const request: any = { method: 'POST', params: { id: 'change-1' }, headers: { [IF_MATCH_HEADER]: '*' } };
		const { guard } = guardFor({ target: 'warehouse_product_variant' });

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(versionExpectationOf(request)).toEqual({
			wildcard: true,
			versions: [],
			target: 'warehouse_product_variant'
		});

		// The same holds when the route names a reader that could not be reached.
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const unread: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '*' } };
		const { guard: unreadable } = guardFor(
			{ resource: InvoiceService },
			readerAnswering(new Error('connection terminated unexpectedly'))
		);

		expect(await unreadable.canActivate(httpContext(unread))).toBe(true);
		expect(versionExpectationOf(unread)).toEqual({ wildcard: true, versions: [] });
	});

	it('carries every version the caller accepted when it could not read the row', async () => {
		// `If-Match: "3", "4"` accepts either revision. Keeping only the first predicated the write on 3,
		// and a row sitting at 4 — a version the caller had explicitly accepted — was refused with `409`.
		// The list travels whole, and the write picks from it against the row.
		const request: any = { method: 'POST', params: { id: 'change-1' }, headers: { [IF_MATCH_HEADER]: '"3", "4"' } };
		const { guard } = guardFor({});

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [3, 4] });
	});

	it('leaves the one version it read, not the caller\'s list, when it could read the row', async () => {
		const reader = readerAnswering({ id: 'invoice-1', version: 4 });
		const { guard } = guardFor({ resource: InvoiceService }, reader);
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"3", "4"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// The list has been answered by this read — the row is at 4 — so the write is handed 4 alone: a
		// number rather than a condition, which it would otherwise have to read the row again to resolve.
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [4] });
	});

	it('proceeds when the service it names has no reader of its own, and says so', async () => {
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const { guard, get } = guardFor({ resource: InvoiceService });
		const request: any = { method: 'PUT', params: { id: 'invoice-1' }, headers: { [IF_MATCH_HEADER]: '"3"' } };

		expect(await guard.canActivate(httpContext(request))).toBe(true);
		// `strict: false`, because a route mounted in another module still has to reach the service it
		// names; a lookup that stayed inside the host module would find nothing and warn forever.
		expect(get).toHaveBeenCalledWith(InvoiceService, { strict: false });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('findOneByIdString'));
		expect(versionExpectationOf(request)).toEqual({ wildcard: false, versions: [3] });
	});

	it('does not read the record on a read', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard, get } = guardFor({ resource: InvoiceService, write: false }, reader);

		expect(await guard.canActivate(httpContext({ method: 'GET' }))).toBe(true);
		// Control: a read changes nothing, so it must not pay for a second query — and an opted-in list
		// route that read its row on every GET would be a cost with no protection behind it.
		expect(get).not.toHaveBeenCalled();
	});
});


/**
 * A route that carries both conventions.
 *
 * Nest runs every guard before every interceptor, so on a route that declares `@Versioned()` *and*
 * `@Idempotent()` this guard decides before the retry-safety kernel does. Left in that order it
 * decided against the one caller the other kernel exists for: a client that lost the response to its
 * write retries the byte-identical request, and the `If-Match` it states is the version from before
 * the write it never saw the answer to. The record has moved on, so the precondition failed and the
 * caller was told to read the record again and reapply a change it had already made.
 *
 * The cases here are the two halves of the resolution: a settled key yields, and everything else
 * still meets the precondition exactly as it did.
 */
describe('a route that carries retry safety as well as a version', () => {
	/** The guard, with a reflector that answers each convention's metadata key on its own. */
	function guardForBoth(
		versioned: IVersionedOptions | undefined,
		idempotent: { scope?: string } | undefined,
		record: any,
		reader?: any
	) {
		const reflector = new Reflector();
		jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) =>
			key === IDEMPOTENT_METADATA_KEY ? (idempotent as any) : (versioned as any)
		);

		const findByKey = jest.fn(async () => {
			if (record instanceof Error) {
				throw record;
			}

			return record;
		});

		const moduleRef = { get: () => undefined } as unknown as ModuleRef;
		const get = jest.spyOn(moduleRef, 'get').mockImplementation((token: any) => {
			if (token === IDEMPOTENCY_SERVICE) {
				return { findByKey } as any;
			}

			return reader;
		});

		return { guard: new VersionGuard(reflector, moduleRef), findByKey, get };
	}

	/** A write whose `If-Match` is the version from before the attempt it lost the answer to. */
	const staleRetry = () => ({
		method: 'PUT',
		params: { id: 'invoice-1' },
		headers: { [IF_MATCH_HEADER]: '"3"', [IDEMPOTENCY_KEY_HEADER]: 'retry-key-12345678' }
	});

	it('answers a settled retry from the record rather than refusing it as a conflict', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard, findByKey } = guardForBoth(
			{ resource: InvoiceService },
			{ scope: 'invoice.update' },
			{ status: IdempotencyStatus.COMPLETED },
			reader
		);
		const request: any = staleRetry();

		// Without this the caller was told `409 ENTITY_VERSION_CONFLICT` for a write it had already
		// made, and re-reading and reapplying — which is what that code instructs — would have applied
		// the change twice.
		expect(await guard.canActivate(httpContext(request))).toBe(true);
		expect(findByKey).toHaveBeenCalledWith('invoice.update', 'retry-key-12345678');
		// Nothing is loosened: the handler does not run for a settled key, so no expectation is left
		// behind for a write that will not happen. The interceptor replays the stored response.
		expect(request).not.toHaveProperty(VERSION_EXPECTATION_PROPERTY);
	});

	it('yields for a key whose first attempt failed, because that answer is stored too', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard } = guardForBoth(
			{ resource: InvoiceService },
			{ scope: 'invoice.update' },
			{ status: IdempotencyStatus.FAILED },
			reader
		);

		expect(await guard.canActivate(httpContext(staleRetry()))).toBe(true);
	});

	it('still refuses a stale write while the first attempt is in progress', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard } = guardForBoth(
			{ resource: InvoiceService },
			{ scope: 'invoice.update' },
			{ status: IdempotencyStatus.IN_PROGRESS },
			reader
		);

		// A record still in progress is a concurrent attempt rather than a repeat of a finished one:
		// the write it races has not landed, so the version it states is still the version to compare.
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(staleRetry())));

		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
	});

	it('still refuses a stale write when the key is new', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard } = guardForBoth({ resource: InvoiceService }, { scope: 'invoice.update' }, null, reader);
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(staleRetry())));

		// Control: the yield is for a retry, not for anyone who sends a key. A first attempt that
		// states a version the record no longer holds is exactly what the precondition is for.
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
	});

	it('does not look for a record when the route declares no retry safety', async () => {
		const reader = readerAnswering({ version: 4 });
		const { guard, findByKey } = guardForBoth({ resource: InvoiceService }, undefined, null, reader);

		await refusalFrom(() => guard.canActivate(httpContext(staleRetry())));

		expect(findByKey).not.toHaveBeenCalled();
	});

	it('applies the precondition as usual when the store cannot be read, and says so', async () => {
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const reader = readerAnswering({ version: 4 });
		const { guard } = guardForBoth(
			{ resource: InvoiceService },
			{ scope: 'invoice.update' },
			new Error('connection terminated unexpectedly'),
			reader
		);

		// A store that cannot be read is not a reason to let a stale write through — the conditional
		// update is the half that cannot be skipped, and this half stays as strict as it was.
		const refusal = await refusalFrom(() => guard.canActivate(httpContext(staleRetry())));

		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('idempotency record'));
	});
});
