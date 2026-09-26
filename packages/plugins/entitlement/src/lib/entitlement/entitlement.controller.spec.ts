/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a resource needs and none of which is available outside
 * a running application. The seam is therefore doubled at the module boundary, and **the two kernels
 * that act on a declaration are the seams left real**: `@Versioned()` with the metadata key it writes,
 * the guard that reads it, the interceptor that publishes the version and the writer that consumes it,
 * and `@Idempotent()` with the key store the retry interceptor claims against. The declaration a route
 * carries and every decision made from it are therefore the platform's, and only the service the guard
 * reads a right through and the store the retry interceptor claims in are doubles — which is the whole
 * of each seam, because one call is all the platform makes on either.
 *
 * The resource under test is the real one: the entitlement controller, the activation controller, the
 * credential controller and the entitlement resolvers over the stubbed service, with the real context
 * and response doubles Nest hands a guard and an interceptor. The schema document is real too, and it
 * is parsed here — which is also what proves the document still composes.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, as a class the controller can extend: its own routes are not what this suite pins. */
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
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		BaseQueryDTO: class {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// line rather than a no-op: a route's pipes are otherwise not what this suite asserts.
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		// The kernel, real: the decorator a route carries, the guard and the interceptor it mounts, the
		// two functions that read and consume the version a caller accepted, the increment that keeps
		// every writer moving the counter by the same step, and the two keys a spec reads a declaration
		// and the accepted version from — the same values the barrel publishes.
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		VersionGuard: jest.requireActual('@gauzy/core/src/lib/concurrency/version.guard').VersionGuard,
		VersionInterceptor: jest.requireActual('@gauzy/core/src/lib/concurrency/version.interceptor').VersionInterceptor,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write').commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write').versionExpectationOf,
		bumpVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').bumpVersion,
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
		VERSION_EXPECTATION_PROPERTY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util')
			.VERSION_EXPECTATION_PROPERTY,
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			currentIp: () => null,
			currentUserAgent: () => null,
			hasPermission: () => false
		}
	};
});

/**
 * The retry interceptor is the real one, and it names `IdempotencyService` as its collaborator. The
 * class is doubled **as a module** so that loading the interceptor does not drag in the kernel's CRUD
 * base and, through it, the whole entity graph — none of which this suite asserts and some of which
 * cannot be loaded outside a running application. The instance the interceptor is handed is the
 * in-memory key store below, which is the seam the behaviour is asserted against.
 */
jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, of } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY, VERSION_EXPECTATION_PROPERTY } from '@gauzy/core';
import { VersionGuard } from '@gauzy/core/src/lib/concurrency/version.guard';
import { VersionInterceptor } from '@gauzy/core/src/lib/concurrency/version.interceptor';
import { ApiErrorCode } from '@gauzy/core/src/lib/core/errors/api-error-codes';
import { ApiException } from '@gauzy/core/src/lib/core/errors/api-exception';
import { IdempotencyInterceptor } from '@gauzy/core/src/lib/idempotency/idempotency.interceptor';
import { EntitlementService } from './entitlement.service';
import { EntitlementController } from './entitlement.controller';
import { EntitlementActivationController } from '../entitlement-activation/entitlement-activation.controller';
import { EntitlementKeyController } from '../entitlement-key/entitlement-key.controller';
import { EntitlementActivationResolver } from '../graphql/resolvers/entitlement-activation.resolver';
import { EntitlementKeyResolver } from '../graphql/resolvers/entitlement-key.resolver';
import { EntitlementResolver } from '../graphql/resolvers/entitlement.resolver';
import { schemaExtensions } from '../graphql/schema-extensions';

/**
 * The right's two safeguards, on both protocols (doc 05 §19.1, doc 06 §6.5).
 *
 * A right is edited by an operator, extended by a renewal and withdrawn by a refund, so two callers
 * reach the same row in the ordinary course of business, and one caller reaches it twice whenever a
 * response is lost. The suite pins what stands between them:
 *
 * - a write that states a version the right has moved past is refused with `ENTITY_VERSION_CONFLICT`
 *   and both versions in `details`, **before the handler runs** — so a refused write reaches no
 *   service and touches no row;
 * - a write that states the version the right holds proceeds, and the accepted version is left on the
 *   request the controller hands to the service;
 * - a write that states no version at all is refused with `VERSION_REQUIRED`, because an opt-in that
 *   silently degrades to last-writer-wins is worse than no opt-in;
 * - the version an answer carries is published as its `ETag`, which is the header the next write
 *   states back — and a route that has not opted in publishes nothing and is otherwise untouched;
 * - the writes that are safe to retry declare a scope and a client that presents a key gets the first
 *   attempt's answer instead of a second side effect, on the route and on the mutation that mirrors it
 *   alike, while the routes that declare no scope read no key at all;
 * - the reads are not versioned, and the GraphQL surface states the same protection the routes do: a
 *   mutation names the service that owns the right, and a query says that it does not write.
 */

