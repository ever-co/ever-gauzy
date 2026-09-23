/**
 * The write routes this package genuinely did not answer, and the reading that collapsed the rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **twenty-six** of this package's write
 * routes — which is not a gap count, because the instrument is name-blind in two directions that matter
 * here. It flags a route whose capability a field already serves under another name (`POST /carts` is
 * served by `createCart`, `POST /carts/:id/merge` by `mergeCarts`, `POST /carts/:id/lines` by
 * `addCartLine`), and it flags a child resource's own addressing of a capability the cart's fields
 * answer (`POST /cart-lines` adds a line exactly as `addCartLine` does, and the applied promotion's
 * update reaches the same recorded amount that re-applying through `applyCartPromotion` does).
 *
 * **The reading is the work, so it is asserted rather than described.** Twenty-two of the twenty-six
 * are pinned below route by route: each one's audit name (`<handler><Resource>`) is declared in this
 * document to be *absent*, and the field that serves the capability is declared to be present. Four are
 * left — `recalculateCommerceCart`, `updateCommerceCheckoutSession`,
 * `completeStepCommerceCheckoutSession` and `deleteCommerceCheckoutSession` — and the rest of this
 * suite is about those four.
 *
 * Three properties are pinned for each, exactly as the lifecycle pair's suite pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of every one of these
 *   controllers is the view grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches**, because two
 *   protocols that perform one act differently are two behaviours waiting to diverge — and it mirrors
 *   the route's `@Idempotent` scope and `@Versioned` expectation where the route declares one, because
 *   a keyless GraphQL retry would not dedupe where REST does and a versioned write needs its
 *   expectation.
 *
 * **Nothing is doubled here but the services and the kernel's base controller.** The five controllers
 * are the real ones, the resolvers are the real ones, and the document the fields are read out of is
 * the real one. The service is the seam the parity requirement is about: one stub per resource is what
 * makes "the same method with the same arguments" visible without a database behind it.
 *
 * `@gauzy/core`'s barrel is doubled at the module boundary for the reason this package's other suites
 * state — it boots the whole application graph, which no declaration here needs. The pieces of it this
 * suite actually compares are the kernel's own: `@Permissions` is required from its own module, because
 * the metadata it writes is what "states the route's permission" means and a double that wrote nothing
 * would have the comparison pass on two absences; `@Idempotent` likewise; and the base controller's
 * three lifecycle handlers are restated in the shape `packages/core/src/lib/core/crud/crud.controller.ts`
 * declares them, `delete` passing the service the bare identifier and the other two passing their rest
 * parameter as an ARRAY, because the real class reaches the entity graph.
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
		// The three inherited lifecycle routes, in the shape the kernel declares them: `delete` hands the
		// service the bare identifier, and the two soft routes hand it their rest parameter, which is an
		// empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}

			async delete(id: any): Promise<any> {
				return this.service.delete(id);
			}

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
		// The permission and retry decorators are the kernel's own: what this suite compares between a
		// route and the field that mirrors it is the metadata they write.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph. What the declarations
		// under test read is the metadata it writes, so that is what the double writes — on the kernel's own
		// key, taken from the kernel rather than restated as a string literal.
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
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

import { getMetadataStorage } from 'class-validator';
import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IDEMPOTENT_METADATA_KEY, PermissionGuard, TenantPermissionGuard, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CommerceCartController } from '../commerce-cart/commerce-cart.controller';
import { CommerceCartLineController } from '../commerce-cart-line/commerce-cart-line.controller';
import { CommerceCartPromotionController } from '../commerce-cart-promotion/commerce-cart-promotion.controller';
import { CommerceCartShippingMethodController } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.controller';
import { CommerceCheckoutSessionController } from '../commerce-checkout-session/commerce-checkout-session.controller';
import { CommerceCheckoutSessionDTO, UpdateCommerceCheckoutSessionDTO } from '../commerce-checkout-session/dto';
import { CommerceCartResolver } from './commerce-cart.resolver';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';
import { cartSchemaExtensions } from './schema-extensions';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000023';

/** What the version guard leaves on the request, which is what both surfaces' writes consume. */
const EXPECTATION = { wildcard: false, versions: [7] };

/** The request a versioned write runs against, and the GraphQL context built over the same one. */
const REQUEST = { versionExpectation: EXPECTATION };

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that recalcs a cart over GraphQL and one that
 * recalcs it over REST must be looking at the same record afterwards.
 */
