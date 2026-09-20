/**
 * The module boundaries are doubled for the reason the package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel — and its nested `uuid` is ESM-only, so reading one
 * entity under jest fails — and `@gauzy/common` is read by the feature-flag decorator.
 *
 * **The two conventions this suite is about are the platform's own.** `Idempotent`, `Versioned`, the
 * guard that refuses a stale write and the interceptor that publishes the version are pulled from the
 * kernel's own modules, so the declaration a mutation carries and the decision made from it are the
 * platform's. Only the key store is an in-memory double of the kernel service.
 *
 * The surface under test is the real resolver, driven through the same guard-and-interceptor chain the
 * application runs, over a stubbed service. Its subject is the half of the contract REST cannot state:
 * one GraphQL request may carry as many mutations as its document selects, so the retry key and the
 * version ride beside the operation — the key as an `idempotencyKey` input member, the version as the
 * `version` member of the input that updates a return or as the `version` argument of a mutation that
 * only decides a status — and the two protocols answer identically because they declare the same
 * scopes.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException, SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the cases below assert the platform
	// rather than a restatement of it.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, as a class the controller extends: the resolver does not use it. */
	class CrudController {
		constructor(protected readonly crudService: unknown) {}
	}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Versioned: versioned.Versioned,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag: () => () => undefined
	}),
	{ virtual: true }
);

/**
 * The interceptor names `IdempotencyService` as its injected dependency, and a class used in a
 * constructor signature is emitted as a value — so the interceptor cannot be loaded without the
 * service module, whose own import chain is the whole core entity graph.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { VersionGuard } from '@gauzy/core/src/lib/concurrency/version.guard';
import { VersionInterceptor } from '@gauzy/core/src/lib/concurrency/version.interceptor';
import { VERSIONED_METADATA_KEY } from '@gauzy/core/src/lib/concurrency/version.util';
import { OrderReturnController } from '../../order-return/order-return.controller';
import { OrderReturnService } from '../../order-return/order-return.service';
import { OrderReturnStatus } from '../../returns.types';
import { OrderReturnResolver } from './order-return.resolver';

/**
 * The returns domain's GraphQL contract for retry safety and optimistic concurrency.
 *
 * - the mutation that receives goods states the same scope, and the same requirement, as the REST
 *   route it mirrors, so a client that retries gets one answer whichever protocol carried the request;
 * - a mutation without an `idempotencyKey` is refused with `IDEMPOTENCY_KEY_REQUIRED` before the
 *   resolver runs;
 * - the same key with the same input replays the first answer and does not receive twice;
 * - the version the caller read is taken from `input.version` where the mutation has an input and from
 *   the mutation's own `version` argument where it has none, and a version the return has moved past
 *   is refused with `ENTITY_VERSION_CONFLICT` before the resolver runs;
 * - the read declares that it does not write, so a version stated on it is not a precondition it has
 *   to satisfy.
 */

const RETURN = '00000000-0000-4000-8000-0000000000e1';
const LINE = '00000000-0000-4000-8000-0000000000e2';
const RECEIVE_KEY = 'return-receive-0001';

/** The key store, doubled in memory, keyed the way the kernel keys a row. */
function keyStore() {
	const rows = new Map<string, any>();
	let sequence = 0;

	const byId = (id: string) => [...rows.values()].find((row) => row.id === id);

	return {
		rows,
		claim: jest.fn(async (input: any) => {
			const identity = `${input.scope}:${input.key}`;
			const existing = rows.get(identity);

			if (existing) {
				if (existing.requestHash !== input.requestHash) {
					return { outcome: 'REUSED_KEY', record: existing };
				}

				return {
					outcome: 'REPLAYED',
					record: existing,
					response: { status: existing.responseStatus, body: existing.responseBody }
				};
			}

			const record = { id: `key-${++sequence}`, ...input, status: 'IN_PROGRESS' };
			rows.set(identity, record);

			return { outcome: 'CLAIMED', record };
		}),
		complete: jest.fn(async (id: string, completion: any) =>
			Object.assign(byId(id), {
				status: 'COMPLETED',
				responseStatus: completion.responseStatus,
				responseBody: completion.responseBody,
				resourceType: completion.resourceType,
				resourceId: completion.resourceId
			})
		),
		fail: jest.fn(async (id: string, completion: any) =>
			Object.assign(byId(id), { status: 'FAILED', responseStatus: completion.responseStatus })
		)
	};
}

/** A response double, recording what an interceptor wrote onto it. */
function responseDouble() {
	return {
		headers: {} as Record<string, string>,
		statuses: [] as number[],
		setHeader(name: string, value: string) {
			this.headers[name] = value;
		},
		status(code: number) {
			this.statuses.push(code);

			return this;
		}
	};
}

type ResponseDouble = ReturnType<typeof responseDouble>;