const RIGHT = '00000000-0000-4000-8000-0000000000e1';
const RETRY_KEY = 'entitlement-key-0001';

/** One response double, recording what an interceptor wrote onto it. */
function responseDouble() {
	return {
		headers: {} as Record<string, string>,
		statuses: [] as number[],
		setHeader: jest.fn(function (this: { headers: Record<string, string> }, name: string, value: string) {
			this.headers[name] = value;
		}),
		status(code: number) {
			this.statuses.push(code);

			return this;
		}
	};
}

type ResponseDouble = ReturnType<typeof responseDouble>;

/** One request as the transport hands it to a guard or a retry interceptor. */
interface RequestDouble {
	method: string;
	params: Record<string, string>;
	body: unknown;
	headers: Record<string, string>;
	originalUrl?: string;
	query?: Record<string, unknown>;
	rawBody?: string;
	[VERSION_EXPECTATION_PROPERTY]?: unknown;
}

/** The request a caller writing a right sends. */
const write = (version?: string, key?: string): RequestDouble => ({
	method: 'POST',
	originalUrl: `/api/entitlements/${RIGHT}/suspend`,
	query: {},
	params: { id: RIGHT },
	body: { reason: 'PAYMENT_FAILED' },
	headers: {
		...(version ? { 'if-match': version } : {}),
		...(key ? { 'idempotency-key': key } : {})
	}
});

/** An HTTP execution context over one controller method, as Nest builds it for a route. */
function httpContext(
	handler: string,
	request: RequestDouble,
	response: ResponseDouble = responseDouble(),
	surface: { prototype: object } = EntitlementController
): ExecutionContext {
	return {
		getType: () => 'http',
		getClass: () => surface,
		getHandler: () => (surface.prototype as never)[handler],
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
		getArgByIndex: (index: number) => [request, {}][index]
	} as unknown as ExecutionContext;
}

/**
 * The guard over a service double that answers with one row.
 *
 * The guard resolves the row through the service the route names, so the whole seam is one method:
 * `findOneByIdString`, answering the version the right holds.
 */
const guardOver = (version: number | null, exists = true) =>
	new VersionGuard(new Reflector(), {
		get: () => ({
			findOneByIdString: async () => (exists ? { id: RIGHT, version } : null)
		})
	} as never);

/**
 * The key store, doubled in memory.
 *
 * The retry interceptor reads one vocabulary from it — a first claim, a replay of the stored response,
 * a key already used for a different request, and a claim still held by another request — so the
 * double answers that vocabulary, keyed the way the kernel keys a row: by scope and by key.
 */
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

/** The declaration a handler carries, as the guard and the interceptor read it. */
const declarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(VERSIONED_METADATA_KEY, (surface.prototype as never)[handler]);

/** The retry declaration a handler carries, as the retry interceptor reads it. */
const retryDeclarationOf = (surface: { prototype: object }, handler: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (surface.prototype as never)[handler]);

/** The fields a schema type, input or extension declares. */
const fieldsOf = (name: string) =>
	(schemaExtensions.definitions as any[])
		.filter((definition) => definition.name?.value === name)
		.flatMap((definition) => definition.fields ?? []);

/** The member names a schema input declares. */
const membersOf = (input: string) => fieldsOf(input).map((field: any) => field.name.value);

/** One field of a schema declaration, by name. */
const fieldOf = (name: string, field: string) =>
	fieldsOf(name).find((candidate: any) => candidate.name.value === field);

/** The arguments a schema mutation declares, in the order it declares them. */
const argsOf = (mutation: string) =>
	(fieldOf('Mutation', mutation)?.arguments ?? []).map((argument: any) => argument.name.value);

