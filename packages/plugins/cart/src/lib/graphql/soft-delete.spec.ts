/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the `DELETE /:id/soft`
 * and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all five of this plugin's
 * controllers serve that pair while not one of its five resolvers declared either field. A client could
 * therefore retire a cart, a line, an applied promotion, a delivery choice or a checkout session
 * recoverably over REST and not over GraphQL, where the only deletion-shaped field it held was the
 * destructive one — and the destructive one is exactly what the soft routes exist to avoid on rows a
 * checkout was assembled from, a buyer was quoted at and a durable operation points back at. Ten fields
 * close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level view grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **The two writable halves of this domain do not share one grant, and the pair must not pretend they
 * do.** A cart, and the checkout session that converts it, are deleted under `CARTS_DELETE`; a line, an
 * applied promotion and a delivery choice are edited under `CARTS_EDIT`. Each field below states the
 * grant its own controller's override states, read off that controller — which is why the table carries
 * a grant per resource rather than one for the domain.
 *
 * **Nothing is doubled here but the services and the kernel's base controller.** The five controllers
 * are the real ones — including the `softRemove` and `softRecover` overrides, which exist only to state
 * the permission the inherited routes leave unstated — the five resolvers are the real ones, and the
 * document the fields are read out of is the real one. The service is the seam the parity requirement is
 * about: one stub per resource is what makes "the same method with the same identifier" visible without
 * a database behind it.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason this package's other suites
 * state — it boots the whole application graph, which no declaration here needs. The two pieces of it
 * this suite actually compares are the kernel's own: `@Permissions` is required from its own module,
 * because the metadata it writes is what "states the route's permission" means and a double that wrote
 * nothing would have the comparison pass on two absences; and the base controller's two lifecycle
 * handlers are restated in the shape `packages/core/src/lib/core/crud/crud.controller.ts` declares them,
 * handing the service the rest parameter as an ARRAY, because the real class reaches the entity graph.
 */
jest.mock('../commerce-cart/commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));
jest.mock('../commerce-cart-line/commerce-cart-line.service', () => ({
	CommerceCartLineService: class CommerceCartLineService {}
}));
jest.mock('../commerce-cart-shipping-method/commerce-cart-shipping-method.service', () => ({
	CommerceCartShippingMethodService: class CommerceCartShippingMethodService {}
}));
jest.mock('../commerce-cart-promotion/commerce-cart-promotion.service', () => ({
	CommerceCartPromotionService: class CommerceCartPromotionService {}
}));
jest.mock('../commerce-checkout-session/commerce-checkout-session.service', () => ({
	CommerceCheckoutSessionService: class CommerceCheckoutSessionService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService: class {},
		TenantAwareCrudService: class {},
		// The two routes this suite is about, in the shape the kernel declares them: the handler hands the
		// service its rest parameter, which is an empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRecover(id, options);
			}
		},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		// The permission decorator is the kernel's own: what this suite compares between a route and the
		// field that mirrors it is the metadata it writes.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph. What the declarations
		// under test read is the metadata it writes, so that is what the double writes.
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		GraphqlConnection: class {},
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		// The validation pipe the controllers build at class-definition time; Nest refuses a pipe with no
		// `transform`, and the controller files reach it through this barrel.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		// The two decimal helpers the money DTOs reach: they are called inside a validator's `validate`,
		// which nothing in this suite runs, so the double states the shape rather than the arithmetic.
		normalizeDecimalString: (value: unknown) => String(value),
		isValidDecimalString: () => true
	};
});

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CommerceCartController } from '../commerce-cart/commerce-cart.controller';
import { CommerceCartLineController } from '../commerce-cart-line/commerce-cart-line.controller';
import { CommerceCartPromotionController } from '../commerce-cart-promotion/commerce-cart-promotion.controller';
import { CommerceCartShippingMethodController } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.controller';
import { CommerceCheckoutSessionController } from '../commerce-checkout-session/commerce-checkout-session.controller';
import { CommerceCartResolver } from './commerce-cart.resolver';
import { CommerceCartLineResolver } from './commerce-cart-line.resolver';
import { CommerceCartPromotionResolver } from './commerce-cart-promotion.resolver';
import { CommerceCartShippingMethodResolver } from './commerce-cart-shipping-method.resolver';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';
import { cartSchemaExtensions } from './schema-extensions';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000023';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a cart over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the five resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the controller names it, which is what the root fields are built from. */
	name: string;
	/** The type its field answers with: the row, which is what its sibling mutations answer too. */
	answers: string;
	/** The grant its own routes state, taken from this plugin's own catalogue rather than restated. */
	grant: string;
	/** The collaborators its resolver takes, in constructor order, and which of them owns the resource. */
	deps: readonly string[];
	service: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The five resources whose inherited lifecycle routes had no GraphQL counterpart.
 *
 * The grant is read off each controller's own overrides — two of the five state `CARTS_DELETE` and three
 * state `CARTS_EDIT` — and is written here as this plugin's own catalogue entry, so a controller that
 * changed the grant it attaches fails this table rather than moving with it silently.
 */
