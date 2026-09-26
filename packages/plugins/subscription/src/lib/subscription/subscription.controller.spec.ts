/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a subscription route needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the package's service specs do, and everything the assertions are actually about is the
 * real thing: the real controller, the real `SubscriptionResolver`, the real `@Idempotent()` and
 * `@Versioned()` decorators with their real metadata, and the kernel's real `IdempotencyInterceptor`,
 * `VersionGuard` and `VersionInterceptor` driven over them.
 *
 * What the suite pins is therefore this package's *adoption* of the two conventions rather than a
 * re-implementation of them: that the bill route requires a retry key and does not run its handler
 * without one, that the same key presented twice answers the second call from the record of the first
 * instead of billing a second cycle, that a write whose `If-Match` names a version the subscription
 * has moved past is refused with a conflict naming both versions, that a response carrying a version
 * publishes it as an `ETag` while a route that has not opted in publishes nothing, and that the
 * GraphQL mutations mirror the routes they stand for under the same scope names.
 */
jest.mock('@gauzy/common', () => ({
	/** A no-op decorator factory: the feature gate is not what these cases are about. */
	FeatureFlag: () => () => undefined
}));

// The interceptor's injected store is substituted at its own module, one seam below the barrel: the
// store's class reaches the ORM and the entity graph, neither of which a case about a retry key needs.
// The interceptor itself — the logic every case is about — is the kernel's real one.
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: no controller here is mapped onto a Nest application. */
	const decorator = () => () => undefined;
	// The metadata key a route's declaration is read from, and the property the guard leaves its accepted
	// version on. Both come from the kernel module the barrel re-exports them from, so the substituted
	// barrel cannot hand the cases a value the decorators and the guard do not actually write.
	const concurrency = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	class CrudController {
		constructor(protected readonly service: any) {}
	}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}

		async update(): Promise<any> {
			return { affected: 0 };
		}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService,
		BaseQueryDTO: class {},
		BaseEntity: class {},
		TenantBaseEntity: class {},
		TenantOrganizationBaseEntity: class {},
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
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		VersionedColumn: decorator,
		JsonColumn: decorator,
		Permissions: decorator,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		UUIDValidationPipe: class {},
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		SequenceService: class SequenceService {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: jest.requireActual('@gauzy/core/src/lib/core/errors/unique-violation').isUniqueViolation,
		// The conventions themselves, and the machinery that enforces them: the metadata the decorators
		// write is what the guard and the interceptors below read, so a double of either would assert
		// nothing about this package's routes.
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		IdempotencyInterceptor: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.interceptor')
			.IdempotencyInterceptor,
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		VersionGuard: jest.requireActual('@gauzy/core/src/lib/concurrency/version.guard').VersionGuard,
		VersionInterceptor: jest.requireActual('@gauzy/core/src/lib/concurrency/version.interceptor')
			.VersionInterceptor,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write').versionExpectationOf,
		VERSIONED_METADATA_KEY: concurrency.VERSIONED_METADATA_KEY,
		VERSION_EXPECTATION_PROPERTY: concurrency.VERSION_EXPECTATION_PROPERTY,
		// The refusals a case asserts on are the platform's own classes for the same reason.
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode
	};
});

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, of } from 'rxjs';
import { SubscriptionResolver } from '../graphql/resolvers/subscription.resolver';
import { schemaExtensions } from '../graphql/schema-extensions';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import {
	ApiErrorCode,
	ApiException,
	IDEMPOTENT_METADATA_KEY,
	IdempotencyInterceptor,
	IVersionExpectation,
	VERSION_EXPECTATION_PROPERTY,
	VERSIONED_METADATA_KEY,
	VersionGuard,
	VersionInterceptor
} from '@gauzy/core';

/** The version the guard accepted for the subscription every case acts on. */
const acceptedVersion: IVersionExpectation = { wildcard: false, versions: [1] };

/** The subscription every case acts on. */
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000010';

/** The retry key both presentations of one bill present, long enough for the platform to accept it. */
const KEY = 'bill-cycle-0001';

type Row = Record<string, any>;

/**
 * The platform's idempotency store, in memory.
 *
 * It models the two things the interceptor depends on and nothing else: one record per `(scope, key)`,
 * which is the unique tuple the store's own table carries, and the response the first attempt recorded
 * against that record. A second presentation of the same key therefore finds a record with a response
 * on it and is answered from that response rather than by running the work a second time.
 *
 * A key is settled by the row or by its id, because that is what the platform's own store accepts: the
 * interceptor holds an id, while a domain service holds the row it claimed. Both reach the same record.
 *
 * @returns The store, and the records it holds so a case can assert what was claimed and stored.
 */
