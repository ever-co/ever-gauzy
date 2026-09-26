/**
 * The two kernel conventions the order routes adopt, asserted against the real kernel.
 *
 * The decorators only declare what an operation is; the behaviour belongs to the retry-safe request
 * interceptor and to the concurrency guard and version interceptor, which are registered once for the
 * whole application. Doubling them here would assert that this package's own copy of the rules works,
 * so they are taken as they are and driven over the real route handlers, with the store the key is
 * claimed in and the service the version is read from doubled — those are the two seams that reach a
 * database.
 *
 * `@gauzy/core`'s barrel boots the whole application graph, so it is doubled at the module boundary
 * exactly as the neighbouring suites do. The kernel classes themselves are required from their own
 * modules, where the module boundary does not apply.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

/**
 * The retry-safe store's own class is doubled where the kernel's interceptor names it.
 *
 * The interceptor is the real one — the behaviour under test is its — and it declares the store as a
 * constructor parameter, which makes the module load the store's file. That file reaches the ORM and
 * the whole entity graph, none of which a route's declaration needs, so the one seam is closed here
 * and the store is supplied by the suite instead.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({ IdempotencyService: class {} }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	class TenantAwareCrudService extends CrudService {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		// `@UsePipes(new AbstractValidationPipe(...))` on the inherited mutating routes is
		// evaluated when the controller class is defined, and Nest requires a pipe to expose
		// `transform`, so the double has to as well.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		MikroOrmBaseEntityRepository: class {},
		CrudService,
		TenantAwareCrudService,
		CrudController: class {
			constructor(protected readonly service: any) {}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		// The two conventions are the ones under test, so the decorators that declare them are the real
		// ones: a route's behaviour is decided by the metadata they write.
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		VersionedColumn: decorator,
		Permissions: decorator,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {}
	};
});

import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { IdempotencyOutcome } from '@gauzy/contracts';
import { OrderController } from './order.controller';

const { IdempotencyInterceptor } = jest.requireActual(
	'@gauzy/core/src/lib/idempotency/idempotency.interceptor'
);
const { IDEMPOTENT_METADATA_KEY, IDEMPOTENCY_REPLAYED_HEADER } = jest.requireActual(
	'@gauzy/core/src/lib/idempotency/idempotency.policy'
);
const { VersionGuard } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.guard');
const { VersionInterceptor } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.interceptor');
const { VERSION_EXPECTATION_PROPERTY } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');
const { versionExpectationOf } = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

/** The http execution context a route handler runs under. */
function httpContext(handler: any, request: any, response?: any): any {
	return {
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
		getHandler: () => handler,
		getClass: () => OrderController,
		getArgByIndex: () => undefined
	};
}

/** A response that records what a route published on it. */
function recordingResponse(): any {
	const headers: Record<string, string> = {};
	let statusCode = 0;
	const response: any = {
		headers,
		get statusCode() {
			return statusCode;
		},
		setHeader: (name: string, value: string) => {
			headers[name] = value;
		},
		status: (code: number) => {
			statusCode = code;

			return response;
		}
	};

	return response;
}

/** A request as Express hands it to a route. */
function request(overrides: Record<string, unknown> = {}): any {
	return {
		method: 'POST',
		originalUrl: '/api/orders/order-1/changes/change-1/confirm',
		params: { id: 'order-1', changeId: 'change-1' },
		query: {},
		headers: {},
		body: {},
		...overrides
	};
}

/**
 * The retry-safe request store, in memory.
 *
 * One key holds one request's identity, the row it claimed and the answer it recorded; a second
 * presentation of the same key is answered from that row, which is what makes a retry a replay rather
 * than a second attempt at the work.
 */
function keyStore() {
	const rows = new Map<string, any>();

	return {
		rows,
		claim: async (input: any) => {
			const key = `${input.scope}:${input.key}`;
			const existing = rows.get(key);

			if (existing) {
				if (existing.requestHash !== input.requestHash) {
					return { outcome: IdempotencyOutcome.REUSED_KEY, record: existing };
				}

				return {
					outcome: IdempotencyOutcome.REPLAYED,
					record: existing,
					response: { status: existing.responseStatus, body: existing.responseBody }
				};
			}

			const row = { id: `key-${rows.size + 1}`, ...input };

			rows.set(key, row);

			return { outcome: IdempotencyOutcome.CLAIMED, record: row };
		},
		complete: async (recordId: string, completion: any) => {
			for (const row of rows.values()) {
				if (row.id === recordId) {
					Object.assign(row, completion);
				}
			}
		},
		fail: async (recordId: string, failure: any) => {
			const row = [...rows.values()].find((candidate) => candidate.id === recordId);

			if (row) {
				row.responseStatus = failure?.responseStatus;
			}
		}
	};
}

/**
 * The order the version is read from.
 *
 * The kernel's guard resolves the service a route names through `ModuleRef`, so the double answers that
 * lookup with the one call it makes: `findOneByIdString`.
 */
function orderReader(version: number | null) {
	return {
		get: () => ({
			findOneByIdString: async (id: string) => (version === null ? null : { id, version })
		})
	} as any;
}