const CART = { id: ID, version: 8, grandTotal: '42.000000' };
const SESSION = { id: ID, cartId: ID, status: 'IN_PROGRESS', completedSteps: ['SHIPPING'] };

/**
 * One of the four routes, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field the audit's name-based expectation resolves to, and the one this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The arguments the document declares, in order. */
	args: string[];
	/** The grant the route's own handler states. */
	grant: string;
	/** The service the capability belongs to, by the stub that owns it. */
	service: string;
	/** The method both surfaces must reach. */
	method: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The four routes no field answered.
 *
 * Each is a capability rather than a spare route: recomputing a cart whose lines have not changed, and
 * a session's own record, its step report and its removal — none of which any cart field reaches,
 * because the cart's `abandonCheckout` abandons the CART and the session's recoverable withdrawal keeps
 * the row the destructive delete removes.
 */
const PARITY: IParity[] = [
	{
		field: 'recalculateCommerceCart',
		route: 'recalculate',
		resource: 'CommerceCart',
		args: ['id', 'version'],
		grant: CART_PERMISSIONS.CARTS_EDIT,
		service: 'cart',
		method: 'recalculate',
		controller: CommerceCartController,
		resolver: CommerceCartResolver
	},
	{
		field: 'updateCommerceCheckoutSession',
		route: 'update',
		resource: 'CommerceCheckoutSession',
		args: ['id', 'input'],
		grant: CART_PERMISSIONS.CARTS_CHECKOUT,
		service: 'session',
		method: 'update',
		controller: CommerceCheckoutSessionController,
		resolver: CommerceCheckoutSessionResolver
	},
	{
		field: 'completeStepCommerceCheckoutSession',
		route: 'completeStep',
		resource: 'CommerceCheckoutSession',
		args: ['id', 'step', 'data', 'idempotencyKey'],
		grant: CART_PERMISSIONS.CARTS_CHECKOUT,
		service: 'session',
		method: 'completeStep',
		controller: CommerceCheckoutSessionController,
		resolver: CommerceCheckoutSessionResolver
	},
	{
		field: 'deleteCommerceCheckoutSession',
		route: 'delete',
		resource: 'CommerceCheckoutSession',
		args: ['id'],
		grant: CART_PERMISSIONS.CARTS_DELETE,
		service: 'session',
		method: 'delete',
		controller: CommerceCheckoutSessionController,
		resolver: CommerceCheckoutSessionResolver
	}
];

/**
 * The twenty-two routes the reading collapsed, each with the field that already serves it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is: the
 * first twelve are the cart's own routes served under the name the act has in this document, and the
 * last ten are a child resource's own addressing of an act the cart performs. The audit's expectation
 * for each — `<handler><resource>` — is asserted absent, so this table fails if a future wave renames
 * one of the serving fields out from under the routes that name it in their own docstrings.
 */
const COLLAPSED: { controller: new (...args: any[]) => any; resource: string; route: string; field: string }[] = [
	// The cart's own routes, served under the name this document gives the act.
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'create', field: 'createCart' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'update', field: 'updateCart' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'complete', field: 'completeCheckout' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'abandon', field: 'abandonCheckout' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'merge', field: 'mergeCarts' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'addLine', field: 'addCartLine' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'updateLine', field: 'updateCartLine' },
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'removeLine', field: 'removeCartLine' },
	{
		controller: CommerceCartController,
		resource: 'CommerceCart',
		route: 'setShippingMethod',
		field: 'setCartShippingMethod'
	},
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'applyPromotion', field: 'applyCartPromotion' },
	{
		controller: CommerceCartController,
		resource: 'CommerceCart',
		route: 'removePromotion',
		field: 'removeCartPromotion'
	},
	{ controller: CommerceCartController, resource: 'CommerceCart', route: 'delete', field: 'deleteCart' },
	// A line, an applied promotion and a delivery choice: children of the cart, reached through it.
	{ controller: CommerceCartLineController, resource: 'CommerceCartLine', route: 'create', field: 'addCartLine' },
	{ controller: CommerceCartLineController, resource: 'CommerceCartLine', route: 'update', field: 'updateCartLine' },
	{ controller: CommerceCartLineController, resource: 'CommerceCartLine', route: 'delete', field: 'removeCartLine' },
	{
		controller: CommerceCartPromotionController,
		resource: 'CommerceCartPromotion',
		route: 'create',
		field: 'applyCartPromotion'
	},
	{
		controller: CommerceCartPromotionController,
		resource: 'CommerceCartPromotion',
		route: 'update',
		field: 'applyCartPromotion'
	},
	{
		controller: CommerceCartPromotionController,
		resource: 'CommerceCartPromotion',
		route: 'delete',
		field: 'removeCartPromotion'
	},
	{
		controller: CommerceCartShippingMethodController,
		resource: 'CommerceCartShippingMethod',
		route: 'create',
		field: 'setCartShippingMethod'
	},
	{
		controller: CommerceCartShippingMethodController,
		resource: 'CommerceCartShippingMethod',
		route: 'update',
		field: 'setCartShippingMethod'
	},
	{
		controller: CommerceCartShippingMethodController,
		resource: 'CommerceCartShippingMethod',
		route: 'delete',
		field: 'removeCartShippingMethod'
	},
	// A session is started by the cart's own field, which is the field the route's body is addressed to.
	{
		controller: CommerceCheckoutSessionController,
		resource: 'CommerceCheckoutSession',
		route: 'create',
		field: 'startCheckout'
	}
];