const RESOURCES: IResource[] = [
	{
		name: 'CommerceCart',
		answers: 'Cart',
		grant: CART_PERMISSIONS.CARTS_DELETE,
		deps: ['cart'],
		service: 'cart',
		controller: CommerceCartController,
		resolver: CommerceCartResolver
	},
	{
		name: 'CommerceCartLine',
		answers: 'CartLine',
		grant: CART_PERMISSIONS.CARTS_EDIT,
		deps: ['cart', 'line'],
		service: 'line',
		controller: CommerceCartLineController,
		resolver: CommerceCartLineResolver
	},
	{
		name: 'CommerceCartPromotion',
		answers: 'CartPromotion',
		grant: CART_PERMISSIONS.CARTS_EDIT,
		deps: ['cart', 'promotion'],
		service: 'promotion',
		controller: CommerceCartPromotionController,
		resolver: CommerceCartPromotionResolver
	},
	{
		name: 'CommerceCartShippingMethod',
		answers: 'CartShippingMethod',
		grant: CART_PERMISSIONS.CARTS_EDIT,
		deps: ['cart', 'shippingMethod'],
		service: 'shippingMethod',
		controller: CommerceCartShippingMethodController,
		resolver: CommerceCartShippingMethodResolver
	},
	{
		name: 'CommerceCheckoutSession',
		answers: 'CheckoutSession',
		grant: CART_PERMISSIONS.CARTS_DELETE,
		deps: ['cart', 'session'],
		service: 'session',
		controller: CommerceCheckoutSessionController,
		resolver: CommerceCheckoutSessionResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The ten fields, built from the five resources so a resource cannot be listed with only half a pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary 111 of the schema's 112 fields of this
 * kind already use. `<Resource>` here is the name the controller declares — `CommerceCart`, not `Cart` —
 * because that is the name the write-parity gate reads off the controller, while the types the fields
 * answer with stay the concepts' short names, as every other field of this document does.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{ ...resource, field: `softDelete${resource.name}`, route: 'softRemove', method: 'softRemove' },
	{ ...resource, field: `recover${resource.name}`, route: 'softRecover', method: 'softRecover' }
]);

