/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on all ten resources of this plugin (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and every
 * controller of this package extends `CrudController<T>` and **overrides both routes purely to attach a
 * permission**, because the base declares them with no `@Permissions` metadata of its own. So all ten
 * resources serve a gated withdraw/restore pair over REST, and not one resolver of this plugin declared
 * either field: a client could retire a provider registration, a collection, an attempt, a capture, a
 * refund, a reason, a line of a breakdown, an inbound callback, an account at a provider or a saved
 * instrument over REST and had no field to ask for any of them here.
 *
 * **One table, twenty fields.** The ten resources differ only in their names, their permissions, their
 * payload member and where their own service sits in their resolver's constructor, so each of those is a
 * column rather than a copy of the suite. Three properties are pinned for every field:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the payload
 *   type its own pair answers with, because a field the document does not carry is one no client can
 *   select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated from
 *   the assignment, so a caller holding only the class-level view grant is refused exactly as the route
 *   refuses it — and the grant the override states is asserted beside the comparison, since that is the
 *   one a reader will look for;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **The pair is not one grant for the whole plugin.** The overrides were read one controller at a time
 * rather than assumed: a capture's pair carries `PAYMENT_SESSIONS_CAPTURE`, a collection's
 * `PAYMENT_SESSIONS_AUTHORIZE`, a session's `PAYMENT_SESSIONS_CANCEL`, an inbound callback's
 * `PAYMENT_CALLBACKS_REPROCESS`, a provider registration's `PAYMENT_PROVIDERS_DELETE`, the account's and
 * the instrument's the two edit grants the kernel catalogue publishes for them, and the refund, the
 * reason and the breakdown line `REFUNDS_CREATE`. The grant is asserted per resource below, so a field
 * that copied its neighbour's would fail here rather than pass on a family-wide guess.
 *
 * **Nothing is doubled here but the services.** The ten controllers are the real ones — the `softRemove`
 * and `softRecover` overrides included, which exist to state the permission the inherited routes leave
 * unstated (and, for the account at a provider, to retire it through the kernel's guarded removal
 * rather than the generic one) — the ten resolvers are the real ones with their own decorators and
 * signatures, the `CrudController` behind them is restated in the shape the kernel declares it (the two lifecycle
 * handlers hand the service their rest parameter as an ARRAY, which is what makes the REST call and the
 * GraphQL call comparable at all), and the document the fields are read out of is the real one. Every
 * other collaborator is a stub of its own rather than a copy of the one under test, so a field that
 * reached the wrong service is visible instead of passing on a shared double.
 *
 * `@gauzy/core`'s barrel is doubled for the reason the package's other resolver specs state — it boots
 * the whole application graph, which no declaration here needs — and the two pieces of it this suite
 * actually compares are the kernel's own: `@Permissions` is required from its own module, because the
 * metadata it writes is what "states the route's permission" means and a double that wrote nothing would
 * have the comparison pass on two absences; and the base controller's two lifecycle handlers are
 * restated in the shape `packages/core/src/lib/core/crud/crud.controller.ts` declares them.
 */

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

// The ten collaborators the controllers and resolvers inject are doubled, so nothing below the surface
// is loaded: this suite is about the two declarations and the one call each of them makes.
jest.mock('../payment-provider/payment-provider.service', () => ({
	PaymentProviderService: class PaymentProviderService {}
}));
jest.mock('../payment-collection/payment-collection.service', () => ({
	PaymentCollectionService: class PaymentCollectionService {}
}));
jest.mock('../payment-session/payment-session.service', () => ({
	PaymentSessionService: class PaymentSessionService {}
}));
jest.mock('../payment-capture/payment-capture.service', () => ({
	PaymentCaptureService: class PaymentCaptureService {}
}));
jest.mock('../refund/refund.service', () => ({ RefundService: class RefundService {} }));
jest.mock('../refund-line/refund-line.service', () => ({ RefundLineService: class RefundLineService {} }));
jest.mock('../refund-reason/refund-reason.service', () => ({ RefundReasonService: class RefundReasonService {} }));
jest.mock('../payment-webhook-event/payment-webhook-event.service', () => ({
	PaymentWebhookEventService: class PaymentWebhookEventService {}
}));
jest.mock('../payment-account-holder/payment-account-holder-lifecycle.service', () => ({
	PaymentAccountHolderLifecycleService: class PaymentAccountHolderLifecycleService {}
}));
jest.mock('../payment-method-token/payment-method-token-lifecycle.service', () => ({
	PaymentMethodTokenLifecycleService: class PaymentMethodTokenLifecycleService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		// The two routes this suite is about, in the shape the kernel declares them: the handler hands the
		// service its rest parameter, which is an empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly crudService: any) {}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRecover(id, options);
			}
		},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		// The permission decorator is the kernel's own: what this suite compares between a route and the
		// field that mirrors it is the metadata it writes.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		// Every resolver class carries the platform's feature guard, so the double provides the class the
		// resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class FeatureFlagGuard {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		VisibleWith: decorator,
		FieldVisibility: class FieldVisibility {},
		// The connection helpers the list fields page and answer with are the kernel's own, taken from the
		// kernel rather than restated: `connection.ts` reaches `connectionFromOffsetPage` through this
		// barrel, so a double that dropped it would fail the import rather than an assertion.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		// The four kernel classes the controllers and the two stored-instrument resolvers name in their
		// constructor signatures — TypeScript emits them as the injection metadata, so they have to exist.
		Payment: class Payment {},
		Integration: class Integration {},
		PaymentAccountHolder: class PaymentAccountHolder {},
		PaymentMethodToken: class PaymentMethodToken {},
		PaymentAccountHolderService: class PaymentAccountHolderService {},
		PaymentMethodTokenService: class PaymentMethodTokenService {},
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
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		}
	};
});

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { BadRequestException } from '@nestjs/common';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import { PaymentProviderController } from '../payment-provider/payment-provider.controller';
import { PaymentCollectionController } from '../payment-collection/payment-collection.controller';
import { PaymentSessionController } from '../payment-session/payment-session.controller';
import { PaymentCaptureController } from '../payment-capture/payment-capture.controller';
import { RefundController } from '../refund/refund.controller';
import { RefundReasonController } from '../refund-reason/refund-reason.controller';
import { RefundLineController } from '../refund-line/refund-line.controller';
import { PaymentWebhookEventController } from '../payment-webhook-event/payment-webhook-event.controller';
import { PaymentAccountHolderController } from '../payment-account-holder/payment-account-holder.controller';
import { PaymentMethodTokenController } from '../payment-method-token/payment-method-token.controller';
import { schemaExtensions } from './schema-extensions';
import { PaymentProviderResolver } from './resolvers/payment-provider.resolver';
import { PaymentCollectionResolver } from './resolvers/payment-collection.resolver';
import { PaymentSessionResolver } from './resolvers/payment-session.resolver';
import { PaymentCaptureResolver } from './resolvers/payment-capture.resolver';
import { RefundResolver } from './resolvers/refund.resolver';
import { RefundReasonResolver } from './resolvers/refund-reason.resolver';
import { RefundLineResolver } from './resolvers/refund-line.resolver';
import { PaymentWebhookEventResolver } from './resolvers/payment-webhook-event.resolver';
import { PaymentAccountHolderResolver } from './resolvers/payment-account-holder.resolver';
import { PaymentMethodTokenResolver } from './resolvers/payment-method-token.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000f1';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a refund over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/**
 * What a collaborator other than the resource's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/** The collaborators each resolver's constructor takes, in order, as this suite names them. */
