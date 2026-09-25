/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all three
 * of this plugin's controllers serve that pair while not one of its three resolvers declared either
 * field. A client could therefore retire a right, an activation or a licence key recoverably over REST
 * and not over GraphQL, where the deletion-shaped fields it held — `revokeEntitlement`,
 * `deactivateEntitlement`, `revokeEntitlementKey` — are all terminal, release what the row was used for
 * and cannot be undone. Six fields close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the payload
 *   the resource's other mutations answer, because a field the document does not carry is one no client
 *   can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level view grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * The three controllers are the real ones, the three resolvers are the real ones, and the document the
 * fields are read out of is the real one. What is doubled is `@gauzy/core`, which boots the whole
 * application graph from its barrel — configuration, the ORM, the module scanner — and cannot be loaded
 * outside a running application, as this package's other specs record.
 *
 * The one part of that double the assertions lean on is `CrudController`: both a route and a field have
 * to reach the service, and the base is what carries the delegation it does so through. It therefore
 * models the kernel's own two bodies (`crud.controller.ts`):
 *
 * ```ts
 * async softRemove(id, ...options) { return await this.crudService.softRemove(id, options); }
 * ```
 *
 * — the rest parameter is handed over as the array it is, which is why the route and the field below
 * are one call with two spellings of "no find options" rather than two different calls. The permission
 * decorator and the metadata key are the kernel's own for the same reason: a double of either would let
 * a field disagree with its route and still pass.
 */
jest.mock('@gauzy/common', () => {
	/**
	 * Every feature code a class-level `@FeatureFlag` stated, by the class it was stated on.
	 *
	 * The decorator is otherwise a no-op here — the guard that reads it is the kernel's, and this suite does
	 * not run it — so what is recorded is the plugin's half of the gate: which codes each class *declares*.
	 * It is exposed on the mocked module because a factory runs before this file's own declarations do.
	 */
	const declaredFeatureCodes = new Map<unknown, string[]>();

	return {
		declaredFeatureCodes,
		FeatureFlag: (code: string) => (target: unknown, key?: unknown) => {
			if (key === undefined) {
				declaredFeatureCodes.set(target, [...(declaredFeatureCodes.get(target) ?? []), code]);
			}
		}
	};
});

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: no controller here is mapped onto a Nest application. */
	const decorator = () => () => undefined;
	const permissions = jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator');

	/**
	 * The two inherited routes, with the kernel's own delegations.
	 *
	 * This plugin's controllers override both, so what a field is compared against is the override's
	 * hand-over and the base's one-line call to the service — the same call the field makes.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}

		async softRemove(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRemove(id, options);
		}

		async softRecover(id: any, ...options: any[]): Promise<any> {
			return await this.crudService.softRecover(id, options);
		}
	}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}
	}

	class BaseEntity {}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		Permissions: permissions.Permissions,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		EventBus: class {},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		// `@UsePipes(new AbstractValidationPipe(...))` on the inherited mutating routes is evaluated when
		// the controller class is defined, and Nest requires a pipe to expose `transform`, so the double
		// has to as well.
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
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		// The mark the key entity carries over its digest. The entity graph calls it at class-definition
		// time, so without it every suite that loads the entity fails to run at all.
		ExportRedacted: decorator,
		BaseEvent: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		Idempotent: decorator,
		Versioned: decorator,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
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

// The collaborators a resolver injects are doubled at their own modules, so nothing below them is
// loaded: what these cases assert is which service method each surface reaches, not what it returns.
jest.mock('../../entitlement/entitlement.service', () => ({ EntitlementService: class EntitlementService {} }));
jest.mock('../../entitlement-activation/entitlement-activation.service', () => ({
	EntitlementActivationService: class EntitlementActivationService {}
}));
jest.mock('../../entitlement-key/entitlement-key.service', () => ({
	EntitlementKeyService: class EntitlementKeyService {}
}));
jest.mock('../../entitlement-check/entitlement-check.service', () => ({
	EntitlementCheckService: class EntitlementCheckService {}
}));

import { NotFoundException } from '@nestjs/common';
import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { EntitlementController } from '../../entitlement/entitlement.controller';
import { EntitlementActivationController } from '../../entitlement-activation/entitlement-activation.controller';
import { EntitlementKeyController } from '../../entitlement-key/entitlement-key.controller';
import { schemaExtensions } from '../schema-extensions';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { EntitlementFeatures } from '../../entitlement.features';
import { EntitlementResolver } from './entitlement.resolver';
import { EntitlementActivationResolver } from './entitlement-activation.resolver';
import { EntitlementKeyResolver } from './entitlement-key.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000e1';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a right over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the three resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The payload type the resource's mutations answer. */
	payload: string;
	/** The member of that payload the returned row rides on. */
	member: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/** The three resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'Entitlement',
		payload: 'EntitlementPayload',
		member: 'entitlement',
		controller: EntitlementController,
		resolver: EntitlementResolver
	},
	{
		name: 'EntitlementActivation',
		payload: 'EntitlementActivationPayload',
		member: 'activation',
		controller: EntitlementActivationController,
		resolver: EntitlementActivationResolver
	},
	{
		name: 'EntitlementKey',
		payload: 'EntitlementKeyPayload',
		member: 'key',
		controller: EntitlementKeyController,
		resolver: EntitlementKeyResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The six fields, built from the three resources so a resource cannot be listed with only half a pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this
 * kind already use.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{ ...resource, field: `softDelete${resource.name}`, route: 'softRemove', method: 'softRemove' },
	{ ...resource, field: `recover${resource.name}`, route: 'softRecover', method: 'softRecover' }
]);

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * Each surface is built with the collaborators it declares and no more — a constructor ignores what it
 * is not handed a parameter for, which is what lets one builder serve the three resources.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const service = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};
	const unused = {};

	return {
		service,
		controller: new entry.controller(service, unused, unused, unused) as Row,
		resolver: new entry.resolver(service, unused, unused, unused, unused, unused) as Row
	};
}

/** The handlers of one controller, as functions, the inherited and overridden ones included. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of one resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` (`shared/guards/permission.guard.ts`) then answers `true`
 * to when the pair is empty.
 *
 * @param controller The controller the route belongs to.
 * @param handler The route's handler name.
 * @returns The permission metadata the guard would resolve.
 */
function permissionOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, resolver)
	);
}

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own fields, as the document declares them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the entitlement document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the entitlement document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The name of the type a field answers with, however deeply it is wrapped. */
function namedTypeOf(field: FieldDefinitionNode): string {
	return namedTypeName(field.type);
}

/**
 * The schema's half of the pair.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the entitlement document — the three inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers the payload the resource’s other mutations answer, carrying the row', () => {
		// The REST routes answer the row they retired or restored, and this plugin's mutations answer a
		// payload that carries it beside the refusal channel — so the pair follows that, rather than
		// answering the bare row and leaving a service refusal to travel as a GraphQL error.
		for (const { field, payload } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(payload);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'grantEntitlement',
			'revokeEntitlement',
			'extendEntitlement',
			'activateEntitlement',
			'deactivateEntitlement',
			'issueEntitlementKey',
			'revokeEntitlementKey'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is being corrected. A second spelling is a second vocabulary for one capability, and
		// a client that guessed the other one would find no field rather than an error it could act on.
		const restored = mutationFields()
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('restore'));

		expect(restored).toEqual([]);
		expect(mutationFields().map((field) => field.name.value)).toEqual(
			expect.arrayContaining(PARITY.filter(({ route }) => route === 'softRecover').map(({ field }) => field))
		);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the soft-delete pair — the two protocols retire and restore the same row', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](ID);
		const overGraphql = await resolver[entry.field](ID);

		// The inherited route hands over its rest parameter, which is an empty ARRAY, and the service
		// normalises both that and an absent argument to "no find options" — so the two are one call.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, []);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface acted on is the same row.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql[entry.member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it.each(RESOURCES)('answers a refusal on $name the way its siblings do, as a user error', async ({
		name,
		member,
		resolver
	}) => {
		// The convention every mutation of this plugin follows: an outcome the caller could have avoided
		// is reported in the payload with the operation succeeding, and only a request that could not have
		// been made correctly becomes a GraphQL error. A field of the pair that threw instead would be the
		// one mutation of the resource a client could not branch on.
		const service = { softRemove: jest.fn().mockRejectedValue(new NotFoundException('The right was not found.')) };
		const answer = await (new resolver(service) as Row)[`softDelete${name}`](ID);

		expect(answer[member]).toBeNull();
		expect(answer.userErrors).toEqual([
			{ code: 'NOT_FOUND', message: 'The right was not found.', path: [], details: null }
		]);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes a right, a slot or a credential out
 * of what a customer can exercise and a recover puts it back — so a field that left the grant to its
 * class would extend the read permission into a write. That is the defect the controllers' own
 * overrides exist to close on the other surface, and the one a GraphQL caller would otherwise reach it
 * through.
 */