describe('EntitlementController — a write based on a version the right has moved past (doc 05 §19.1)', () => {
	it('refuses the suspension before the handler runs, naming both versions', async () => {
		const request = write('"2"');
		const refusal = await guardOver(3)
			.canActivate(httpContext('suspend', request))
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.details).toEqual({ expectedVersion: 2, actualVersion: 3 });
		// The write was never accepted, so no expectation is left for a handler to write under.
		expect(request[VERSION_EXPECTATION_PROPERTY]).toBeUndefined();
	});

	it('accepts the suspension when the right still holds the version the caller read', async () => {
		const request = write('"2"');

		await expect(guardOver(2).canActivate(httpContext('suspend', request))).resolves.toBe(true);
		// The accepted version travels on the request, which is what the controller hands the service.
		expect(request[VERSION_EXPECTATION_PROPERTY]).toEqual({ wildcard: false, versions: [2] });
	});

	it('accepts a version stated as a bare tag or a weak one, because the comparison is the version', async () => {
		await expect(guardOver(3).canActivate(httpContext('suspend', write('3')))).resolves.toBe(true);
		await expect(guardOver(3).canActivate(httpContext('suspend', write('W/"3"')))).resolves.toBe(true);
	});

	it('refuses a write that states no version, because the protection is not optional', async () => {
		await expect(guardOver(2).canActivate(httpContext('resume', write()))).rejects.toMatchObject({
			status: 428,
			code: ApiErrorCode.VERSION_REQUIRED
		});
	});

	it('answers a right that is not there with not-found rather than a conflict', async () => {
		// There is nothing for a stale version to be in conflict with, and the caller's next move is
		// different: it re-reads nothing and reports a right that does not exist.
		await expect(guardOver(null, false).canActivate(httpContext('revoke', write('"2"')))).rejects.toMatchObject({
			status: 404,
			code: ApiErrorCode.RESOURCE_NOT_FOUND
		});
	});
});

describe('EntitlementController — the routes the convention was adopted on (doc 05 §19.1)', () => {
	it.each([['update'], ['suspend'], ['resume'], ['extend'], ['reduce'], ['revoke']])(
		'versions the write route %s',
		(handler) => {
			expect(declarationOf(EntitlementController, handler)).toEqual({ resource: EntitlementService });
		}
	);

	it('requires no version of the grant, which creates the row rather than editing it', () => {
		expect(declarationOf(EntitlementController, 'create')).toEqual({
			resource: EntitlementService,
			required: false
		});
	});

	it('leaves every read unversioned', () => {
		for (const handler of ['check', 'findById', 'findAll', 'activations', 'keys']) {
			expect(declarationOf(EntitlementController, handler)).toBeUndefined();
		}
	});

	it('leaves the key-issuing route unversioned, because the right’s own revision does not move on it', () => {
		// The route writes a credential rather than the right: a key row is created against the right
		// and the right's `version` is untouched, so a version stated there would name a revision that
		// never changes.
		expect(declarationOf(EntitlementController, 'issueKey')).toBeUndefined();
	});
});

describe('EntitlementController — publishing the version an answer carries (doc 05 §19.1)', () => {
	it('sets the ETag of a versioned response to the version the right now holds', async () => {
		const response = responseDouble();
		const context = httpContext('suspend', write('"6"'), response);
		const interceptor = new VersionInterceptor(new Reflector());

		const result = await lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: RIGHT, version: 7 }) }));

		expect(result).toEqual({ id: RIGHT, version: 7 });
		expect(response.setHeader).toHaveBeenCalledWith('ETag', '"7"');
	});

	it('writes no header on a route that has not adopted the convention', async () => {
		const response = responseDouble();
		const context = httpContext('issueKey', write(), response);
		const interceptor = new VersionInterceptor(new Reflector());

		await lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: RIGHT, version: 7 }) }));

		expect(response.setHeader).not.toHaveBeenCalled();
	});
});

describe('EntitlementResolver — the same protection over GraphQL (doc 17 §6.2)', () => {
	it('versions the mutations that mirror a versioned route', () => {
		for (const mutation of ['revokeEntitlement', 'extendEntitlement']) {
			expect(declarationOf(EntitlementResolver, mutation)).toEqual({ resource: EntitlementService });
		}
	});

	it('requires no version of the grant, and publishes the one the created right carries', () => {
		expect(declarationOf(EntitlementResolver, 'grantEntitlement')).toEqual({
			resource: EntitlementService,
			required: false
		});
	});

	it('states that its queries do not write, because a GraphQL operation always travels over POST', () => {
		for (const query of ['entitlements', 'entitlement', 'checkEntitlement']) {
			expect(declarationOf(EntitlementResolver, query)?.write).toBe(false);
		}
	});

	it('leaves the activation and credential fields alone: neither moves the right’s own revision', () => {
		expect(declarationOf(EntitlementActivationResolver, 'activateEntitlement')).toBeUndefined();
		expect(declarationOf(EntitlementActivationResolver, 'deactivateEntitlement')).toBeUndefined();
		expect(declarationOf(EntitlementKeyResolver, 'issueEntitlementKey')).toBeUndefined();
		expect(declarationOf(EntitlementKeyResolver, 'revokeEntitlementKey')).toBeUndefined();
	});
});

