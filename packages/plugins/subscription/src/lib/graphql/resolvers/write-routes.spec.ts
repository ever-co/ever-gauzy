/**
 * The write routes this package answered under another name, the one it did not answer, and the one it
 * must not.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **seven** of this package's thirty-four
 * write routes — which is not a gap count, because the instrument measures names rather than capabilities:
 *
 * - **five routes are answered already**, under names the operation has rather than the handler's:
 *   `changePlan` by `changeSubscriptionPlan`, `addItem` by `addSubscriptionItem`, `changeItemQuantity` by
 *   `changeSubscriptionItemQuantity`, `removeItem` by `removeSubscriptionItem`, and `billingRun` by
 *   `runSubscriptionBilling`. In each the verb and the resource are contiguous in neither direction, which
 *   is all the instrument looks for. The suite drives every one of the five on both surfaces and compares
 *   the service call, so the collapse is a test rather than a paragraph.
 * - **one route was not answered**: `DELETE /subscriptions/:id`. The controller declares it and overrides
 *   `CrudController`'s own only to state the permission the base leaves unstated, and it reaches
 *   `super.delete(id)` — the CRUD base's `delete`, which removes the row. The document answered the
 *   *recoverable* half of the pair (`softDeleteSubscription`, `recoverSubscription`) and not the hard one,
 *   so a subscription could be retired over GraphQL and only deleted over REST. It is the field this suite
 *   delivers, and its distinction from the soft pair is the whole of what it says: a soft delete sets
 *   `deletedAt` and leaves the lines and the billing history answerable, this removes the row.
 * - **one route must not be mirrored**: `DELETE /subscription-billings/:id`, the same inherited shape on
 *   the billing-cycle controller. `13-migration-and-rollout-plan.md` §11.4 names the table by hand —
 *   *"`order*`, `payment` (the columns this programme adds), `payment_capture`, `refund`, `tax_line`,
 *   `adjustment`, **`subscription_billing`**, `order_return*` | **Indefinite** | Soft delete only
 *   (`deletedAt`); **no hard delete through the API**"* — so the route is refused because mirroring it
 *   would put an operation the retention policy forbids into a second published contract. **The refusal is
 *   also a finding**: REST serves the route today, so the REST surface is the one out of step with §11.4,
 *   and closing it means removing a route from a published contract, which is the owner's call. It is
 *   reported and left open, and the recoverable pair beside it (`softDeleteSubscriptionBilling`,
 *   `recoverSubscriptionBilling`) already answers the removal the policy allows.
 *
 * Three properties are pinned for the delivered field: it is **declared** with the arguments the route
 * takes; it **states its own route's permission**, read from the route's metadata rather than restated
 * here, because `PermissionGuard` resolves handler-then-class and this controller's class grant is the
 * view grant the act does not carry; and it **reaches the same service call with the same arguments the
 * route reaches**. **Nothing is doubled here but the services** — the controller, the resolvers, the
 * `CrudController` behind the controller and the document the fields are read out of are all the real
 * ones.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY,
	VERSION_EXPECTATION_PROPERTY
} from '@gauzy/core';
import {
	FieldDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionBillingController } from '../../subscription-billing/subscription-billing.controller';
import { SubscriptionController } from '../../subscription/subscription.controller';
import { schemaExtensions } from '../schema-extensions';
import { SubscriptionResolver } from './subscription.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000401';
const BILLING = '00000000-0000-4000-8000-000000000402';
const VARIANT = '00000000-0000-4000-8000-000000000403';
const PLAN = '00000000-0000-4000-8000-000000000404';

/**
 * The version the caller read, as the concurrency kernel hands it to a route.
 *
 * The versioned routes read it off the request and refuse the write when it is absent, so both surfaces
 * are driven with the same expectation rather than with a stub that would hide the requirement.
 */