/** What the return holds when the operation is sent, which the guard reads the version from. */
const returnRow = (overrides: Record<string, unknown> = {}) => ({
	id: RETURN,
	number: 'RET-000001',
	status: OrderReturnStatus.APPROVED,
	currency: 'USD',
	version: 3,
	...overrides
});

/** The resolver over a stubbed service and one in-memory key store. */
function resource(row: Record<string, unknown> = returnRow()) {
	const service = {
		create: jest.fn(async (entity: any) => ({ ...row, ...entity })),
		receive: jest.fn(async () => ({
			returnId: RETURN,
			status: OrderReturnStatus.RECEIVED,
			version: 4,
			movementIds: ['movement-1'],
			receivedQuantity: '5.000000',
			outstandingQuantity: '0.000000'
		})),
		approve: jest.fn(async () => ({ ...row, status: OrderReturnStatus.APPROVED, version: 4 })),
		findOneDetailed: jest.fn(async () => row),
		findOneByIdString: jest.fn(async (id: string) => {
			if (id !== row.id) {
				throw new NotFoundException('The requested record was not found');
			}

			return row;
		})
	};
	const store = keyStore();
	const reflector = new Reflector();

	return {
		row,
		service,
		store,
		resolver: new OrderReturnResolver(service as never, {} as never, {} as never),
		guard: new VersionGuard(reflector, { get: () => service } as never),
		idempotency: new IdempotencyInterceptor(store as never, reflector),
		versioning: new VersionInterceptor(reflector)
	};
}

type Surface = ReturnType<typeof resource>;

/**
 * Runs one operation through the chain the application runs, with the arguments a root field is
 * executed with: the root value, the arguments, the GraphQL context and the field info.
 *
 * The handler is the resolver's own prototype method, so the declarations under test are read from the
 * mutation rather than restated here, and the method's own arguments are built from the context the
 * guard ran on — which is where the accepted version is left, and therefore what the method reads it
 * from.
 */
async function send(
	surface: Surface,
	handler: string,
	operation: 'mutation' | 'query',
	gqlArgs: Record<string, unknown>,
	argsFor: (context: unknown) => unknown[]
): Promise<{ result: any; response: ResponseDouble }> {
	const response = responseDouble();
	// The request the operation arrived on, which is where the guard leaves the version it accepted.
	const request = {};
	const gqlContext = { req: request, res: response };
	const values = [null, gqlArgs, gqlContext, { operation: { operation }, fieldName: handler }];
	const context = {
		getType: () => 'graphql',
		getClass: () => OrderReturnResolver,
		getHandler: () => (OrderReturnResolver.prototype as any)[handler],
		getArgs: () => values,
		getArgByIndex: (index: number) => values[index],
		switchToHttp: () => {
			throw new Error('a GraphQL operation has no HTTP request of its own');
		}
	} as unknown as ExecutionContext;

	await surface.guard.canActivate(context);

	const result = await lastValueFrom(
		surface.idempotency.intercept(context, {
			handle: () =>
				surface.versioning.intercept(context, {
					handle: () =>
						from(
							(surface.resolver as unknown as Record<string, (...rest: unknown[]) => Promise<unknown>>)[
								handler
							].apply(surface.resolver, argsFor(gqlContext))
						)
				})
		})
	);

	return { result, response };
}

/** The retry declaration a handler carries, as the interceptor reads it. */
const idempotentDeclarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as any)[handler]);

/** The concurrency declaration a handler carries, as the guard and the interceptor read it. */
const versionedDeclarationOf = (handler: string) =>
	Reflect.getMetadata(VERSIONED_METADATA_KEY, (OrderReturnResolver.prototype as any)[handler]);

/** The receipt of a whole line, as a caller states it. */
const receipt = (version: number, key?: string) => ({
	lines: [{ lineId: LINE, receivedQuantity: '5' }],
	version,
	...(key === undefined ? {} : { idempotencyKey: key })
});

describe('OrderReturnResolver — the declarations that mirror the REST routes', () => {
	it('states the same scope, and the same requirement, as the route it mirrors', () => {
		// One operation, two protocols: a key presented over GraphQL and the same key presented over REST
		// name the same operation, so a client may retry on either without receiving the goods twice.
		expect(idempotentDeclarationOf(OrderReturnResolver, 'receiveOrderReturn')).toEqual(
			idempotentDeclarationOf(OrderReturnController, 'receive')
		);
		expect(idempotentDeclarationOf(OrderReturnResolver, 'requestOrderReturn')).toEqual(
			idempotentDeclarationOf(OrderReturnController, 'create')
		);
		expect(idempotentDeclarationOf(OrderReturnResolver, 'receiveOrderReturn')).toEqual({
			scope: 'return.receive',
			required: true,
			resourceType: 'order_return'
		});
	});

	it('states that the read does not write the version it reads', () => {
		expect(versionedDeclarationOf('orderReturn')).toEqual({
			resource: OrderReturnService,
			write: false
		});
		expect(versionedDeclarationOf('orderReturns')).toEqual({
			resource: OrderReturnService,
			write: false
		});
		expect(versionedDeclarationOf('receiveOrderReturn')).toEqual({ resource: OrderReturnService });
		expect(versionedDeclarationOf('requestOrderReturn')).toEqual({
			resource: OrderReturnService,
			required: false
		});
	});
});