function idempotencyStore() {
	const records = new Map<string, Row>();
	const byId = new Map<string, Row>();
	/** The record a settle call names, addressed the way the caller addressed it. */
	const addressed = (record: Row | string): Row | undefined =>
		typeof record === 'string' ? byId.get(record) : record;

	return {
		records,
		claim: async (claim: Row) => {
			const identity = `${claim.scope}:${claim.key}`;
			const existing = records.get(identity);

			if (!existing) {
				const opened = { id: `key-${byId.size + 1}`, ...claim, response: null };

				records.set(identity, opened);
				byId.set(opened.id, opened);

				return { outcome: 'CLAIMED', record: opened };
			}

			if (existing.response) {
				return { outcome: 'REPLAYED', record: existing, response: existing.response };
			}

			return { outcome: 'IN_FLIGHT', record: existing, retryAfterMs: 0 };
		},
		complete: async (record: Row | string, response: Row) => {
			const settled = addressed(record);

			if (settled) {
				settled.response = { status: response.responseStatus, body: response.responseBody };
			}
		},
		fail: async (record: Row | string, failure: Row) => {
			const settled = addressed(record);

			if (settled) {
				settled.failure = failure;
			}
		}
	};
}

/**
 * The execution context a guard or an interceptor is handed, as both of them read it.
 *
 * @param handler The route handler the metadata is read off.
 * @param request The request behind the handler.
 * @param response The response behind the handler.
 * @returns The context.
 */
function executionContext(handler: Function, request: Row, response: Row): ExecutionContext {
	return {
		getHandler: () => handler,
		getClass: () => SubscriptionController,
		getType: () => 'http',
		getArgs: () => [],
		getArgByIndex: () => undefined,
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
		switchToRpc: () => {
			throw new Error('the subscription routes carry no rpc handler');
		},
		switchToWs: () => {
			throw new Error('the subscription routes carry no websocket handler');
		}
	} as unknown as ExecutionContext;
}

/**
 * A request to the route that bills one cycle.
 *
 * The accepted version is already on it, because that is what `@Versioned()`'s guard leaves behind
 * before the handler runs: the route reads it back from there rather than parsing the header a second
 * time.
 *
 * @param headers The headers the caller sent.
 * @param body The body the caller sent.
 * @returns The request.
 */
function billRequest(headers: Row = {}, body: Row = {}): Row {
	return {
		method: 'POST',
		url: `/api/subscriptions/${SUBSCRIPTION}/bill`,
		originalUrl: `/api/subscriptions/${SUBSCRIPTION}/bill`,
		params: { id: SUBSCRIPTION },
		query: {},
		headers,
		body,
		[VERSION_EXPECTATION_PROPERTY]: acceptedVersion
	};
}

/** The response a route writes its headers to. */
const responseDouble = () => ({ setHeader: jest.fn(), status: jest.fn() });

/** What one billing cycle did, as the service answers it and the interceptor stores it for replay. */
const billedCycle = {
	subscriptionId: SUBSCRIPTION,
	billingId: 'cycle-1',
	status: 'PAID',
	replayed: false,
	orderId: 'order-1',
	amount: '120.000000',
	currency: 'USD'
};

/**
 * Billing one cycle under a retry key.
 *
 * The route requires a key because a lost response to a billing call is a customer who cannot tell
 * whether the period was charged. This suite pins the two answers that makes possible: a bill that
 * presents no key is refused without running anything, and the same key presented a second time is
 * answered from the record of the first attempt rather than by billing a second cycle.
 */