describe('the soft-delete pair — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			// The override is asserted to be there before the two readings are compared, because that is
			// what makes the route's own metadata the thing being mirrored rather than the base's silence.
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the editing grant, which is the grant the six overrides state', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of all three resolvers is the VIEW grant, and a field that left the act to its
		// class would let a reader retire or restore a right, a slot or a credential.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([EntitlementPermissions.ENTITLEMENTS_EDIT]);
			expect(permissionOfRoute(controller, route)).toEqual([EntitlementPermissions.ENTITLEMENTS_EDIT]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([
				EntitlementPermissions.ENTITLEMENTS_VIEW
			]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(EntitlementController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The plugin's own feature gate, on both surfaces.
 *
 * Every entitlement REST controller declares `@FeatureFlag(EntitlementFeatures.ENTITLEMENT)`, so a tenant
 * that switched `FEATURE_ENTITLEMENT` off is refused by `FeatureFlagGuard` on every route. The resolver
 * classes declared only the platform's `FEATURE_GRAPHQL`, so with the capability off `suspendEntitlement`,
 * `reduceEntitlement` and `reissueEntitlementKey` were still served over GraphQL. Each resolver now declares
 * both codes; the kernel's decorator accumulates them and its guard requires every one, which is the
 * kernel's half and is pinned in the kernel's own specs. What is pinned here is the plugin's half: the codes
 * each class states, read off the decorator as it was applied.
 */
describe('the plugin feature gate — every resolver states the code its REST controller states', () => {
	const { declaredFeatureCodes } = jest.requireMock('@gauzy/common') as {
		declaredFeatureCodes: Map<unknown, string[]>;
	};

	/** Each controller and the resolver that mirrors it. */
	const MIRRORS: Array<[unknown, unknown]> = [
		[EntitlementController, EntitlementResolver],
		[EntitlementActivationController, EntitlementActivationResolver],
		[EntitlementKeyController, EntitlementKeyResolver]
	];

	it('declares the plugin code on every controller, as the routes are gated today', () => {
		for (const [controller] of MIRRORS) {
			expect(declaredFeatureCodes.get(controller)).toEqual([EntitlementFeatures.ENTITLEMENT]);
		}
	});

	it('declares the platform gate and the plugin code on every resolver, and nothing else', () => {
		for (const [, resolver] of MIRRORS) {
			expect([...(declaredFeatureCodes.get(resolver) ?? [])].sort()).toEqual(
				[FEATURE_GRAPHQL, EntitlementFeatures.ENTITLEMENT].sort()
			);
		}
	});

	it('gates each resolver on every code its controller is gated on, beyond the GraphQL endpoint itself', () => {
		for (const [controller, resolver] of MIRRORS) {
			const beyondEndpoint = (declaredFeatureCodes.get(resolver) ?? []).filter((code) => code !== FEATURE_GRAPHQL);

			expect(beyondEndpoint.sort()).toEqual([...(declaredFeatureCodes.get(controller) ?? [])].sort());
		}
	});

	it('is the code the plugin contributes to the catalogue', () => {
		expect(String(EntitlementFeatures.ENTITLEMENT)).toBe('FEATURE_ENTITLEMENT');
	});
});