describe('OrderReturnResolver — a receipt that states no retry key', () => {
	it('refuses the operation, naming IDEMPOTENCY_KEY_REQUIRED, before the resolver runs', async () => {
		const surface = resource();
		const input = receipt(3);

		await expect(
			send(surface, 'receiveOrderReturn', 'mutation', { id: RETURN, input }, (context) => [RETURN, input, context])
		).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
		expect(surface.service.receive).not.toHaveBeenCalled();
		expect(surface.store.claim).not.toHaveBeenCalled();
	});
});

describe('OrderReturnResolver — a retried receipt', () => {
	it('replays the first receipt when the key and the input are repeated, receiving once', async () => {
		const surface = resource();
		const first = receipt(3, RECEIVE_KEY);
		const second = receipt(3, RECEIVE_KEY);

		const sent = await send(
			surface,
			'receiveOrderReturn',
			'mutation',
			{ id: RETURN, input: first },
			(context) => [RETURN, first, context]
		);
		const replayed = await send(
			surface,
			'receiveOrderReturn',
			'mutation',
			{ id: RETURN, input: second },
			(context) => [RETURN, second, context]
		);

		expect(sent.result).toMatchObject({ receivedQuantity: '5.000000' });
		expect(replayed.result).toEqual(sent.result);
		expect(surface.service.receive).toHaveBeenCalledTimes(1);
		expect(surface.store.complete).toHaveBeenCalledTimes(1);
	});
});

describe('OrderReturnResolver — a receipt of a version the return has moved past', () => {
	it('is refused with ENTITY_VERSION_CONFLICT from the input member, and nothing is received', async () => {
		const surface = resource(returnRow({ version: 4 }));
		const input = receipt(3, RECEIVE_KEY);

		await expect(
			send(surface, 'receiveOrderReturn', 'mutation', { id: RETURN, input }, (context) => [RETURN, input, context])
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });
		expect(surface.service.receive).not.toHaveBeenCalled();
	});
});

describe('OrderReturnResolver — a status move that states its version as an argument', () => {
	it('is refused with ENTITY_VERSION_CONFLICT when the version it states has moved on', async () => {
		// Deciding a status takes no input of its own, so the version rides as the mutation's own
		// argument — the schema has to accept it there for a client to be able to state one at all.
		const surface = resource(returnRow({ version: 4 }));

		await expect(
			send(surface, 'approveOrderReturn', 'mutation', { id: RETURN, note: 'fine', version: 3 }, (context) => [
				RETURN,
				'fine',
				3,
				context
			])
		).rejects.toMatchObject({ status: 409, code: 'ENTITY_VERSION_CONFLICT' });
		expect(surface.service.approve).not.toHaveBeenCalled();
	});

	it('hands the accepted version to the service and answers with the version the write left behind', async () => {
		const surface = resource();

		const { result } = await send(
			surface,
			'approveOrderReturn',
			'mutation',
			{ id: RETURN, note: 'fine', version: 3 },
			(context) => [RETURN, 'fine', 3, context]
		);

		expect(surface.service.approve).toHaveBeenCalledWith(RETURN, 'fine', { wildcard: false, versions: [3] });
		// The version is read from the payload's own return rather than from an entity tag: the response
		// object of a mutation is the payload, and the entity tag is published where the response *is*
		// the versioned aggregate — which is the REST route.
		expect(result).toMatchObject({ orderReturn: { version: 4 }, userErrors: [] });
	});

	it('is refused with VERSION_REQUIRED when it states none at all', async () => {
		const surface = resource();

		await expect(
			send(surface, 'approveOrderReturn', 'mutation', { id: RETURN, note: 'fine' }, (context) => [
				RETURN,
				'fine',
				undefined,
				context
			])
		).rejects.toMatchObject({ status: 428, code: 'VERSION_REQUIRED' });
		expect(surface.service.approve).not.toHaveBeenCalled();
	});
});

describe('OrderReturnResolver — the read that states a version', () => {
	it('answers it, because a read changes nothing, and publishes the version it read', async () => {
		const surface = resource(returnRow({ version: 9 }));

		const { result, response } = await send(
			surface,
			'orderReturn',
			'query',
			{ id: RETURN, version: 1 },
			() => [RETURN]
		);

		expect(result).toMatchObject({ version: 9 });
		expect(response.headers['ETag']).toBe('"9"');
	});
});