describe('SubscriptionController — billing a cycle under a retry key', () => {
	it('refuses a bill that presents no key, and runs nothing', async () => {
		const request = billRequest();
		const response = responseDouble();
		const service = { billCycle: async () => billedCycle };
		const controller = new SubscriptionController(service as never);
		const bill = jest.spyOn(controller, 'bill');
		const next: CallHandler = { handle: () => from(controller.bill(SUBSCRIPTION, {} as never, request as never)) };

		const refusal = await lastValueFrom(
			new IdempotencyInterceptor(idempotencyStore() as never, new Reflector()).intercept(
				executionContext(SubscriptionController.prototype.bill, request, response),
				next
			)
		).catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED);
		expect(refusal.getStatus()).toBe(400);
		// The refusal is the interceptor's, so the route never ran and no cycle was billed.
		expect(bill).not.toHaveBeenCalled();
	});

	it('answers a replayed key from the record of the first attempt, without billing twice', async () => {
		const request = billRequest({ 'idempotency-key': KEY });
		const response = responseDouble();
		const service = { billCycle: async () => billedCycle };
		const controller = new SubscriptionController(service as never);
		const bill = jest.spyOn(controller, 'bill');
		const next: CallHandler = { handle: () => from(controller.bill(SUBSCRIPTION, {} as never, request as never)) };
		const store = idempotencyStore();
		const interceptor = new IdempotencyInterceptor(store as never, new Reflector());
		const context = executionContext(SubscriptionController.prototype.bill, request, response);

		const first = await lastValueFrom(interceptor.intercept(context, next));
		const replayed = await lastValueFrom(interceptor.intercept(context, next));

		expect(bill).toHaveBeenCalledTimes(1);
		expect(first).toMatchObject({ billingId: 'cycle-1', replayed: false });
		// The second call is the first call's answer, returned without a second cycle.
		expect(replayed).toEqual(first);
		expect(response.setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
		// One record, under the operation's own scope and the caller's key, carrying that answer.
		expect(store.records.size).toBe(1);
		expect(store.records.get(`subscription.bill:${KEY}`)?.response?.body).toEqual(first);
	});
});

/**
 * The version a write is predicated on.
 *
 * A write is refused with a conflict when the subscription has moved past the version the caller named,
 * and the refusal carries both versions, so a caller can tell what it stated from what it lost to. The
 * version the guard accepted is what the route hands its service — the statement that performs the
 * write is predicated on it — and the response publishes the version the write left behind as an entity
 * tag, which is the value the caller states back on the write that follows.
 */
describe('SubscriptionController — the version a write is predicated on', () => {
	/** The service the guard reads the subscription through, standing where the module registry stands. */
	const moduleRefDouble = (row: Row | null) => ({
		get: (resource: unknown) => {
			// The route declares `SubscriptionService` as the reader of the row it writes, so the registry
			// is asked for that class rather than for a name it could misspell.
			expect(resource).toBe(SubscriptionService);

			return { findOneByIdString: async () => row };
		}
	});

	/** A request to the route that updates a subscription. */
	const updateRequest = (ifMatch: string): Row => ({
		method: 'PUT',
		url: `/api/subscriptions/${SUBSCRIPTION}`,
		originalUrl: `/api/subscriptions/${SUBSCRIPTION}`,
		params: { id: SUBSCRIPTION },
		query: {},
		headers: { 'if-match': ifMatch },
		body: {}
	});

	it('refuses a write whose If-Match names a version the subscription has moved past', async () => {
		const request = updateRequest('"2"');
		const context = executionContext(SubscriptionController.prototype.update, request, responseDouble());
		const guard = new VersionGuard(new Reflector(), moduleRefDouble({ id: SUBSCRIPTION, version: 3 }) as never);

		const refusal = await guard.canActivate(context).catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.getStatus()).toBe(409);
		// Both versions travel with the refusal, so the caller can tell what it stated from what it lost to.
		expect(refusal.details).toEqual({ expectedVersion: 2, actualVersion: 3 });
	});

	it('accepts the version the subscription holds, and leaves it for the write to predicate on', async () => {
		const request = updateRequest('"3"');
		const context = executionContext(SubscriptionController.prototype.update, request, responseDouble());
		const guard = new VersionGuard(new Reflector(), moduleRefDouble({ id: SUBSCRIPTION, version: 3 }) as never);

		await expect(guard.canActivate(context)).resolves.toBe(true);
		// The route hands this straight to the service, which is what makes the statement the write runs
		// conditional on the version the guard compared rather than on the one the row happens to hold.
		expect(request[VERSION_EXPECTATION_PROPERTY]).toEqual({ wildcard: false, versions: [3] });
	});

	it('publishes the version a response carries as its entity tag', async () => {
		const response = responseDouble();
		const context = executionContext(SubscriptionController.prototype.update, updateRequest('"3"'), response);

		const result = await lastValueFrom(
			new VersionInterceptor(new Reflector()).intercept(context, {
				handle: () => of({ id: SUBSCRIPTION, version: 7 })
			})
		);

		expect(result).toMatchObject({ version: 7 });
		expect(response.setHeader).toHaveBeenCalledWith('ETag', '"7"');
	});

	it('publishes nothing on a read, which states no version and is refused none', async () => {
		const response = responseDouble();
		const request = {
			method: 'GET',
			url: `/api/subscriptions/${SUBSCRIPTION}`,
			originalUrl: `/api/subscriptions/${SUBSCRIPTION}`,
			params: { id: SUBSCRIPTION },
			query: {},
			headers: {},
			body: {}
		};
		const context = executionContext(SubscriptionController.prototype.findById, request, response);

		await lastValueFrom(
			new VersionInterceptor(new Reflector()).intercept(context, {
				handle: () => of({ id: SUBSCRIPTION, version: 7 })
			})
		);

		expect(response.setHeader).not.toHaveBeenCalled();
	});
});