const RESOLVER_DEPS: Readonly<Record<string, readonly string[]>> = {
	PaymentProviderResolver: ['provider'],
	PaymentCollectionResolver: ['collection'],
	PaymentSessionResolver: ['session'],
	PaymentCaptureResolver: ['capture'],
	RefundResolver: ['refund', 'refundLine'],
	RefundReasonResolver: ['reason'],
	RefundLineResolver: ['line'],
	PaymentWebhookEventResolver: ['event'],
	PaymentAccountHolderResolver: ['accountHolder', 'accountHolders', 'accountHolderTokens'],
	PaymentMethodTokenResolver: ['tokenLifecycle', 'visibility', 'token']
};

/** One of the ten resources, its two surfaces and the service that owns it. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields and the payloads are built from. */
	name: string;
	/** The member its payload carries the row under, which is what its sibling mutations answer with. */
	member: string;
	/** The grant its own routes state on both overrides, which is what its fields must state. */
	edit: string;
	/** The grant its controller states at class level, which no field may leave the act to. */
	view: string;
	/** The collaborators its resolver takes, in constructor order. */
	deps: readonly string[];
	/** Which of those collaborators owns the resource — and is the one the controller hands to the base. */
	service: string;
	/**
	 * The collaborators its controller takes, in constructor order, when that is more than its own
	 * service. Absent means the controller takes the resource's service alone.
	 */
	controllerDeps?: readonly string[];
	/**
	 * The collaborator both surfaces retire the row through, when that is not the resource's own CRUD
	 * service. Absent means the generic soft delete the base class maps.
	 */
	softDeleteOwner?: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The ten resources whose inherited lifecycle routes had no GraphQL counterpart.
 *
 * Every row states the grant **its own two overrides** state, read off the controller rather than
 * inferred from the family: the plugin's ten resources carry eight distinct grants between them, and
 * three of the ten — the refund, its reason and its breakdown line — share one.
 */