const VERSION = { wildcard: false, versions: [7] };
const requestWithVersion = (): Row => ({ [VERSION_EXPECTATION_PROPERTY]: VERSION });
const contextWithVersion = (): Row => ({ req: requestWithVersion() });

/** What each service answers, so the two surfaces can be compared. */
const SUBSCRIPTION_ROW = { id: SUBSCRIPTION, status: 'ACTIVE', version: 8 };
const CHANGE_OUTCOME = { subscription: SUBSCRIPTION_ROW, credit: '0.000000', charge: '0.000000', net: '0.000000' };
const BILLING_RUN = { examined: 1, billed: 1, failed: 0, skipped: 0, results: [] };

/** The delivered field, its route, and what each declares. */
const DELIVERED = {
	/** The field this wave delivers. */
	field: 'deleteSubscription',
	/** The handler the route is served by, which is what the audit reads. */
	route: 'delete',
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: 'Subscription',
	/** The name the audit's convention expected, which is the delivered name. */
	expects: 'deleteSubscription',
	/** The arguments the route's handler takes — the identifier and the options the base collects. */
	routeArgs: [SUBSCRIPTION],
	/** The arguments the field takes. */
	fieldArgs: [SUBSCRIPTION],
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: [SUBSCRIPTION],
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [['id', 'ID']] as [string, string][],
	/** The type the field answers with. */
	answers: 'DeleteSubscriptionPayload',
	/** The grant the route's own handler states. */
	grant: SubscriptionPermissions.SUBSCRIPTIONS_EDIT,
	/** The method both surfaces must reach. */
	method: 'delete'
};

/** One collapsed route, its two surfaces, and the method both must reach. */
interface ICollapsed {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The name the audit's convention expected, which is the handler's own. */
	expects: string;
	/** The field that already serves the capability. */
	field: string;
	/** Drives the route with the arguments its handler takes. */
	overRest: (controller: Row) => Promise<unknown>;
	/** Drives the field with the arguments it takes. */
	overGraphql: (resolver: Row) => Promise<unknown>;
	/** The name of the service method both surfaces must reach. */
	method: string;
	/** The arguments that method must receive, from both surfaces. */
	serviceArgs: any[];
}

/**
 * The five routes the reading collapsed, each with the field that already serves it.
 *
 * The two surfaces answer different shapes — the routes answer the service's own outcome, the fields wrap
 * it in the payload every mutation of this resource answers — so what is compared is the call, which is
 * the seam §3.1's parity requirement is about, and not the envelope each protocol puts around it.
 */