describe('OrderController — retry safety (the idempotency kernel)', () => {
	it('refuses the change confirmation when the caller presents no key', async () => {
		const store = keyStore();
		const interceptor = new IdempotencyInterceptor(store as never, new Reflector());

		// The confirmation is the one route in this package that demands a key: applying a change twice
		// moves the order twice, and a client whose response was lost has no other way to find out.
		await expect(
			lastValueFrom(
				interceptor.intercept(httpContext(OrderController.prototype.confirmChange, request()), {
					handle: () => of({ id: 'change-1' })
				})
			)
		).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED', status: HttpStatus.BAD_REQUEST });

		expect(store.rows.size).toBe(0);
	});

	it('replays the first answer for one key presented with one body, and runs the handler once', async () => {
		const store = keyStore();
		const interceptor = new IdempotencyInterceptor(store as never, new Reflector());
		const handler = OrderController.prototype.confirmChange;
		const presented = request({ headers: { 'idempotency-key': 'retry-key-0001' }, body: { note: 'apply it' } });
		let runs = 0;
		const next = {
			handle: () => {
				runs++;

				return of({ id: 'change-1', version: 4 });
			}
		};

		const first = await lastValueFrom(interceptor.intercept(httpContext(handler, presented), next));
		const replayedResponse = recordingResponse();
		const replayed = await lastValueFrom(
			interceptor.intercept(httpContext(handler, presented, replayedResponse), next)
		);

		expect(runs).toBe(1);
		expect(first).toEqual({ id: 'change-1', version: 4 });
		expect(replayed).toEqual(first);
		expect(replayedResponse.headers[IDEMPOTENCY_REPLAYED_HEADER]).toBe('true');
	});

	it('declares the scope of every route it makes retry-safe, and requires a key only at the confirmation', () => {
		const reflector = new Reflector();
		const declared: Record<string, { scope: string; required?: boolean }> = {
			create: { scope: 'order.create' },
			place: { scope: 'order.place' },
			cancel: { scope: 'order.cancel' },
			createChange: { scope: 'order.change.create' },
			confirmChange: { scope: 'order.change.confirm', required: true }
		};

		for (const [method, expected] of Object.entries(declared)) {
			const options: any = reflector.get(IDEMPOTENT_METADATA_KEY, (OrderController.prototype as any)[method]);

			// The scope is part of the key's identity, so two operations may be called with the same
			// client key and neither may replay the other's response.
			expect({ method, scope: options?.scope, required: options?.required ?? false }).toEqual({
				method,
				scope: expected.scope,
				required: expected.required ?? false
			});
		}

		// A route that has not adopted the convention reads no header and hashes nothing.
		expect(reflector.get(IDEMPOTENT_METADATA_KEY, OrderController.prototype.findById)).toBeUndefined();
	});
});

describe('OrderController — optimistic concurrency (the version kernel)', () => {
	it('refuses a write based on a version the order has already moved past', async () => {
		const guard = new VersionGuard(new Reflector(), orderReader(7));
		const presented = request({
			originalUrl: '/api/orders/order-1/place',
			headers: { 'if-match': '"3"' },
			body: {}
		});

		await expect(
			guard.canActivate(httpContext(OrderController.prototype.place, presented))
		).rejects.toMatchObject({ code: 'ENTITY_VERSION_CONFLICT', status: HttpStatus.CONFLICT });
	});

	it('refuses a write that states no version at all', async () => {
		const guard = new VersionGuard(new Reflector(), orderReader(7));

		await expect(
			guard.canActivate(httpContext(OrderController.prototype.place, request()))
		).rejects.toMatchObject({ code: 'VERSION_REQUIRED', status: HttpStatus.PRECONDITION_REQUIRED });
	});

	it('accepts the version the caller read and leaves it on the request for the write', async () => {
		const guard = new VersionGuard(new Reflector(), orderReader(7));
		const presented = request({ originalUrl: '/api/orders/order-1/place', headers: { 'if-match': '"7"' } });

		expect(await guard.canActivate(httpContext(OrderController.prototype.place, presented))).toBe(true);
		// The value the guard validated is the value the conditional update is predicated on: the route
		// reads it back rather than parsing the header a second time, and cannot parse it differently.
		expect(presented[VERSION_EXPECTATION_PROPERTY]).toEqual({ wildcard: false, versions: [7] });
		expect(versionExpectationOf(presented)).toEqual({ wildcard: false, versions: [7] });
	});

	it('asks a read for no version, so a caller that states none is still served', async () => {
		const guard = new VersionGuard(new Reflector(), orderReader(7));

		expect(await guard.canActivate(httpContext(OrderController.prototype.findById, request()))).toBe(true);
	});

	it('publishes the version of what it writes as an ETag', async () => {
		const interceptor = new VersionInterceptor(new Reflector());
		const response = recordingResponse();

		const result = await lastValueFrom(
			interceptor.intercept(httpContext(OrderController.prototype.place, request(), response), {
				handle: () => of({ id: 'order-1', version: 8 })
			})
		);

		// The header is what the next write states back; without it a caller could not condition one.
		expect(response.headers['ETag']).toBe('"8"');
		expect(result).toEqual({ id: 'order-1', version: 8 });
	});
});