const RESOURCES: IResource[] = [
	{
		name: 'PaymentProvider',
		member: 'paymentProvider',
		edit: PaymentPermission.PAYMENT_PROVIDERS_DELETE,
		view: PaymentPermission.PAYMENT_PROVIDERS_VIEW,
		deps: RESOLVER_DEPS.PaymentProviderResolver,
		service: 'provider',
		controller: PaymentProviderController,
		resolver: PaymentProviderResolver
	},
	{
		name: 'PaymentCollection',
		member: 'paymentCollection',
		// The collection's pair carries the authorisation grant rather than a delete one: the controller
		// states `PAYMENT_SESSIONS_AUTHORIZE` on both routes, because a collection is withdrawn by the
		// same authority that opens one.
		edit: PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
		view: PaymentPermission.PAYMENT_SESSIONS_VIEW,
		deps: RESOLVER_DEPS.PaymentCollectionResolver,
		service: 'collection',
		controller: PaymentCollectionController,
		resolver: PaymentCollectionResolver
	},
	{
		name: 'PaymentSession',
		member: 'paymentSession',
		// The attempt's pair carries the cancellation grant, because withdrawing an attempt is what the
		// void route does to the authorisation it holds.
		edit: PaymentPermission.PAYMENT_SESSIONS_CANCEL,
		view: PaymentPermission.PAYMENT_SESSIONS_VIEW,
		deps: RESOLVER_DEPS.PaymentSessionResolver,
		service: 'session',
		controller: PaymentSessionController,
		resolver: PaymentSessionResolver
	},
	{
		name: 'PaymentCapture',
		member: 'paymentCapture',
		// Taking money is not the same act as reserving it, and withdrawing the row that recorded the
		// taking is the same grant as writing it.
		edit: PaymentPermission.PAYMENT_SESSIONS_CAPTURE,
		view: PaymentPermission.PAYMENT_SESSIONS_VIEW,
		deps: RESOLVER_DEPS.PaymentCaptureResolver,
		service: 'capture',
		controller: PaymentCaptureController,
		resolver: PaymentCaptureResolver
	},
	{
		name: 'Refund',
		member: 'refund',
		edit: PaymentPermission.REFUNDS_CREATE,
		view: PaymentPermission.REFUNDS_VIEW,
		deps: RESOLVER_DEPS.RefundResolver,
		service: 'refund',
		controller: RefundController,
		resolver: RefundResolver
	},
	{
		name: 'RefundReason',
		member: 'refundReason',
		edit: PaymentPermission.REFUNDS_CREATE,
		view: PaymentPermission.REFUNDS_VIEW,
		deps: RESOLVER_DEPS.RefundReasonResolver,
		service: 'reason',
		controller: RefundReasonController,
		resolver: RefundReasonResolver
	},
	{
		name: 'RefundLine',
		member: 'refundLine',
		edit: PaymentPermission.REFUNDS_CREATE,
		view: PaymentPermission.REFUNDS_VIEW,
		deps: RESOLVER_DEPS.RefundLineResolver,
		service: 'line',
		controller: RefundLineController,
		resolver: RefundLineResolver
	},
	{
		name: 'PaymentWebhookEvent',
		member: 'paymentWebhookEvent',
		// The callback log's pair carries the reprocessing grant: withdrawing or restoring a row of the
		// log is an act on the log, not a read of it.
		edit: PaymentPermission.PAYMENT_CALLBACKS_REPROCESS,
		view: PaymentPermission.PAYMENT_CALLBACKS_VIEW,
		deps: RESOLVER_DEPS.PaymentWebhookEventResolver,
		service: 'event',
		controller: PaymentWebhookEventController,
		resolver: PaymentWebhookEventResolver
	},
	{
		name: 'PaymentAccountHolder',
		member: 'paymentAccountHolder',
		// The stored-instrument grants are the kernel catalogue's own values, resolved through the
		// platform enum rather than minted here.
		edit: PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT,
		view: PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW,
		deps: RESOLVER_DEPS.PaymentAccountHolderResolver,
		service: 'accountHolder',
		controllerDeps: ['accountHolder', 'accountHolders'],
		// An account is retired through the kernel's guarded removal, which refuses one that is not
		// `DISABLED` with `PAYMENT_ACCOUNT_HOLDER_IN_USE`, and never through the base class's generic soft
		// delete, which hid a live account from under the instruments still pointing at it. The lifecycle
		// service is where both surfaces reach it, with the identifier alone.
		softDeleteOwner: 'accountHolders',
		controller: PaymentAccountHolderController,
		resolver: PaymentAccountHolderResolver
	},
	{
		name: 'PaymentMethodToken',
		member: 'paymentMethodToken',
		edit: PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT,
		view: PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW,
		deps: RESOLVER_DEPS.PaymentMethodTokenResolver,
		// The instrument's own kernel service is the resolver's third collaborator, beside the lifecycle
		// sequencer and the field-visibility decision — and it is the service the controller hands to
		// `CrudController`, which is what makes the two surfaces' calls comparable.
		service: 'token',
		controller: PaymentMethodTokenController,
		resolver: PaymentMethodTokenResolver
	}
];