/**
 * The GraphQL parity.
 *
 * A GraphQL caller reaches the same service the REST routes do, so the two surfaces have to answer a
 * retry and a stale version identically. They can only do that if the resolvers declare the same
 * conventions under the same scope names, and a mutation's declaration is metadata rather than
 * behaviour — which is exactly what a case can assert without standing up a schema.
 */
describe('SubscriptionResolver — the same conventions, under the same names', () => {
	/**
	 * The scope every mutating field declares, and whether it demands a key.
	 *
	 * A client presents one key across operations, so the scope is the operation's identity: the same
	 * key presented to a different scope is a different request, and a field that declared no scope would
	 * accept a key and do nothing with it — telling the caller its retry was protected when it was not.
	 * Only billing a cycle demands a key; the rest honour one when it is presented.
	 */
	const scopes: Array<[string, string, boolean]> = [
		['createSubscription', 'subscription.create', false],
		['updateSubscription', 'subscription.update', false],
		['activateSubscription', 'subscription.activate', false],
		['pauseSubscription', 'subscription.pause', false],
		['resumeSubscription', 'subscription.resume', false],
		['cancelSubscription', 'subscription.cancel', false],
		['expireSubscription', 'subscription.expire', false],
		['changeSubscriptionPlan', 'subscription.plan.change', false],
		['addSubscriptionItem', 'subscription.item.add', false],
		['changeSubscriptionItemQuantity', 'subscription.item.change_quantity', false],
		['billSubscription', 'subscription.bill', true]
	];

	it('declares one scope per mutating field, and demands a key only where the route does', () => {
		for (const [mutation, scope, required] of scopes) {
			expect(
				Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (SubscriptionResolver.prototype as Row)[mutation])
			).toMatchObject({ scope, required, resourceType: 'subscription' });
		}
	});

	it('states that a query does not write, which a POST transport cannot say', () => {
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, SubscriptionResolver.prototype.subscriptions)?.write).toBe(
			false
		);
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, SubscriptionResolver.prototype.subscription)?.write).toBe(
			false
		);
	});

	it('declares its mutations as writes to a versioned subscription', () => {
		for (const mutation of [
			SubscriptionResolver.prototype.updateSubscription,
			SubscriptionResolver.prototype.activateSubscription,
			SubscriptionResolver.prototype.pauseSubscription,
			SubscriptionResolver.prototype.resumeSubscription,
			SubscriptionResolver.prototype.cancelSubscription,
			SubscriptionResolver.prototype.expireSubscription,
			SubscriptionResolver.prototype.changeSubscriptionPlan,
			SubscriptionResolver.prototype.addSubscriptionItem,
			SubscriptionResolver.prototype.changeSubscriptionItemQuantity,
			SubscriptionResolver.prototype.billSubscription
		]) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, mutation)).toBeDefined();
		}

		// A create has no subscription to have read, so it accepts a version without requiring one.
		expect(
			Reflect.getMetadata(VERSIONED_METADATA_KEY, SubscriptionResolver.prototype.createSubscription)?.required
		).toBe(false);
	});
});

/** The document this plugin contributes to the platform schema, already parsed by the tag it is written in. */
const definitions = (schemaExtensions as unknown as { definitions: Row[] }).definitions;

/** One definition of the document. */
const definition = (kind: string, name: string): Row | undefined =>
	definitions.find((entry) => entry.kind === kind && entry.name?.value === name);

/** The member names of an input type or of every field of an object type. */
const membersOf = (kind: string, name: string): string[] =>
	(definition(kind, name)?.fields ?? []).map((field: Row) => field.name.value);