describe('the plugin schema — the members the two protocols share (doc 17 §6.2)', () => {
	it('carries the right’s revision on the Entitlement type, in the non-null form a caller reads', () => {
		const version = fieldOf('Entitlement', 'version');

		expect(version).toBeDefined();
		expect(version.type.kind).toBe('NonNullType');
		expect(version.type.type.name.value).toBe('Int');
	});

	it('lets a mutation state the version it read, beside the arguments it qualifies', () => {
		// One request may select several mutations, so a version cannot travel in a header: it travels
		// as an argument of the field it qualifies, and the retry key travels with it.
		expect(argsOf('revokeEntitlement')).toEqual(['id', 'reason', 'version', 'idempotencyKey']);
		expect(argsOf('extendEntitlement')).toEqual(['id', 'endsAt', 'quantity', 'version', 'idempotencyKey']);
	});

	it('carries the retry key on the grant input and no version, because a grant creates the row', () => {
		expect(membersOf('GrantEntitlementInput')).toContain('idempotencyKey');
		expect(membersOf('GrantEntitlementInput')).not.toContain('version');
	});
});

/** Every route that declares a retry scope: the handler and what it declares. */
const RETRY_SCOPES: Array<[handler: string, scope: string, resourceType: string]> = [
	['create', 'entitlement.create', 'entitlement'],
	['suspend', 'entitlement.suspend', 'entitlement'],
	['resume', 'entitlement.resume', 'entitlement'],
	['extend', 'entitlement.extend', 'entitlement'],
	['revoke', 'entitlement.revoke', 'entitlement'],
	['issueKey', 'entitlement_key.issue', 'entitlement_key']
];

/** Every operation the two surfaces share: the resolver field, and the route it mirrors. */
const MIRRORED: Array<[
	resolver: { prototype: object },
	mutation: string,
	controller: { prototype: object },
	handler: string
]> = [
	[EntitlementResolver, 'grantEntitlement', EntitlementController, 'create'],
	[EntitlementResolver, 'extendEntitlement', EntitlementController, 'extend'],
	[EntitlementResolver, 'revokeEntitlement', EntitlementController, 'revoke'],
	[EntitlementKeyResolver, 'issueEntitlementKey', EntitlementController, 'issueKey'],
	[EntitlementKeyResolver, 'issueEntitlementKey', EntitlementKeyController, 'create'],
	[EntitlementActivationResolver, 'activateEntitlement', EntitlementActivationController, 'create']
];

describe('EntitlementController — the writes that are safe to retry (doc 06 §6.5)', () => {
	it.each(RETRY_SCOPES)('declares the %s route under the scope %s', (handler, scope, resourceType) => {
		expect(retryDeclarationOf(EntitlementController, handler)).toEqual({ scope, required: false, resourceType });
	});

	it('declares the activation route under the scope the slot operation is named by', () => {
		// `entitlement.activate` is the slot operation: taking a seat is the only activate this plugin
		// serves on a route — `EntitlementService.activateGranted` is event-driven and has none — and the
		// mutation that mirrors it is `activateEntitlement`.
		expect(retryDeclarationOf(EntitlementActivationController, 'create')).toEqual({
			scope: 'entitlement.activate',
			required: false,
			resourceType: 'entitlement_activation'
		});
	});

	it('gives the standalone issue route the scope of the operation it shares', () => {
		// One operation, two ways in: `POST /entitlement-keys` names the right in its body and
		// `POST /entitlements/:id/keys` names it in the path, and both mint a credential through the same
		// method. They therefore state one scope rather than two namespaces — and neither can replay the
		// other's answer, because a request's fingerprint is its method, its path and its body.
		expect(retryDeclarationOf(EntitlementKeyController, 'create')).toEqual({
			scope: 'entitlement_key.issue',
			required: false,
			resourceType: 'entitlement_key'
		});
	});

	it('leaves the routes that declare no scope untouched, key or no key', () => {
		// A route that has not adopted the convention reads no header, hashes nothing and claims no key:
		// the edit, the reduction, the read-only check and the reads behave exactly as they did before.
		for (const handler of ['update', 'reduce', 'check', 'findById', 'findAll', 'activations', 'keys']) {
			expect(retryDeclarationOf(EntitlementController, handler)).toBeUndefined();
		}

		for (const handler of ['update', 'release', 'revoke']) {
			expect(retryDeclarationOf(EntitlementActivationController, handler)).toBeUndefined();
		}

		for (const handler of ['update', 'revoke', 'reissue', 'reveal']) {
			expect(retryDeclarationOf(EntitlementKeyController, handler)).toBeUndefined();
		}
	});
});