/** One root field, the inherited route it mirrors, the service method and the payload it answers with. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
	payload: string;
	/** The collaborator both surfaces call for this act. */
	owner: string;
	/** What the route hands that collaborator after the identifier. */
	routeArgs: unknown[];
}

/**
 * The twenty fields, built from the ten resources so a resource cannot be listed with half a pair.
 *
 * The naming is the composed schema's: the act is `softDelete<Resource>` on the way out and
 * `recover<Resource>` on the way back, which is the vocabulary the schema's other fields of this kind
 * use — `recover*` and never `restore*`, which §10's naming table asks for and exactly one delivered
 * field carries.
 */
const PARITY: IParity[] = RESOURCES.flatMap((resource) => [
	{
		...resource,
		field: `softDelete${resource.name}`,
		route: 'softRemove',
		method: 'softRemove',
		payload: `SoftDelete${resource.name}Payload`,
		owner: resource.softDeleteOwner ?? resource.service,
		// The inherited route hands the base's service its rest parameter, an empty ARRAY; a route that
		// reaches a domain method of its own hands it the identifier alone.
		routeArgs: resource.softDeleteOwner ? [] : [[]]
	},
	{
		...resource,
		field: `recover${resource.name}`,
		route: 'softRecover',
		method: 'softRecover',
		payload: `Recover${resource.name}Payload`,
		owner: resource.service,
		routeArgs: [[]]
	}
]);