/** The grant every one of these controllers and resolvers states at class level. */
const VIEW = CART_PERMISSIONS.CARTS_VIEW;

/**
 * Both surfaces over one stubbed service.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same arguments, and one stub per resource is what makes that visible without a
 * database behind it — which is also why the resolvers' other collaborators are stubbed as well: a
 * field that reached the wrong one would be visible as an assertion about the wrong service.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Map<string, Row>; controller: Row; resolver: Row } {
	const stubs = new Map<string, Row>([
		[
			'cart',
			{
				recalculate: jest.fn().mockResolvedValue(CART),
				delete: jest.fn().mockResolvedValue({ affected: 1 }),
				findOneByIdString: jest.fn().mockResolvedValue(CART)
			}
		],
		[
			'session',
			{
				update: jest.fn().mockResolvedValue({ affected: 1 }),
				completeStep: jest.fn().mockResolvedValue(SESSION),
				delete: jest.fn().mockResolvedValue({ affected: 1 }),
				findOneByIdString: jest.fn().mockResolvedValue(SESSION)
			}
		]
	]);

	// Every controller of this domain takes its own resource's service and hands it to the base class,
	// which is what the inherited routes call; the resolvers take the cart's service beside it.
	const service = stubs.get(entry.service) as Row;
	const controller = new entry.controller(service) as Row;
	const resolver =
		entry.resolver === CommerceCartResolver
			? (new entry.resolver(stubs.get('cart')) as Row)
			: (new entry.resolver(stubs.get('cart'), stubs.get('session')) as Row);

	return { stubs, controller, resolver };
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
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
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

/** What one route declared about retrying it. */
function idempotencyOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[handler]);
}

/** What one field declared about retrying it. */
function idempotencyOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field]);
}

/** What one route declared about the version it carries. */
function versioningOfRoute(controller: new (...args: any[]) => any, handler: string): unknown {
	return Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[handler]);
}

/** What one field declared about the version it carries. */
function versioningOfField(resolver: new (...args: any[]) => any, field: string): unknown {
	return Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field]);
}

/** The guards one surface runs under, the class chain first. */
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

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
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

/** The argument names a field declares, in the order the document states them. */
function argumentNamesOf(field: FieldDefinitionNode): string[] {
	return (field.arguments ?? []).map((argument) => argument.name.value);
}

/** The type name of one argument of a field, or the empty string when it declares none of that name. */
function argumentTypeOf(field: FieldDefinitionNode, name: string): string {
	const argument = (field.arguments ?? []).find((candidate) => candidate.name.value === name);

	return argument ? namedTypeName(argument.type) : '';
}