const COLLAPSED: ICollapsed[] = [
	{
		controller: SubscriptionController,
		resource: 'Subscription',
		route: 'changePlan',
		expects: 'changePlan',
		field: 'changeSubscriptionPlan',
		overRest: (controller) => controller.changePlan(SUBSCRIPTION, { planId: PLAN }, requestWithVersion()),
		overGraphql: (resolver) =>
			resolver.changeSubscriptionPlan(SUBSCRIPTION, { planId: PLAN }, contextWithVersion()),
		method: 'changePlan',
		serviceArgs: [SUBSCRIPTION, { planId: PLAN }, VERSION]
	},
	{
		controller: SubscriptionController,
		resource: 'Subscription',
		route: 'addItem',
		expects: 'addItem',
		field: 'addSubscriptionItem',
		// The route reads the quantity off its body and the field takes it as its own argument, so the
		// two are driven with the same line stated each way.
		overRest: (controller) =>
			controller.addItem(SUBSCRIPTION, { variantId: VARIANT, quantity: '3.000000' }, requestWithVersion()),
		overGraphql: (resolver) =>
			resolver.addSubscriptionItem(
				SUBSCRIPTION,
				{ variantId: VARIANT, quantity: '3.000000' },
				contextWithVersion()
			),
		method: 'addItem',
		serviceArgs: [SUBSCRIPTION, { variantId: VARIANT, quantity: '3.000000' }, VERSION]
	},
	{
		controller: SubscriptionController,
		resource: 'Subscription',
		route: 'changeItemQuantity',
		expects: 'changeItemQuantity',
		field: 'changeSubscriptionItemQuantity',
		overRest: (controller) =>
			controller.changeItemQuantity(SUBSCRIPTION, VARIANT, { quantity: '3.000000' }, requestWithVersion()),
		overGraphql: (resolver) =>
			resolver.changeSubscriptionItemQuantity(SUBSCRIPTION, VARIANT, '3.000000', contextWithVersion()),
		method: 'changeItemQuantity',
		serviceArgs: [SUBSCRIPTION, VARIANT, '3.000000', VERSION]
	},
	{
		controller: SubscriptionController,
		resource: 'Subscription',
		route: 'removeItem',
		expects: 'removeItem',
		field: 'removeSubscriptionItem',
		// The one change of the five that states no version: it removes a child row rather than writing the
		// subscription, which is what both surfaces say by their signature.
		overRest: (controller) => controller.removeItem(SUBSCRIPTION, VARIANT),
		overGraphql: (resolver) => resolver.removeSubscriptionItem(SUBSCRIPTION, VARIANT),
		method: 'removeItem',
		serviceArgs: [SUBSCRIPTION, VARIANT]
	},
	{
		controller: SubscriptionController,
		resource: 'Subscription',
		route: 'billingRun',
		expects: 'billingRun',
		field: 'runSubscriptionBilling',
		overRest: (controller) => controller.billingRun({ limit: 25, subscriptionId: SUBSCRIPTION }),
		overGraphql: (resolver) =>
			resolver.runSubscriptionBilling({ limit: 25, subscriptionId: SUBSCRIPTION }),
		method: 'runBilling',
		serviceArgs: [{ asOf: undefined, limit: 25, subscriptionId: SUBSCRIPTION }]
	}
];

/**
 * The one route that exists, writes, and is deliberately not mirrored.
 *
 * It is listed with the controller whose handler serves it, so the assertion below can check that the
 * route is real: a refusal is a statement about a surface, and a surface that does not serve the route
 * would make the refusal vacuous.
 */
const REFUSED = {
	controller: SubscriptionBillingController,
	resource: 'SubscriptionBilling',
	route: 'delete',
	names: ['deleteSubscriptionBilling', 'hardDeleteSubscriptionBilling'],
	because: '13 §11.4 names subscription_billing: soft delete only, no hard delete through the API'
};

/**
 * The two surfaces over one stub.
 *
 * The stub carries every method under test, so a field that reached the wrong one is visible as an
 * assertion about the wrong member rather than as a comparison that passes.
 */
function surfaces(): { service: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		subscription: {
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			softRemove: jest.fn().mockResolvedValue(SUBSCRIPTION_ROW),
			softRecover: jest.fn().mockResolvedValue(SUBSCRIPTION_ROW),
			changePlan: jest.fn().mockResolvedValue(CHANGE_OUTCOME),
			addItem: jest.fn().mockResolvedValue(CHANGE_OUTCOME),
			changeItemQuantity: jest.fn().mockResolvedValue(CHANGE_OUTCOME),
			removeItem: jest.fn().mockResolvedValue(CHANGE_OUTCOME),
			runBilling: jest.fn().mockResolvedValue(BILLING_RUN)
		}
	};

	return {
		service: stubs.subscription,
		controller: new SubscriptionController(stubs.subscription) as Row,
		resolver: new SubscriptionResolver(stubs.subscription, stubs.plan ?? {}, stubs.item ?? {}) as Row
	};
}