/** The argument names a mutation declares beside its input. */
const argumentsOf = (mutation: string): string[] =>
	(
		(definition('ObjectTypeExtension', 'Mutation')?.fields ?? []).find(
			(field: Row) => field.name.value === mutation
		)?.arguments ?? []
	).map((argument: Row) => argument.name.value);

/**
 * The schema's half of the two conventions.
 *
 * A convention that a client cannot express is not adopted: the version a write states and the retry
 * key a retry presents have to be reachable from the document this plugin contributes, and the
 * document is parsed by the tag it is written in — so a schema that does not build fails here rather
 * than at boot.
 */
describe('SubscriptionSchema — the members the two conventions need', () => {
	it('carries the version of a subscription, which is what a caller states back on a write', () => {
		const version = (definition('ObjectTypeDefinition', 'CustomerSubscription')?.fields ?? []).find(
			(field: Row) => field.name.value === 'version'
		);

		expect(version?.type.kind).toBe('NonNullType');
		expect(version?.type.type.name.value).toBe('Int');
	});

	it('accepts a version on every mutation that writes a subscription', () => {
		// The mutations that take no input object state the version beside their other arguments.
		for (const mutation of [
			'activateSubscription',
			'resumeSubscription',
			'addSubscriptionItem',
			'changeSubscriptionItemQuantity'
		]) {
			expect(argumentsOf(mutation)).toContain('version');
		}

		for (const input of [
			'UpdateSubscriptionInput',
			'PauseSubscriptionInput',
			'CancelSubscriptionInput',
			'ExpireSubscriptionInput',
			'ChangeSubscriptionPlanInput',
			'BillSubscriptionInput'
		]) {
			expect(membersOf('InputObjectTypeDefinition', input)).toContain('version');
		}
	});

	it('carries a retry key a retry can present, and never asks for a version a create cannot have', () => {
		expect(membersOf('InputObjectTypeDefinition', 'CreateSubscriptionInput')).toContain('idempotencyKey');
		expect(membersOf('InputObjectTypeDefinition', 'CreateSubscriptionInput')).not.toContain('version');
		expect(membersOf('InputObjectTypeDefinition', 'BillSubscriptionInput')).toContain('idempotencyKey');
		// A mutation whose arguments are not an input object carries the key as a sibling instead.
		expect(argumentsOf('activateSubscription')).toContain('idempotencyKey');
	});

	it('offers a retry key only where a scope honours it, and offers one wherever a scope does', () => {
		// The rule the schema and the resolvers have to agree on: a member the schema offers and the kernel
		// does nothing with tells a client its retry is protected when it is not, and a scope with no way
		// to present a key is a scope no caller can reach.
		const mutations = (definition('ObjectTypeExtension', 'Mutation')?.fields ?? []) as Row[];
		const prototype = SubscriptionResolver.prototype as Row;
		const advertised: string[] = [];
		const scoped: string[] = [];

		for (const mutation of mutations) {
			const name = mutation.name.value as string;
			const field = prototype[name];

			// Only the fields this resolver owns are this suite's business: the item and billing mutations
			// belong to their own resolvers, which serve aggregates that carry no version.
			if (typeof field !== 'function') {
				continue;
			}

			const args = (mutation.arguments ?? []) as Row[];
			const inputArgument = args.find((argument) => argument.name.value === 'input');
			const inputName = inputArgument?.type?.type?.name?.value ?? inputArgument?.type?.name?.value;
			const offersKey =
				args.some((argument) => argument.name.value === 'idempotencyKey') ||
				(inputName ? membersOf('InputObjectTypeDefinition', inputName).includes('idempotencyKey') : false);
			const metadata = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, field);

			if (offersKey) {
				advertised.push(name);
				// Every member the schema offers is backed by a scope on the resolver that mirrors it.
				expect(metadata).toMatchObject({ scope: expect.any(String), resourceType: 'subscription' });
			}

			if (metadata?.scope) {
				scoped.push(name);
			}
		}

		// The two sets are the same set, and it is the set of mutating fields this plugin declares.
		expect(advertised.sort()).toEqual(scoped.sort());
		expect(advertised.sort()).toEqual([
			'activateSubscription',
			'addSubscriptionItem',
			'billSubscription',
			'cancelSubscription',
			'changeSubscriptionItemQuantity',
			'changeSubscriptionPlan',
			'createSubscription',
			'expireSubscription',
			'pauseSubscription',
			'resumeSubscription',
			'updateSubscription'
		]);
	});
});