describe('EntitlementResolver — the same retry scopes over GraphQL (doc 17 §6.2)', () => {
	it('declares on each mutation exactly what the route it mirrors declares', () => {
		for (const [resolver, mutation, controller, handler] of MIRRORED) {
			expect(retryDeclarationOf(resolver, mutation)).toEqual(retryDeclarationOf(controller, handler));
			// One operation, two protocols: the same key presented to either names the same operation, so
			// a client may retry on the surface it prefers without duplicating the side effect.
			expect(retryDeclarationOf(resolver, mutation)?.scope).toBeDefined();
		}
	});

	it('leaves the mutations with no retry scope undeclared', () => {
		// Giving a slot back and withdrawing a credential are each recorded where they are decided, and
		// neither is claimed here, so neither advertises a key the kernel would ignore.
		expect(retryDeclarationOf(EntitlementActivationResolver, 'deactivateEntitlement')).toBeUndefined();
		expect(retryDeclarationOf(EntitlementKeyResolver, 'revokeEntitlementKey')).toBeUndefined();
	});
});

describe('the plugin schema — the retry member every decorated mutation advertises (doc 17 §6.2)', () => {
	it('advertises the key on the input or the arguments of every mutation that declares a scope', () => {
		expect(membersOf('GrantEntitlementInput')).toContain('idempotencyKey');
		expect(membersOf('ActivateEntitlementInput')).toContain('idempotencyKey');
		expect(membersOf('IssueEntitlementKeyInput')).toContain('idempotencyKey');
		expect(argsOf('revokeEntitlement')).toContain('idempotencyKey');
		expect(argsOf('extendEntitlement')).toContain('idempotencyKey');
	});

	it('advertises it nowhere else, so no client is offered a key the kernel would ignore', () => {
		expect(membersOf('CheckEntitlementInput')).not.toContain('idempotencyKey');
		expect(argsOf('activateEntitlement')).not.toContain('idempotencyKey');
		expect(argsOf('issueEntitlementKey')).not.toContain('idempotencyKey');
		expect(argsOf('deactivateEntitlement')).not.toContain('idempotencyKey');
		expect(argsOf('revokeEntitlementKey')).not.toContain('idempotencyKey');
	});
});

describe('EntitlementController — a retried suspension (doc 06 §6.5)', () => {
	/** The controller over a stubbed service, with the retry interceptor over an in-memory key store. */
	const surface = () => {
		const service = { suspend: jest.fn(async () => ({ id: RIGHT, version: 3, status: 'SUSPENDED' })) };
		const store = keyStore();

		return {
			service,
			store,
			controller: new EntitlementController(service as never, {} as never, {} as never, {} as never),
			interceptor: new IdempotencyInterceptor(store as never, new Reflector())
		};
	};

	/**
	 * Runs one suspension the way the application runs it: the guard accepts the version the caller
	 * stated, then the retry interceptor claims the key and runs the controller's own method.
	 */
	const suspend = async (current: ReturnType<typeof surface>, request: RequestDouble) => {
		const response = responseDouble();
		const context = httpContext('suspend', request, response);

		await expect(guardOver(2).canActivate(context)).resolves.toBe(true);

		const result = await lastValueFrom(
			current.interceptor.intercept(context, {
				handle: () => from(current.controller.suspend(RIGHT, request.body as never, request as never))
			})
		);

		return { result, response };
	};

	it('answers a keyed repeat from the first attempt instead of suspending the right twice', async () => {
		const current = surface();
		const request = write('"2"', RETRY_KEY);

		const first = await suspend(current, request);
		const second = await suspend(current, request);

		expect(current.service.suspend).toHaveBeenCalledTimes(1);
		expect(second.result).toEqual(first.result);
		expect(second.response.headers['Idempotency-Replayed']).toBe('true');
	});

	it('runs an unkeyed repeat again, because a route that requires no key cannot tell a retry from a new call', async () => {
		const current = surface();

		await suspend(current, write('"2"'));
		await suspend(current, write('"2"'));

		expect(current.service.suspend).toHaveBeenCalledTimes(2);
		expect(current.store.claim).not.toHaveBeenCalled();
	});
});