/** The grant every one of these controllers and resolvers states at class level. */
const VIEW = CART_PERMISSIONS.CARTS_VIEW;

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * The cart resolver takes several collaborators — the cart's own service beside the resource's — so the
 * other collaborators are stubbed as well, and a field that reached the wrong one would be visible as an
 * assertion about the wrong service rather than as a type error.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const stubs = new Map<string, Row>();

	for (const name of entry.deps) {
		if (!stubs.has(name)) {
			stubs.set(name, {
				softRemove: jest.fn().mockResolvedValue(RETIRED),
				softRecover: jest.fn().mockResolvedValue(RESTORED)
			});
		}
	}

	const service = stubs.get(entry.service) as Row;

	return {
		service,
		// Every controller of this domain takes its own resource's service and hands it to the base class,
		// which is what the two inherited routes call.
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(...entry.deps.map((name) => stubs.get(name))) as Row
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
	const mutation = cartSchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the cart document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the cart document declares no Mutation field named "${name}"`);
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
describe('the cart document — the five inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers the row each route answers, which is what the resource’s other mutations answer', () => {
		// The REST routes answer the row they retired or restored — the base class hands back what the
		// service returned — so the pair follows the resource's own type rather than a result object
		// invented for it. The one deletion-shaped sibling this domain already carried, `deleteCart`,
		// answers `Boolean!` because a destructive delete has no row left to answer with; this pair does,
		// and this plugin declares no payload wrapper to answer with instead.
		for (const { field, answers } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createCart',
			'updateCart',
			'deleteCart',
			'associateCartWithContact',
			'mergeCarts',
			'addCartLine',
			'updateCartLine',
			'removeCartLine',
			'setCartShippingMethod',
			'removeCartShippingMethod',
			'applyCartPromotion',
			'removeCartPromotion',
			'startCheckout',
			'completeCheckout',
			'abandonCheckout'
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
		expect(overGraphql).toBe(overRest);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes a cart or a checkout session out of
 * every listing and a recover puts it back, and on the three child resources it changes what the cart
 * costs — so a field that left the grant to its class would extend the read permission into a write.
 * That is the defect the controllers' own overrides exist to close on the other surface, and the one a
 * GraphQL caller would otherwise reach it through.
 */
describe('the soft-delete pair — the permission and the guards are the route’s', () => {
	it('distinguishes the two grants this domain declares, so the comparison cannot pass on one value', () => {
		// The control: two resources of the five are deleted and three are edited, so a table that named
		// one grant for the domain would be wrong about three of them, and a field carrying the class's
		// view grant would be wrong about all five.
		const grants = new Set(RESOURCES.map(({ grant }) => grant));

		expect(grants.size).toBe(2);
		expect(grants.has(VIEW)).toBe(false);
	});

	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not ungated, so the comparison below cannot pass on two
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

	it('demands the grant this domain declares for the resource, which the ten overrides state', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for, and
		// because the comparison above holds even if both surfaces drifted to the same wrong grant: the
		// class-level grant of every one of these controllers and resolvers is the VIEW grant, which is
		// not the grant of any field below.
		for (const { field, route, controller, resolver, grant } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([VIEW]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([VIEW]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(CommerceCartController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The feature gates of every resolver, read from the metadata the real `@FeatureFlag` writes (AWR-4).
 *
 * The rule is the REST surface's: a resolver states every feature code the controllers serving the same
 * resources state, beside `FEATURE_GRAPHQL`, and nothing else — a code the routes do not state would refuse
 * over GraphQL what REST serves, and a code they state that the resolver left out would serve over GraphQL
 * what REST refuses. `FEATURE_CART` is declared by this plugin's catalogue and stated by none of its
 * controllers today, so the resolvers state `FEATURE_GRAPHQL` alone; the day a controller states a code, the
 * first case below fails until its resolver states it too. `@FeatureFlag` stacks and the guard requires every
 * code a class states, so stating it is all that is needed.
 */
describe('the feature gates — every resolver states the codes its routes state', () => {
	/** Every code one target states, whichever of the two shapes the metadata holds. */
	const flagsOf = (target: object): unknown[] => [Reflect.getMetadata(FEATURE_METADATA, target) ?? []].flat();

	/** The five resolver classes, each with every controller whose resources it serves. */
	const resolvers = [...new Set(RESOURCES.map(({ resolver }) => resolver))].map((resolver) => ({
		resolver,
		controllers: RESOURCES.filter((resource) => resource.resolver === resolver).map(({ controller }) => controller)
	}));

	it('states, on each resolver class, exactly the codes its controllers state and the GraphQL surface', () => {
		expect(resolvers).toHaveLength(5);

		for (const { resolver, controllers } of resolvers) {
			const routeFlags = [...new Set(controllers.flatMap((controller) => flagsOf(controller)))];

			expect({ resolver: resolver.name, flags: [...flagsOf(resolver)].sort() }).toEqual({
				resolver: resolver.name,
				flags: [FEATURE_GRAPHQL, ...routeFlags].sort()
			});
		}
	});

	it('lets no field replace its class’s gate with one of its own', () => {
		// A handler's own codes replace its class's, so a field that stated one would be gated on it alone.
		for (const { resolver } of resolvers) {
			const prototype = resolver.prototype as Row;
			const fields = Object.getOwnPropertyNames(prototype).filter(
				(name) => name !== 'constructor' && typeof prototype[name] === 'function'
			);

			expect(fields.length).toBeGreaterThan(0);

			for (const field of fields) {
				expect({ field, flags: Reflect.getMetadata(FEATURE_METADATA, prototype[field]) }).toEqual({
					field,
					flags: undefined
				});
			}
		}
	});
});
