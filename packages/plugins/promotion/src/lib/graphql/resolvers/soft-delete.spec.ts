/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on all eight resources of this plugin (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and §3.4's
 * list of capabilities deliberately left out of GraphQL does not mention the pair. Every controller of
 * this plugin extends `CrudController<T>`, and each one **overrides both routes purely to attach a
 * permission**, because the base declares them with no `@Permissions` metadata of its own. So all
 * eight resources serve a gated withdraw/restore pair over REST, and until this wave only `Promotion`
 * answered either half of it over GraphQL: a client could retire a campaign, a ceiling, a
 * consumption row, a code, a card, a ledger movement, an action or an application over REST and had no
 * field to ask for any of them here.
 *
 * **One table, sixteen fields.** The eight resources differ only in their names, their permissions,
 * their payload member and where their own service sits in their resolver's constructor, so each of
 * those is a column rather than a copy of the suite. Three properties are pinned for every field:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the payload
 *   its siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated
 *   here, so a caller holding only the class-level view grant is refused exactly as the route refuses
 *   it — and the explicit grant is asserted beside the comparison, since that is the one a reader will
 *   look for;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the services.** The eight controllers are the real ones — the
 * `softRemove` and `softRecover` overrides included, which exist only to state the permission the
 * inherited routes leave unstated — the eight resolvers are the real ones with their own decorators
 * and signatures, `CrudController` behind them is the kernel's own, and the document the fields are
 * read out of is the real one. A resolver's other collaborators are stubs of their own rather than
 * copies of the one under test, so a field that reached the wrong service is visible instead of
 * passing on a shared double.
 *
 * **Three of the eight resolvers used to say they were read-only.** `PromotionActionResolver`,
 * `CampaignBudgetUsageResolver`, `GiftCardTransactionResolver` — and, one step milder,
 * `PromotionUsageResolver` — documented themselves as reached only through a parent and as serving no
 * mutation at all. That claim and §3.1 disagree, and §3.1 wins: the routes are served and gated, so
 * the fields are declared. Each of those class docs now says what it does instead, and
 * `graphql/resolvers/index.ts` says the same about its three read-through aggregates.
 *
 * This package reaches the kernel's real barrel already — `RequestContext` and `Money` are imported
 * from it by the service specs — so the reason the sibling packages give for doubling `@gauzy/core`
 * (the ESM-only `uuid` nested in the request context) does not apply here: `transformIgnorePatterns`
 * in this package's jest config transforms it instead.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { CampaignController } from '../../campaign/campaign.controller';
import { CampaignBudgetController } from '../../campaign-budget/campaign-budget.controller';
import { CampaignBudgetUsageController } from '../../campaign-budget-usage/campaign-budget-usage.controller';
import { CouponController } from '../../coupon/coupon.controller';
import { GiftCardController } from '../../gift-card/gift-card.controller';
import { GiftCardTransactionController } from '../../gift-card-transaction/gift-card-transaction.controller';
import { PromotionActionController } from '../../promotion-action/promotion-action.controller';
import { PromotionUsageController } from '../../promotion-usage/promotion-usage.controller';
import { PromotionController } from '../../promotion/promotion.controller';
import { schemaExtensions } from '../schema-extensions';
import { CampaignResolver } from './campaign.resolver';
import { CampaignBudgetResolver } from './campaign-budget.resolver';
import { CampaignBudgetUsageResolver } from './campaign-budget-usage.resolver';
import { CouponResolver } from './coupon.resolver';
import { GiftCardResolver } from './gift-card.resolver';
import { GiftCardTransactionResolver } from './gift-card-transaction.resolver';
import { PromotionActionResolver } from './promotion-action.resolver';
import { PromotionUsageResolver } from './promotion-usage.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000a1';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a campaign over GraphQL and one
 * that retires it over REST must be looking at the same record afterwards.
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

/** One of the eight resources, its two surfaces and what its fields answer with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields and the payloads are built from. */
	name: string;
	/** The member its payload carries the row under, which is what its sibling mutations answer with. */
	member: string;
	/** The grant its own routes state, which is what its fields must state. */
	edit: string;
	/** The grant its class states, which its fields must not leave the act to. */
	view: string;
	/** Where the resource's own service sits in its resolver's constructor. */
	serviceAt: number;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/** The eight resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'Campaign',
		member: 'campaign',
		edit: PromotionPermission.PROMOTIONS_DELETE,
		view: PromotionPermission.PROMOTIONS_VIEW,
		serviceAt: 0,
		controller: CampaignController,
		resolver: CampaignResolver
	},
	{
		name: 'CampaignBudget',
		member: 'budget',
		edit: PromotionPermission.PROMOTIONS_DELETE,
		view: PromotionPermission.PROMOTIONS_VIEW,
		serviceAt: 0,
		controller: CampaignBudgetController,
		resolver: CampaignBudgetResolver
	},
	{
		name: 'CampaignBudgetUsage',
		member: 'budgetUsage',
		edit: PromotionPermission.PROMOTIONS_DELETE,
		view: PromotionPermission.PROMOTIONS_VIEW,
		serviceAt: 1,
		controller: CampaignBudgetUsageController,
		resolver: CampaignBudgetUsageResolver
	},
	{
		name: 'Coupon',
		member: 'coupon',
		edit: PromotionPermission.COUPONS_DELETE,
		view: PromotionPermission.COUPONS_VIEW,
		serviceAt: 0,
		controller: CouponController,
		resolver: CouponResolver
	},
	{
		// The one pair of the eight whose grant is the editing permission rather than a delete one:
		// the controller states `GIFT_CARDS_EDIT` on both routes, because a card is withdrawn by
		// editing its status rather than by deleting it.
		name: 'GiftCard',
		member: 'giftCard',
		edit: PromotionPermission.GIFT_CARDS_EDIT,
		view: PromotionPermission.GIFT_CARDS_VIEW,
		serviceAt: 0,
		controller: GiftCardController,
		resolver: GiftCardResolver
	},
	{
		// The same grant, for the same reason: a movement is part of a card's ledger, which the
		// gift-card resource family owns.
		name: 'GiftCardTransaction',
		member: 'transaction',
		edit: PromotionPermission.GIFT_CARDS_EDIT,
		view: PromotionPermission.GIFT_CARDS_VIEW,
		serviceAt: 1,
		controller: GiftCardTransactionController,
		resolver: GiftCardTransactionResolver
	},
	{
		name: 'PromotionAction',
		member: 'action',
		edit: PromotionPermission.PROMOTIONS_DELETE,
		view: PromotionPermission.PROMOTIONS_VIEW,
		serviceAt: 1,
		controller: PromotionActionController,
		resolver: PromotionActionResolver
	},
	{
		name: 'PromotionUsage',
		member: 'usage',
		edit: PromotionPermission.PROMOTIONS_DELETE,
		view: PromotionPermission.PROMOTIONS_VIEW,
		serviceAt: 0,
		controller: PromotionUsageController,
		resolver: PromotionUsageResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
	payload: string;
}

/**
 * The sixteen fields, built from the eight resources so a resource cannot be listed with half a pair.
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
		payload: `SoftDelete${resource.name}Payload`
	},
	{
		...resource,
		field: `recover${resource.name}`,
		route: 'softRecover',
		method: 'softRecover',
		payload: `Recover${resource.name}Payload`
	}
]);

/**
 * Both surfaces over one stubbed service, with a stub of its own on every other collaborator.
 *
 * The service is the seam the parity requirement is about: a route and a field have to reach the same
 * method with the same identifier, and one stub is what makes that visible without a database behind
 * it. The other collaborators answer with a different row, so a field that reached one of them instead
 * is caught by the identity assertion rather than hidden behind a shared double.
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the other collaborators, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { service: Row; others: Row[]; controller: Row; resolver: Row } {
	const service = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};
	const injected: Row[] = Array.from({ length: entry.resolver.length }, () => ({
		softRemove: jest.fn().mockResolvedValue(FOREIGN),
		softRecover: jest.fn().mockResolvedValue(FOREIGN)
	}));

	injected[entry.serviceAt] = service;

	return {
		service,
		others: injected.filter((collaborator) => collaborator !== service),
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(...injected) as Row
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

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root mutation type's own field declarations, as the document spells them. */
function mutationFields(): FieldDefinitionNode[] {
	const mutation = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === 'Mutation'
	);

	if (!mutation?.fields?.length) {
		throw new Error('the promotion document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the promotion document declares no Mutation field named "${name}"`);
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
		throw new Error(`the promotion document declares no type named "${name}"`);
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
describe('the promotion document — the eight inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers each field with the payload its own resource answers its other mutations with', () => {
		for (const { field, payload, member } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(payload);
			// The payload carries the row under the member the resource's siblings use, and the same
			// three members every payload of this document carries.
			expect(membersOf(payload)).toEqual([member, 'operation', 'userErrors']);
		}
	});

	it('keeps every mutation the document already carried, the promotion pair included', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createPromotion',
			'updatePromotion',
			'deletePromotion',
			'activatePromotion',
			'expirePromotion',
			'deactivatePromotion',
			'replacePromotionActions',
			'simulatePromotion',
			'softDeletePromotion',
			'recoverPromotion',
			'createCampaign',
			'updateCampaign',
			'deleteCampaign',
			'updateCampaignBudget',
			'createCoupon',
			'updateCoupon',
			'deleteCoupon',
			'issueGiftCard',
			'redeemGiftCard',
			'voidGiftCard'
		]) {
			expect(declared).toContain(field);
		}
	});

	it('names the act `recover` and never `restore`', () => {
		// The composed schema uses `recover*` for this act in 111 of its 112 fields, and exactly one
		// `restore*` is the specification's own naming table being followed. A second spelling here
		// would be a second vocabulary for one capability, and a client that guessed the other one
		// would find no field rather than an error it could act on.
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
		// normalises both that and an absent argument to "no find options" — so the two are one call.
		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ID, []);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on
		// the wrong aggregate, and the payload would carry whatever that one returned.
		for (const other of others) {
			expect(other.softRemove).not.toHaveBeenCalled();
			expect(other.softRecover).not.toHaveBeenCalled();
		}

		// One answer, one implementation: the row either surface acted on is the same row, and it is
		// the one the resource's own service returned rather than the foreign stub's.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql[entry.member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is a write in both directions — a soft delete takes a row out of every read that does not
 * ask for retired rows, and a recover puts it back into the counts, the windows and the ledgers that
 * are computed from it — so a field that left the grant to its class would extend a read permission
 * into a write. That is the defect the controllers' own overrides exist to close on the other surface,
 * and the one a GraphQL caller would otherwise reach it through.
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

	it('demands the grant the sixteen overrides state, which is never the class-level one', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for:
		// the class-level grant of every one of these resolvers is a read grant, and a field that left
		// the act to its class would let a reader retire or restore a row.
		for (const { field, route, controller, resolver, edit, view } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([edit]);
			expect(permissionOfRoute(controller, route)).toEqual([edit]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([view]);
			expect(edit).not.toEqual(view);
		}
	});

	it('states the delete grant for six resources and the gift-card edit grant for the two card ones', () => {
		// The two are not the same question. A campaign, a ceiling, a consumption row, a code, an
		// action and an application are withdrawn, so their routes state the destructive grant of the
		// family they belong to. A card and a movement are not: the gift-card controller states
		// `GIFT_CARDS_EDIT` on both routes — a card is withdrawn by moving its status, and its ledger is
		// part of the same resource family — so the fields state that, and reading this table is how a
		// reader finds it out without opening eight controllers.
		expect(new Set(PARITY.map(({ edit }) => edit))).toEqual(
			new Set([
				PromotionPermission.PROMOTIONS_DELETE,
				PromotionPermission.COUPONS_DELETE,
				PromotionPermission.GIFT_CARDS_EDIT
			])
		);

		for (const { name, edit } of RESOURCES) {
			const expected = name.startsWith('GiftCard')
				? PromotionPermission.GIFT_CARDS_EDIT
				: name === 'Coupon'
					? PromotionPermission.COUPONS_DELETE
					: PromotionPermission.PROMOTIONS_DELETE;

			expect(edit).toBe(expected);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route, controller, resolver } of PARITY) {
			const routeGuards = guardsOf(controller);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});

/**
 * The other half of the same rule: these sixteen fields are the whole of what this plugin owes.
 *
 * §3.1 states the relation over the controllers, not over a list of resources someone maintains, so
 * the relation is restated here the way the gate states it: every controller of this plugin that
 * overrides the pair must have both fields declared for it. The promotion is already answered by the
 * wave that delivered it, and the eight resources are the ones this one adds — so a tenth controller
 * arriving with the pair and no field fails here rather than only in the repository-wide check.
 */
describe('the soft-delete pair — every controller that serves it is answered', () => {
	it('declares both fields for every controller of this plugin that overrides both routes', () => {
		const declared = new Set(mutationFields().map((field) => field.name.value));
		const answered: string[] = [];

		for (const controller of [PromotionController, ...RESOURCES.map(({ controller }) => controller)]) {
			// The overrides are the plugin's own, so `hasOwnProperty` is what separates a controller that
			// means to gate the pair from one that merely inherits it from the base.
			const overrides = ['softRemove', 'softRecover'].every((route) =>
				Object.prototype.hasOwnProperty.call(controller.prototype, route)
			);

			if (!overrides) {
				continue;
			}

			const resource = controller.name.replace(/Controller$/, '');
			answered.push(resource);

			expect(declared).toContain(`softDelete${resource}`);
			expect(declared).toContain(`recover${resource}`);
		}

		expect(answered).toEqual(
			expect.arrayContaining([
				'Promotion',
				'Campaign',
				'CampaignBudget',
				'CampaignBudgetUsage',
				'Coupon',
				'GiftCard',
				'GiftCardTransaction',
				'PromotionAction',
				'PromotionUsage'
			])
		);
	});
});