/** The members an `input` declaration carries, in the order the document states them. */
function inputMembers(name: string): string[] {
	const input = cartSchemaExtensions.definitions.find(
		(definition) => definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (input?.kind !== 'InputObjectTypeDefinition' || !input.fields?.length) {
		throw new Error(`the cart document declares no input named "${name}"`);
	}

	return input.fields.map((field) => field.name.value);
}

/**
 * The members a DTO declares itself, read from the validation metadata its own decorators wrote.
 *
 * Filtered by target rather than read wholesale: `getTargetValidationMetadatas` answers a class's
 * inherited declarations too, and the scope members this DTO's base carries — the tenant, the
 * organization, the organization object and `sentTo` — belong to the credential rather than to a body.
 * No input in this document states them, and a comparison that read them would demand that one did.
 *
 * @param dto The DTO to read.
 * @returns Its own members, sorted.
 */
function dtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage()
		.getTargetValidationMetadatas(dto, '', false, false)
		.filter((entry) => entry.target === dto);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * Every member a DTO's validation metadata names, its own and the ones it inherits.
 *
 * The wholesale read, needed for the update DTO: `PartialType` returns a class the declared DTO only
 * *extends*, so the metadata it copied carries the returned class as its target and an own-target read
 * of the declared one finds nothing at all.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function allDtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * The schema's half of the four fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the cart document — the four unserved write routes are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, `:id` and `:step` as identifiers and a body as an input', () => {
		for (const { field, args } of PARITY) {
			expect(argumentNamesOf(mutationField(field))).toEqual(args);
		}

		expect(argumentTypeOf(mutationField('recalculateCommerceCart'), 'id')).toBe('ID');
		// The version is the cart's, stated as a resolver argument because a GraphQL operation is always a
		// POST and a header could not say which of a document's mutations it belongs to.
		expect(argumentTypeOf(mutationField('recalculateCommerceCart'), 'version')).toBe('Int');

		expect(argumentTypeOf(mutationField('updateCommerceCheckoutSession'), 'input')).toBe(
			'UpdateCheckoutSessionInput'
		);

		// The step is a path member on the route and an argument here; the body it takes is an opaque
		// record on both surfaces, and the retry key the REST route reads from its header rides beside it.
		expect(argumentTypeOf(mutationField('completeStepCommerceCheckoutSession'), 'step')).toBe('String');
		expect(argumentTypeOf(mutationField('completeStepCommerceCheckoutSession'), 'data')).toBe('JSON');
		expect(argumentTypeOf(mutationField('completeStepCommerceCheckoutSession'), 'idempotencyKey')).toBe('String');
	});

	it('answers the row each route’s siblings answer', () => {
		// The three writes answer the row they wrote, which is what this resource's other mutations answer
		// (`startCheckout` answers `CheckoutSession!`, `updateCart` answers `Cart!`); the destructive delete
		// has no row left to answer with, so it answers the boolean this domain's `deleteCart` answers.
		expect(namedTypeOf(mutationField('recalculateCommerceCart'))).toBe('Cart');
		expect(namedTypeOf(mutationField('updateCommerceCheckoutSession'))).toBe('CheckoutSession');
		expect(namedTypeOf(mutationField('completeStepCommerceCheckoutSession'))).toBe('CheckoutSession');
		expect(namedTypeOf(mutationField('deleteCommerceCheckoutSession'))).toBe('Boolean');
	});

	it('carries the members the session update route’s own body declares', () => {
		// The route's body is `PartialType(CommerceCheckoutSessionDTO)`, so the members it accepts are the
		// session's own writable surface — the same five the document's input states, read from the DTO's
		// own decorators rather than restated here, so a member added to one surface and not the other
		// fails here rather than at the endpoint, where the argument would simply not exist. The members
		// the DTO inherits from the scope base are not among them: a tenant and an organization belong to
		// the credential rather than to a body, and no input in this document states them.
		expect(inputMembers('UpdateCheckoutSessionInput')).toEqual([
			'cartId',
			'status',
			'step',
			'completedSteps',
			'data'
		]);
		expect(inputMembers('UpdateCheckoutSessionInput').slice().sort()).toEqual(
			dtoMembers(CommerceCheckoutSessionDTO)
		);

		// And the route accepts every one of them, which is what makes the field a mirror of its body
		// rather than of a narrower surface this file happened to choose.
		for (const member of dtoMembers(CommerceCheckoutSessionDTO)) {
			expect(allDtoMembers(UpdateCommerceCheckoutSessionDTO)).toContain(member);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
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
			expect(declares(field)).toBe(true);
		}
	});
});

/**
 * The reading, asserted route by route.
 *
 * The instrument that produced the twenty-six is name-based, so its expectation for a route is
 * `<handler><resource>` — `addLine` on `CommerceCartController` is expected to be answered by
 * `addLineCommerceCart`, and it is not, because `addCartLine` answers it. That expectation is asserted
 * *absent* here and the field that really serves the route is asserted present: a table that only
 * listed the serving fields would keep passing if the audit's expectation were later satisfied by a
 * second door to one capability, which is the defect §3.1's "one capability, one door" reading forbids.
 */