/**
 * Both surfaces over one stubbed service, with a stub of its own on every other collaborator.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind it.
 * The other collaborators answer with a different row, so a field that reached one of them instead is
 * caught by the identity assertion rather than hidden behind a shared double.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the other collaborators, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { service: Row; others: Row[]; controller: Row; resolver: Row } {
	const service: Row = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};
	const stubs = new Map<string, Row>();

	for (const name of entry.deps) {
		stubs.set(
			name,
			name === entry.owner
				? service
				: {
						softRemove: jest.fn().mockResolvedValue(FOREIGN),
						softRecover: jest.fn().mockResolvedValue(FOREIGN)
					}
		);
	}

	return {
		service,
		others: [...stubs.entries()].filter(([name]) => name !== entry.owner).map(([, stub]) => stub),
		// Every controller of this domain takes the resource's own service first and hands it to the base
		// class, which is what the two inherited routes call. The account's controller also takes the
		// lifecycle service its soft delete reaches, so it is built with both, in its constructor order.
		controller: new entry.controller(
			...(entry.controllerDeps ?? [entry.service]).map((name) => stubs.get(name))
		) as Row,
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

/**
 * The feature codes one handler is gated on, as the feature guards read them: the codes stated on the
 * handler when it states any, and otherwise the codes stated on its class.
 *
 * A target holds one code as the bare code and several as a list, so both shapes are read here rather
 * than through the decorator's own reader: the assertion that uses this must not depend on the code it
 * is checking.
 */
function featureFlagsOn(surface: new (...args: any[]) => any, handler: string): unknown[] {
	const read = (value: unknown): unknown[] =>
		value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
	const own = read(Reflect.getMetadata(FEATURE_METADATA, handlersOf(surface)[handler]));

	return own.length ? own : read(Reflect.getMetadata(FEATURE_METADATA, surface));
}

/** The root mutation type's own field declarations, as the document spells them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the payment document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the payment document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One named type declaration of the document, as the document spells it. */
function typeDefinition(name: string): ObjectTypeDefinitionNode {
	const definition = schemaExtensions.definitions.find(
		(candidate): candidate is ObjectTypeDefinitionNode =>
			candidate.kind === 'ObjectTypeDefinition' && candidate.name.value === name
	);

	if (!definition) {
		throw new Error(`the payment document declares no type named "${name}"`);
	}

	return definition;
}