/** The handlers of one controller, as functions. */
function handlersOf(controller: new (...args: any[]) => any): Row {
	return controller.prototype as unknown as Row;
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: new (...args: any[]) => any): Row {
	return resolver.prototype as unknown as Row;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]`, which `PermissionGuard` then answers `true` to when the pair is empty.
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
	const restated = handler ? (Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? []) : [];

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
		throw new Error('the subscription document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationFields().some((field) => field.name.value === name);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the subscription document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One object type, as the document spells it, for the payload the delete answers with. */
function objectType(name: string): ObjectTypeDefinitionNode {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode =>
			definition.kind === 'ObjectTypeDefinition' && definition.name.value === name
	);

	if (!type) {
		throw new Error(`the subscription document declares no type named "${name}"`);
	}

	return type;
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/**
 * The schema's half of the delivered field.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the subscription document — the route no field answered is declared', () => {
	it('declares deleteSubscription in the mutation block', () => {
		expect(mutationField(DELIVERED.field).name.value).toBe(DELIVERED.field);
	});

	it('takes the argument the route takes, non-null', () => {
		const arguments_ = mutationField(DELIVERED.field).arguments ?? [];

		expect(arguments_.map((argument) => argument.name.value)).toEqual(DELIVERED.declared.map(([name]) => name));

		for (const [index] of DELIVERED.declared.entries()) {
			expect(namedTypeName(arguments_[index].type)).toBe('ID');
			// A write that names no row is not a write, which is what the route's own `UUIDValidationPipe`
			// says on the other surface.
			expect(arguments_[index].type.kind).toBe('NonNullType');
		}
	});

	it('answers a payload carrying the identity, because a removed row cannot answer with itself', () => {
		const type = mutationField(DELIVERED.field).type;

		expect(namedTypeName(type)).toBe(DELIVERED.answers);
		expect(type.kind).toBe('NonNullType');

		// The shape the two sibling deletes of this document already answer, so a client generated from
		// the composed schema sees one shape per kind of act.
		expect(objectType('DeleteSubscriptionPayload').fields?.map((member) => member.name.value)).toEqual([
			'id',
			'userErrors'
		]);
		expect(objectType('DeleteSubscriptionItemPayload').fields?.map((member) => member.name.value)).toEqual([
			'id',
			'userErrors'
		]);
	});

	it('keeps every field the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'createSubscriptionPlan',
			'updateSubscriptionPlan',
			'deleteSubscriptionPlan',
			'softDeleteSubscriptionPlan',
			'recoverSubscriptionPlan',
			'createSubscription',
			'updateSubscription',
			'activateSubscription',
			'pauseSubscription',
			'resumeSubscription',
			'cancelSubscription',
			'expireSubscription',
			'changeSubscriptionPlan',
			'addSubscriptionItem',
			'changeSubscriptionItemQuantity',
			'removeSubscriptionItem',
			'softDeleteSubscription',
			'recoverSubscription',
			'createSubscriptionItem',
			'updateSubscriptionItem',
			'deleteSubscriptionItem',
			'softDeleteSubscriptionItem',
			'recoverSubscriptionItem',
			'createSubscriptionBilling',
			'updateSubscriptionBilling',
			'billSubscription',
			'runSubscriptionBilling',
			'paySubscriptionBilling',
			'waiveSubscriptionBilling',
			'refundSubscriptionBilling',
			'softDeleteSubscriptionBilling',
			'recoverSubscriptionBilling'
		]) {
			expect(declares(name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on its own stub, not a service method named only in this file.
 */
describe('deleteSubscription — the two protocols remove the same row the same way', () => {
	it('reaches the service method the delete route reaches', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.delete(SUBSCRIPTION);
		const overGraphql = await resolver.deleteSubscription(SUBSCRIPTION);

		expect(service.delete).toHaveBeenNthCalledWith(1, ...DELIVERED.serviceArgs);
		expect(service.delete).toHaveBeenNthCalledWith(2, ...DELIVERED.serviceArgs);
		expect(service.delete).toHaveBeenCalledTimes(2);

		// The route answers the deletion result and the field answers its payload, so the comparison is of
		// the call rather than of the envelope — and the payload names the row that is gone.
		expect(overRest).toBeDefined();
		expect(overGraphql).toEqual({ id: SUBSCRIPTION, userErrors: [] });
	});

	it('is a hard removal and not the recoverable one beside it', async () => {
		// The distinction the field exists for: `softDeleteSubscription` reaches `softRemove`, which sets
		// `deletedAt` and leaves the row; this reaches `delete`, which removes it. A field that reached the
		// soft method would answer the pair that already existed.
		const { service, resolver } = surfaces();

		await resolver.deleteSubscription(SUBSCRIPTION);

		expect(service.delete).toHaveBeenCalledWith(SUBSCRIPTION);
		expect(service.softRemove).not.toHaveBeenCalled();
		expect(service.softRecover).not.toHaveBeenCalled();
	});

	it('reports a refusal in the payload rather than throwing it away', async () => {
		const { service, resolver } = surfaces();
		service.delete.mockRejectedValueOnce(new Error('the subscription is billed'));

		await expect(resolver.deleteSubscription(SUBSCRIPTION)).resolves.toEqual({
			id: null,
			userErrors: [
				{ code: 'INTERNAL_ERROR', message: 'the subscription is billed', path: [], details: null }
			]
		});
	});
});

/**
 * The five collapsed routes, driven on both surfaces.
 *
 * Each pair is one act, so the assertion is that the same method is reached with the same arguments —
 * which is what makes the collapse a reading about capabilities rather than about names.
 */
describe('the five collapsed routes — served under another name, not unserved', () => {
	it.each(COLLAPSED)('$resource.$route reaches $method on both surfaces', async (entry) => {
		const { service, controller, resolver } = surfaces();

		await entry.overRest(controller);
		await entry.overGraphql(resolver);

		expect(service[entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(service[entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(service[entry.method]).toHaveBeenCalledTimes(2);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field, and not by a field of the handler’s name', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(declares(entry.expects)).toBe(false);
		expect(declares(entry.field)).toBe(true);
	});

	it('states the version requirement where the routes state one, and nowhere else', () => {
		// Four of the five routes read a version off the request and refuse the write without it; the
		// removal of a child row does not, and neither does the billing pass, which walks whichever
		// subscriptions are due. The fields carry the same declarations as the routes, which is what the
		// metadata comparison in the permission block below pins for the delivered field.
		const versioned = COLLAPSED.filter(({ method }) => ['changePlan', 'addItem', 'changeItemQuantity'].includes(method));

		expect(versioned).toHaveLength(3);
		for (const { field, route, controller } of versioned) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])).toBeDefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(SubscriptionResolver)[field])).toBeDefined();
		}

		for (const method of ['removeItem', 'runBilling']) {
			const entry = COLLAPSED.find((candidate) => candidate.method === method) as ICollapsed;
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(entry.controller)[entry.route])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(SubscriptionResolver)[entry.field])).toBeUndefined();
		}
	});
});

/**
 * The authorisation is the route's.
 *
 * The delete is a write, so a field that stated no grant of its own would be one `PermissionGuard` answers
 * `true` to, because it answers `true` to empty metadata: any member of the tenant who may *read* a
 * subscription could remove the row. This controller's class grant is exactly that read grant, which is
 * why the comparison is against the route's own handler metadata rather than against the class.
 */
describe('deleteSubscription — the permission and the guards are the route’s', () => {
	it('states on the field exactly what its own route states, read from the route', () => {
		expect(permissionOfRoute(SubscriptionController, DELIVERED.route)).toBeTruthy();

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(SubscriptionResolver)[DELIVERED.field])).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(SubscriptionController)[DELIVERED.route])
		);
		expect(permissionOfField(SubscriptionResolver, DELIVERED.field)).toEqual(
			permissionOfRoute(SubscriptionController, DELIVERED.route)
		);
	});

	it('demands the edit grant the route states, and not the class’s view grant', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(SubscriptionResolver)[DELIVERED.field])).toEqual([
			DELIVERED.grant
		]);
		expect(permissionOfRoute(SubscriptionController, DELIVERED.route)).toEqual([DELIVERED.grant]);
		expect(permissionOfField(SubscriptionResolver, DELIVERED.field)).not.toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, SubscriptionResolver)
		);
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// The delete route declares neither — a removal is idempotent by the row's absence on the second
		// attempt — so the field declares neither, and a keyless GraphQL retry answers as a keyless REST
		// retry does.
		for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
			expect(Reflect.getMetadata(key, fieldsOf(SubscriptionResolver)[DELIVERED.field])).toBeUndefined();
			expect(Reflect.getMetadata(key, handlersOf(SubscriptionController)[DELIVERED.route])).toBeUndefined();
		}
	});

	it('runs the field under the guard chain the route runs under', () => {
		const routeGuards = guardsOf(SubscriptionController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(guardsOf(SubscriptionController, DELIVERED.route)).toEqual(expect.arrayContaining(routeGuards));
		expect(guardsOf(SubscriptionResolver, DELIVERED.field)).toEqual(
			expect.arrayContaining(guardsOf(SubscriptionController, DELIVERED.route))
		);
	});
});

/**
 * The reading, asserted rather than described.
 *
 * The five collapsed routes, the one delivered field and the one refusal are pinned here with the
 * arithmetic that produced them, so a future wave that renames a serving field — or that adds the one name
 * this suite refuses — fails this suite.
 */
describe('the seven flagged routes — five collapsed, one delivered, one refused', () => {
	it('flags seven routes, collapses five, delivers one and refuses one', () => {
		expect(COLLAPSED).toHaveLength(5);
		expect(COLLAPSED.length + 1 + 1).toBe(7);
		expect(34).toBeGreaterThan(7);

		// The five collapsed are the subscription's own plan change, its two line writes, its line removal
		// and the billing pass; the delivered one is the hard delete; the refused one is the billing
		// cycle's hard delete.
		expect(COLLAPSED.map(({ method }) => method).sort()).toEqual(
			['addItem', 'changeItemQuantity', 'changePlan', 'removeItem', 'runBilling'].sort()
		);
	});

	it('refuses the billing-cycle delete, and says why', () => {
		// The route is real, so the refusal is a statement about the surface rather than about a handler
		// that does not exist — and the recoverable pair the policy allows is already answered.
		expect(typeof handlersOf(REFUSED.controller)[REFUSED.route]).toBe('function');

		for (const name of REFUSED.names) {
			expect(declares(name)).toBe(false);
		}

		expect(declares('softDeleteSubscriptionBilling')).toBe(true);
		expect(declares('recoverSubscriptionBilling')).toBe(true);
		expect(REFUSED.because).toContain('§11.4');
	});

	it('answers the billing cycle under the names its routes have, and not the hard delete', () => {
		// The cycle's own writes are all answered: opening one, correcting one, billing one, recording that
		// its money arrived, waiving it, refunding it, and the recoverable removal. Only the hard delete is
		// refused, and it is refused because the table it would remove is the record of money billed.
		for (const name of [
			'createSubscriptionBilling',
			'updateSubscriptionBilling',
			'billSubscription',
			'paySubscriptionBilling',
			'waiveSubscriptionBilling',
			'refundSubscriptionBilling',
			'softDeleteSubscriptionBilling',
			'recoverSubscriptionBilling'
		]) {
			expect(declares(name)).toBe(true);
		}

		expect(declares('deleteSubscriptionBilling')).toBe(false);

		// The removal the policy does allow is served by the routes the controller overrides, which is what
		// makes the refusal a refusal of one operation rather than of a resource.
		expect(typeof handlersOf(SubscriptionBillingController).softRemove).toBe('function');
		expect(typeof handlersOf(SubscriptionBillingController).softRecover).toBe('function');
		expect(BILLING).toBeDefined();
	});
});