describe('the twenty-two collapsed routes — served under another name, or through the cart', () => {
	it('collapses exactly twenty-six routes into twenty-two served and four delivered', () => {
		// The control: the table is the whole flagged set, so a route quietly dropped from it fails here.
		expect(COLLAPSED).toHaveLength(22);
		expect(PARITY).toHaveLength(4);
		expect(new Set(COLLAPSED.map(({ field, route }) => `${field}:${route}`)).size).toBe(22);
	});

	it.each(COLLAPSED)(
		'$route on $resource is served by $field, and not by the name the audit reads',
		({ resource, route, field }) => {
			const expected = `${route}${resource}`;

			expect(declares(field)).toBe(true);
			// And the name the audit expects is not declared, which is the other half of the statement: the
			// capability has one door, not two. A wave that added `addLineCommerceCart` beside `addCartLine`
			// would satisfy the instrument and doubly serve one act, and this assertion is what refuses it.
			expect(declares(expected)).toBe(false);

			// The four genuine routes are the only ones the audit's own expectation names, so a collapsed
			// route cannot be listed here as well.
			expect(PARITY.some((entry) => entry.field === expected)).toBe(false);
		}
	);

	it('names a handler on each controller for every route the table collapses', () => {
		for (const { controller, route } of COLLAPSED) {
			expect(typeof handlersOf(controller)[route]).toBe('function');
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on one stub, not a service method named in this file.
 */
describe('the four fields — the two protocols make the same call', () => {
	it('recomputes the cart the route recomputes, on the version the caller read', async () => {
		const { stubs, controller, resolver } = surfaces(PARITY[0]);
		const service = stubs.get('cart') as Row;

		const overRest = await controller.recalculate(ID, REQUEST);
		const overGraphql = await resolver.recalculateCommerceCart(ID, { req: REQUEST });

		// The reason code is the route's own — `MANUAL`, trigger 20 of the recalculation table — and both
		// surfaces spend the same expectation object the guard left on the request.
		expect(service.recalculate).toHaveBeenNthCalledWith(1, ID, 'MANUAL', EXPECTATION);
		expect(service.recalculate).toHaveBeenNthCalledWith(2, ID, 'MANUAL', EXPECTATION);
		expect(service.recalculate).toHaveBeenCalledTimes(2);
		expect(overGraphql).toBe(overRest);
	});

	it('amends the session the route amends, and answers the row the route’s siblings answer', async () => {
		const { stubs, controller, resolver } = surfaces(PARITY[1]);
		const service = stubs.get('session') as Row;
		const body = { status: 'IN_PROGRESS', step: 'PAYMENT' };

		const overRest = await controller.update(ID, body);
		const overGraphql = await resolver.updateCommerceCheckoutSession(ID, body);

		expect(service.update).toHaveBeenNthCalledWith(1, ID, body);
		expect(service.update).toHaveBeenNthCalledWith(2, ID, body);
		expect(service.update).toHaveBeenCalledTimes(2);

		// The route answers the ORM's update result; the field answers the row its siblings answer, read
		// back with the same base read the write itself performs as its precondition.
		expect(overRest).toEqual({ affected: 1 });
		expect(service.findOneByIdString).toHaveBeenCalledWith(ID);
		expect(overGraphql).toBe(SESSION);
	});

	it('reports the step the route reports, with the same key, and appends once', async () => {
		const { stubs, controller, resolver } = surfaces(PARITY[2]);
		const service = stubs.get('session') as Row;
		const data = { shippingMethodId: ID };

		const overRest = await controller.completeStep(ID, 'SHIPPING', data);
		const overGraphql = await resolver.completeStepCommerceCheckoutSession(ID, 'SHIPPING', data);

		expect(service.completeStep).toHaveBeenNthCalledWith(1, ID, 'SHIPPING', data);
		expect(service.completeStep).toHaveBeenNthCalledWith(2, ID, 'SHIPPING', data);
		expect(service.completeStep).toHaveBeenCalledTimes(2);
		expect(overGraphql).toBe(overRest);
	});

	it('deletes the session the route deletes', async () => {
		const { stubs, controller, resolver } = surfaces(PARITY[3]);
		const service = stubs.get('session') as Row;

		const overRest = await controller.delete(ID);
		const overGraphql = await resolver.deleteCommerceCheckoutSession(ID);

		expect(service.delete).toHaveBeenNthCalledWith(1, ID);
		expect(service.delete).toHaveBeenNthCalledWith(2, ID);
		expect(service.delete).toHaveBeenCalledTimes(2);

		// The route's own answer is passed on, which is the ORM's update result rather than a row.
		expect(overRest).toEqual({ affected: 1 });
		expect(overGraphql).toBe(true);
	});

	it('answers what this domain’s other destructive delete answers, over the same result', async () => {
		// `deleteCart` is the one deletion-shaped sibling this document already carried, and it answers
		// `Boolean!` because a deleted row is not there to answer with. The field is compared against it
		// rather than against a mapping restated here, so the two cannot drift into answering the same act
		// differently — and both outcomes are driven, because a mapping that always answered `true` would
		// pass on the interesting one alone.
		const { stubs, resolver } = surfaces(PARITY[3]);
		const cartResolver = new (CommerceCartResolver as any)(stubs.get('cart')) as Row;

		for (const [result, expected] of [
			[{ affected: 1 }, true],
			[undefined, false]
		] as [any, boolean][]) {
			(stubs.get('session') as Row).delete.mockResolvedValueOnce(result);
			(stubs.get('cart') as Row).delete.mockResolvedValueOnce(result);

			expect(await resolver.deleteCommerceCheckoutSession(ID)).toBe(expected);
			expect(await cartResolver.deleteCart(ID)).toBe(expected);
		}
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * `PermissionGuard` resolves handler-then-class, and every one of these controllers states the *view*
 * grant at class level — so a field that left the grant to its class would extend a read permission
 * into four writes: recomputing what a cart costs, moving a checkout forward, appending to its path and
 * destroying the session that points at a durable operation.
 */
describe('the four fields — the permission, the retry scope and the version are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not ungated, so the comparison below cannot pass on two absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant this domain declares for each act, which the route states and the class does not', () => {
		// Stated explicitly as well as by comparison, because the comparison above holds even if both
		// surfaces drifted to the same wrong grant: the class-level grant of every one of these controllers
		// and resolvers is the VIEW grant, which is not the grant of any field below.
		expect(new Set(PARITY.map(({ grant }) => grant)).size).toBe(3);

		for (const { field, route, controller, resolver, grant } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([VIEW]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([VIEW]);
		}
	});

	it('mirrors the retry scope of the one route that declares one, and declares none elsewhere', () => {
		// The step report is the only one of the four a client is expected to repeat, and the controller's
		// own docstring says so. A keyless GraphQL retry would not dedupe where the REST route does.
		expect(idempotencyOfRoute(CommerceCheckoutSessionController, 'completeStep')).toEqual({
			scope: 'checkout.step.complete',
			required: false,
			resourceType: 'checkout_session'
		});
		expect(idempotencyOfField(CommerceCheckoutSessionResolver, 'completeStepCommerceCheckoutSession')).toEqual(
			idempotencyOfRoute(CommerceCheckoutSessionController, 'completeStep')
		);

		for (const { field, route, controller, resolver } of PARITY.filter(
			(entry) => entry.field !== 'completeStepCommerceCheckoutSession'
		)) {
			expect(idempotencyOfRoute(controller, route)).toBeUndefined();
			expect(idempotencyOfField(resolver, field)).toBeUndefined();
		}
	});

	it('mirrors the version expectation of the one route that declares one, and declares none elsewhere', () => {
		// Recomputing a cart writes the totals columns and the version they belong to in one statement, so
		// the caller states the version it read — the route declares the cart's service as the reader, and
		// the field names the same one.
		const route = versioningOfRoute(CommerceCartController, 'recalculate') as Row;
		const field = versioningOfField(CommerceCartResolver, 'recalculateCommerceCart') as Row;

		expect(route?.resource).toBeDefined();
		expect(field?.resource).toBe(route?.resource);
		expect(field?.required).toBe(route?.required);
		expect(field?.write).toBe(route?.write);

		for (const { field: name, route: handler, controller, resolver } of PARITY.filter(
			(entry) => entry.field !== 'recalculateCommerceCart'
		)) {
			expect(versioningOfRoute(controller, handler)).toBeUndefined();
			expect(versioningOfField(resolver, name)).toBeUndefined();
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(CommerceCartController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			// The versioned field's own guard is mounted by `@Versioned` itself and is not part of this
			// chain; what is compared here is that every field carries the class chain its routes carry, so a
			// caller that could reach a route cannot be answered by a field that skipped its guards.
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(routeGuards));
		}
	});
});