/** The members of one object type, as a client reads them. */
function membersOf(name: string): string[] {
	return (typeDefinition(name).fields ?? []).map((field) => field.name.value);
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
describe('the payment document — the ten inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName(arguments_[0].type)).toBe('ID');
		}
	});

	it('answers each field with the payload of its own act, and each payload with the row it acted on', () => {
		for (const { field, payload, member } of PARITY) {
			// The payload type is named after the act, and the declaration is non-null: every sibling
			// mutation of this document answers one, and a nullable payload would make a client defend
			// against a state the resolver never produces.
			expect(namedTypeOf(mutationField(field))).toBe(payload);
			expect(mutationField(field).type.kind).toBe('NonNullType');

			// The payload carries the row under the member the resource's siblings use, plus the two
			// members this document's payload convention adds: the operation and the userErrors.
			expect(membersOf(payload)).toEqual([member, 'operation', 'userErrors']);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createPaymentProvider',
			'updatePaymentProvider',
			'deletePaymentProvider',
			'createPaymentCollection',
			'updatePaymentCollection',
			'openPaymentSession',
			'authorizePaymentSession',
			'voidPaymentSession',
			'capturePayment',
			'createRefund',
			'updateRefund',
			'approveRefund',
			'cancelRefund',
			'createRefundReason',
			'updateRefundReason',
			'deleteRefundReason',
			'createRefundLine',
			'updateRefundLine',
			'deleteRefundLine',
			'reprocessPaymentWebhookEvent',
			'createPaymentAccountHolder',
			'updatePaymentAccountHolder',
			'verifyPaymentAccountHolder',
			'deletePaymentAccountHolder',
			'createPaymentMethodToken',
			'setDefaultPaymentMethodToken',
			'revokePaymentMethodToken'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('declares the twenty fields of the pair and no other field of that shape', () => {
		// A count rather than a list, because the list above is the table: this is the assertion that the
		// document carries nothing else spelled like the pair, so a field added under a name no resource
		// declares — or a second spelling of one that is already there — is reported here.
		const shaped = mutationFields()
			.map((field) => field.name.value)
			.filter((name) => name.startsWith('softDelete') || name.startsWith('recover'));

		expect(shaped).toHaveLength(20);
		expect(shaped.sort()).toEqual(PARITY.map(({ field }) => field).sort());
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is the specification's own naming table being followed. A second spelling here would
		// be a second vocabulary for one capability, and a client that guessed the other one would find no
		// field rather than an error it could act on.
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
		const { service, others, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](ID);
		const overGraphql = await resolver[entry.field](ID);

		// The inherited route hands over its rest parameter, which is an empty ARRAY, and the service
		// normalises both that and an absent argument to "no find options" — so the two are one call. The
		// account's soft delete reaches a domain method, which both surfaces hand the identifier alone.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, ...entry.routeArgs);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on
		// the wrong aggregate, and the payload would carry whatever that one returned.
		for (const other of others) {
			expect(other.softRemove).not.toHaveBeenCalled();
			expect(other.softRecover).not.toHaveBeenCalled();
		}

		// One answer, one implementation: the row either surface acted on is the same row, and it is the
		// one the resource's own service returned rather than a foreign stub's.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql[entry.member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it.each(PARITY)('$field reports a refusal where this plugin reports it: in userErrors', async (entry) => {
		const { service, controller, resolver } = surfaces(entry);
		const refusal = new BadRequestException('PAYMENT_RESOURCE_IN_USE: the row is still referenced.');

		// The route answers the refusal as the transport error it is. The refusal is armed for one call at
		// a time, because the two surfaces are driven one after the other over one stub.
		service[entry.method].mockRejectedValueOnce(refusal);

		await expect(controller[entry.route](ID)).rejects.toBe(refusal);

		// ...and the field answers the same refusal as a successful operation with something to report,
		// which is the convention every other mutation of this document follows: a client branches on
		// userErrors and reads the row member, and never has to parse a message to know what happened.
		service[entry.method].mockRejectedValueOnce(refusal);

		await expect(resolver[entry.field](ID)).resolves.toMatchObject({
			[entry.member]: null,
			userErrors: [{ code: 'PAYMENT_RESOURCE_IN_USE' }]
		});
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is a write in both directions — a soft delete takes a row out of every read that does not ask
 * for retired rows, and a recover puts it back into the counts, the windows and the figures computed
 * from it — so a field that left the grant to its class would extend a read permission into a write.
 * That is the defect the controllers' own overrides exist to close on the other surface, and the one a
 * GraphQL caller would otherwise reach it through.
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

	it('demands the grant the twenty overrides state, which is never the class-level one', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for, and
		// because the ten resources do not share one grant: a field that copied its neighbour's would pass
		// the comparison above on its own controller and fail here.
		for (const { field, route, controller, resolver, edit, view } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([edit]);
			expect(permissionOfRoute(controller, route)).toEqual([edit]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([view]);
			expect(edit).not.toEqual(view);

			// The resolver classes state no permission of their own — every root field of this package
			// states its own — so the declaration on the field is the only thing between the act and
			// `PermissionGuard`'s `isEmpty(permissions)` branch, which allows a request outright. The
			// assertion on the class is what makes the assertion on the field mean something.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toBeUndefined();
		}
	});

	it('states the eight grants the ten controllers were read to state', () => {
		// The table above is the mapping this suite asserts; this is the shape of it. Ten resources, eight
		// grants: three of them — the refund, its reason and its line — share `REFUNDS_CREATE`, and the
		// other seven each state the grant their own routes carry. Reading this set is how a reader finds
		// out that the pair is not one family-wide permission without opening ten controllers.
		expect(new Set(PARITY.map(({ edit }) => edit))).toEqual(
			new Set([
				PaymentPermission.PAYMENT_PROVIDERS_DELETE,
				PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE,
				PaymentPermission.PAYMENT_SESSIONS_CANCEL,
				PaymentPermission.PAYMENT_SESSIONS_CAPTURE,
				PaymentPermission.PAYMENT_CALLBACKS_REPROCESS,
				PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT,
				PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT,
				PaymentPermission.REFUNDS_CREATE
			])
		);
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of PARITY) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

			// The resolver's chain adds the platform's feature gate, after the permission guards: a field
			// is refused as a credential problem before a tenant's switches are consulted. Asserted as a
			// superset of the route's chain, plus the gate's own presence, because the two surfaces do not
			// have to carry an identical list — the resolver must not carry a weaker one.
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
			expect(guardsOf(resolver, field)).toContain(FeatureFlagGuard);
		}
	});

	it('gates every field on the feature codes its route is gated on, and on the GraphQL endpoint', () => {
		// A field whose route is refused while a capability is switched off must be refused with it: a
		// resolver that stated only the endpoint's code kept a plugin's writes reachable over GraphQL while
		// its REST routes answered 404. This plugin's routes state no code of their own — `FEATURE_PAYMENT`
		// is deliberately not a gate on them, for the reasons `payment.features.ts` records — so the fields
		// state the endpoint's code and nothing else. A code added to a controller later fails here until
		// its resolver states it too.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(new Set(featureFlagsOn(resolver, field))).toEqual(
				new Set([...featureFlagsOn(controller, route), FEATURE_GRAPHQL])
			);
		}

		// The same holds for every other field of the ten resolvers, measured against the codes their
		// controller states for the whole resource.
		for (const { controller, resolver } of RESOURCES) {
			const required = [...featureFlagsOn(controller, 'findAll'), FEATURE_GRAPHQL];

			for (const field of Object.getOwnPropertyNames(resolver.prototype)) {
				// Methods only: the constructor is not a field, and an accessor is not read through its getter.
				const member = Object.getOwnPropertyDescriptor(resolver.prototype, field);

				if (field === 'constructor' || typeof member?.value !== 'function') {
					continue;
				}

				expect(featureFlagsOn(resolver, field)).toEqual(expect.arrayContaining(required));
			}
		}
	});
});

/**
 * The other half of the same rule: these twenty fields are the whole of what this plugin owes.
 *
 * §3.1 states the relation over the controllers, not over a list of resources someone maintains, so the
 * relation is restated here the way the gate states it: every controller of this package that overrides
 * the pair must have both fields declared for it. The ten are every controller the package declares
 * today, so a new resource arriving with the pair and no field fails here rather than only in the
 * repository-wide check.
 */
describe('the soft-delete pair — every controller that serves it is answered', () => {
	it('declares both fields for every controller of this plugin that overrides both routes', () => {
		const declared = new Set(mutationFields().map((field) => field.name.value));
		const answered: string[] = [];

		for (const controller of [
			PaymentProviderController,
			PaymentCollectionController,
			PaymentSessionController,
			PaymentCaptureController,
			RefundController,
			RefundReasonController,
			RefundLineController,
			PaymentWebhookEventController,
			PaymentAccountHolderController,
			PaymentMethodTokenController
		]) {
			// The overrides are the plugin's own, so `hasOwnProperty` is what separates a controller that
			// means to gate the pair from one that merely inherits it from the base — and it is also what
			// says the pair is the *plugin's* obligation: this package has no controller that leaves both
			// routes to the base class.
			const overrides = ['softRemove', 'softRecover'].every((route) =>
				Object.prototype.hasOwnProperty.call(controller.prototype, route)
			);

			expect(overrides).toBe(true);

			const resource = controller.name.replace(/Controller$/, '');
			answered.push(resource);

			expect(declared).toContain(`softDelete${resource}`);
			expect(declared).toContain(`recover${resource}`);
		}

		expect(answered).toHaveLength(RESOURCES.length);
		expect(answered.sort()).toEqual(RESOURCES.map(({ name }) => name).sort());
	});
});
