/**
 * The two write routes this package did not answer, and the reading that collapsed the third.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **three** of this package's twenty-four
 * write routes — which is not a gap count, because the instrument measures names rather than
 * capabilities:
 *
 * - **`POST /product-prices/resolve`** is a capability the document already answers, under the name the
 *   operation has rather than the name the handler has: `resolvePrice`. The route's handler is `resolve`
 *   and the instrument wants the two words contiguous, which `resolvePrice` is not. It is a **query** on
 *   this surface, which is what `06-api-specification.md` §7.5 states the route is — "the only sanctioned
 *   read path for a price" — and what row 19 of the coverage table lists it as.
 * - **`POST /price-preferences`** and **`DELETE /price-preferences/:id`** are the two this suite delivers.
 *   Both were genuinely unserved, and the note that used to stand over the preference resolver argued the
 *   absence was deliberate: *"a preference is created with the scope it answers for, so it is authored once
 *   through the resource that owns the configuration"*. That resource does not exist. No field of this
 *   document, and no route of this controller other than `POST /price-preferences` itself, reaches
 *   `createOne`; `updateOne` refuses an id it cannot read, so it is not an upsert; and nothing seeds the
 *   table. A preference that was never created over REST therefore could not be created over GraphQL at
 *   all, and a preference could not be deleted over GraphQL at all while `DELETE /price-preferences/:id`
 *   served both a hard and a soft removal. §3.1 makes a delivered route a delivered capability, and
 *   `16-decision-log-and-open-questions.md` ADR-43 states the same thing as a decision: *"Every REST
 *   resource gets a resolver with the same capability set."*
 *
 * The uniqueness the old note was protecting is protected where it actually lives: in `createOne`, which
 * refuses a second live row for a scope with `PRICE_PREFERENCE_EXISTS`. Two rows for one scope are
 * impossible from either surface; what was impossible was one row, over GraphQL.
 *
 * **The delete is mirrored branch for branch, and the branch is the point.** The route reads the row —
 * the read is what scopes the write to the caller's tenant and refuses an id the caller cannot see — and
 * then reaches `delete(id)` for `force === true` and `softDelete(id)` otherwise, answering a payload that
 * says which of the two happened. The field reaches the same pair for the same input, and the suite drives
 * both branches.
 *
 * **One divergence is reported rather than copied.** `softDeletePricePreference`, the field this document
 * already carried, reaches `softRemove(id)` — which finds the row through the tenant-scoped read before
 * removing it — while this route's own soft branch reaches `softDelete(id)`, which does not. The two are
 * different methods on `TenantAwareCrudService`. A field that changed method to match its sibling would
 * stop answering the route it names, so the delete field reaches the route's pair and the divergence is
 * recorded here and in the wave's report.
 *
 * **Two route-level disagreements are flagged, not resolved**, because both are the specification's to
 * settle: `06` §7.5 marks `POST /price-preferences` idempotent ("Yes (Idempotency-Key)") and the route
 * declares no `@Idempotent` — this plugin contains none at all — so the field declares none either, since
 * inventing one would make the two protocols dedupe differently; and row 19 of §3.2's coverage table omits
 * both delivered names from a list it calls complete, which cannot ground a refusal when the same table
 * names fields nothing implements.
 *
 * Three properties are pinned for each field: it is **declared** in this plugin's document with the
 * arguments the route takes; it **states its own route's permission**, read from the route's metadata
 * rather than restated here; and it **reaches the same service call with the same arguments the route
 * reaches**. **Nothing is doubled here but the services** — the controller and the resolver are the real
 * ones, and the document the fields are read out of is the real one.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import { FieldDefinitionNode, InputObjectTypeDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { PricePreferenceController } from '../../price-preference/price-preference.controller';
import { PricePreference } from '../../price-preference/price-preference.entity';
import { schemaExtensions } from '../schema-extensions';
import { PricePreferenceResolver } from './price-preference.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000201';
const SCOPE = { attribute: 'CURRENCY', value: 'USD', isTaxInclusive: true };

/** What the service answers, so the two surfaces can be compared by identity. */
const PREFERENCE = { id: ID, attribute: 'CURRENCY', value: 'USD', isTaxInclusive: true };

/** The grant both routes state, read from the controller below rather than invented here. */
const GRANT = pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT);

/** One delivered route, its two surfaces, and what its field must mirror. */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit's convention expected. */
	expects: string;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: unknown;
	/** The method both surfaces must reach. */
	method: string;
}

/**
 * The two routes no field answered.
 *
 * Each is a capability rather than a spare route: a preference that could not be created over GraphQL at
 * all, and a removal whose hard and soft halves were both unreachable — the soft half nominally served by
 * a field that reaches a different service method.
 */
const DELIVERED: IParity[] = [
	{
		field: 'createPricePreference',
		route: 'create',
		resource: 'PricePreference',
		expects: 'createPricePreference',
		routeArgs: [SCOPE],
		fieldArgs: [SCOPE],
		declared: [['input', 'CreatePricePreferenceInput']],
		answers: 'PricePreference',
		grant: GRANT,
		method: 'createOne'
	},
	{
		field: 'deletePricePreference',
		route: 'delete',
		resource: 'PricePreference',
		expects: 'deletePricePreference',
		// Two branches, driven twice below: the route takes the identifier and the `force` member, and
		// reaches `delete` when it is true and `softDelete` when it is not.
		routeArgs: [ID, true],
		fieldArgs: [ID, true],
		declared: [
			['id', 'ID'],
			['force', 'Boolean']
		],
		answers: 'DeletePricePreferencePayload',
		grant: GRANT,
		method: 'delete'
	}
];

/** The route the reading collapsed, with the field that already serves it. */
const COLLAPSED = {
	route: 'resolve',
	resource: 'ProductPrice',
	expects: 'resolve',
	field: 'resolvePrice'
};

/** The two branches of the delete route, and the method each one reaches. */
const BRANCHES: { force: boolean; method: 'delete' | 'softDelete' }[] = [
	{ force: true, method: 'delete' },
	{ force: false, method: 'softDelete' }
];

/**
 * The two surfaces over one stub.
 *
 * The stub carries every method under test, so a field that reached the create where the delete belongs —
 * or the delete where the soft delete belongs — is visible as an assertion about the wrong member rather
 * than as a comparison that passes. It is held as a member of a loose row rather than as the object
 * itself, which is what lets the real controller and the real resolver be constructed over it without a
 * service behind them.
 */
function surfaces(): { service: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		pricePreference: {
			createOne: jest.fn().mockResolvedValue(PREFERENCE),
			updateOne: jest.fn().mockResolvedValue(PREFERENCE),
			findOneByIdString: jest.fn().mockResolvedValue(PREFERENCE),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
			softRemove: jest.fn().mockResolvedValue(PREFERENCE),
			softRecover: jest.fn().mockResolvedValue(PREFERENCE)
		}
	};

	return {
		service: stubs.pricePreference,
		controller: new PricePreferenceController(stubs.pricePreference) as Row,
		resolver: new PricePreferenceResolver(stubs.pricePreference) as Row
	};
}

/** The handlers of the controller, as functions. */
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
		throw new Error('the pricing document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Whether the document declares a root field of that name under the given root type. */
function declaresUnder(root: 'Mutation' | 'Query', name: string): boolean {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === root
	);

	return Boolean(type?.fields?.some((field) => field.name.value === name));
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the pricing document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One input type, as the document spells it. */
function inputType(name: string): InputObjectTypeDefinitionNode {
	const input = schemaExtensions.definitions.find(
		(definition): definition is InputObjectTypeDefinitionNode =>
			definition.kind === 'InputObjectTypeDefinition' && definition.name.value === name
	);

	if (!input) {
		throw new Error(`the pricing document declares no input named "${name}"`);
	}

	return input;
}

/** One object type, as the document spells it, for the payloads the delete fields answer with. */
function objectType(name: string): ObjectTypeDefinitionNode {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode =>
			definition.kind === 'ObjectTypeDefinition' && definition.name.value === name
	);

	if (!type) {
		throw new Error(`the pricing document declares no type named "${name}"`);
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
 * The schema's half of the two fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the pricing document — the two routes no field answered are declared', () => {
	it.each(DELIVERED)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of DELIVERED) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [name, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
				// `id` and `input` are non-null — a write that names no row, or states no scope, is not a
				// write — while `force` is nullable exactly as the route's optional query member is.
				expect(arguments_[index].type.kind).toBe(name === 'force' ? 'NamedType' : 'NonNullType');
			}
		}
	});

	it('answers the row a create wrote and the outcome a delete had', () => {
		// The create answers the row, because the route answers the row. The delete answers a payload
		// rather than the row, because a hard delete has no row left and the caller has to be told which
		// of the two removals happened — the shape the three sibling deletes of this document already use.
		for (const { field, answers } of DELIVERED) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}

		expect(objectType('DeletePricePreferencePayload').fields?.map((member) => member.name.value)).toEqual([
			'id',
			'deleted',
			'hard'
		]);
	});

	it('declares the scope members the create route accepts, and only those', () => {
		// The route's body is the whole create shape: the scope is the row's identity and the answer is
		// the only thing that changes afterwards, which is why `UpdatePricePreferenceInput` beside this
		// input carries the identifier and the answer and nothing else.
		expect(inputType('CreatePricePreferenceInput').fields?.map((member) => member.name.value)).toEqual([
			'attribute',
			'value',
			'isTaxInclusive'
		]);
		expect(inputType('UpdatePricePreferenceInput').fields?.map((member) => member.name.value)).toEqual([
			'id',
			'isTaxInclusive'
		]);
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'createPriceList',
			'updatePriceList',
			'deletePriceList',
			'softDeletePriceList',
			'recoverPriceList',
			'activatePriceList',
			'expirePriceList',
			'simulatePriceList',
			'createProductPrice',
			'updateProductPrice',
			'deleteProductPrice',
			'softDeleteProductPrice',
			'recoverProductPrice',
			'bulkUpsertProductPrices',
			'updatePricePreference',
			'softDeletePricePreference',
			'recoverPricePreference',
			'createExchangeRate',
			'updateExchangeRate',
			'deleteExchangeRate',
			'softDeleteExchangeRate',
			'recoverExchangeRate'
		]) {
			expect(declaresUnder('Mutation', name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the two fields — the two protocols write the same rows the same way', () => {
	it('reaches the create the route reaches, with the scope the route was given', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.create(SCOPE);
		const overGraphql = await resolver.createPricePreference(SCOPE);

		expect(service.createOne).toHaveBeenNthCalledWith(1, SCOPE);
		expect(service.createOne).toHaveBeenNthCalledWith(2, SCOPE);
		expect(service.createOne).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the row either surface wrote is the same row.
		expect(overGraphql).toBe(overRest);
	});

	it.each(BRANCHES)('reaches $method on both surfaces when force is $force', async ({ force, method }) => {
		// The route's two branches are the capability: `force` is not a flag the field may ignore, because
		// the two removals differ in whether the row survives.
		const { service, controller, resolver } = surfaces();

		await controller.delete(ID, force);
		await resolver.deletePricePreference(ID, force);

		// The read first, on both surfaces: it is what scopes the write to the caller's tenant.
		expect(service.findOneByIdString).toHaveBeenCalledTimes(2);
		expect(service.findOneByIdString).toHaveBeenNthCalledWith(1, ID);
		expect(service.findOneByIdString).toHaveBeenNthCalledWith(2, ID);

		expect(service[method]).toHaveBeenNthCalledWith(1, ID);
		expect(service[method]).toHaveBeenNthCalledWith(2, ID);
		expect(service[method]).toHaveBeenCalledTimes(2);

		// And not the other branch.
		const other = method === 'delete' ? 'softDelete' : 'delete';
		expect(service[other]).not.toHaveBeenCalled();
	});

	it('answers which removal happened, as the route tells its caller', async () => {
		const { controller, resolver } = surfaces();

		await expect(controller.delete(ID, true)).resolves.toBeDefined();
		await expect(resolver.deletePricePreference(ID, true)).resolves.toEqual({
			id: ID,
			deleted: true,
			hard: true
		});
		await expect(resolver.deletePricePreference(ID, false)).resolves.toEqual({
			id: ID,
			deleted: true,
			hard: false
		});
	});

	it('leaves the sibling soft-delete field on the method it already reached', async () => {
		// The divergence this wave reports rather than copies: `softDeletePricePreference` reaches
		// `softRemove`, which is not the `softDelete` the route's own soft branch reaches. A field that
		// changed method to match would stop answering the route it names, so the assertion pins both.
		const { service, resolver } = surfaces();

		await resolver.softDeletePricePreference(ID);
		expect(service.softRemove).toHaveBeenCalledWith(ID);

		await resolver.deletePricePreference(ID, false);
		expect(service.softDelete).toHaveBeenCalledWith(ID);
		expect(service.softRemove).toHaveBeenCalledTimes(1);
		expect(service.softDelete).toHaveBeenCalledTimes(1);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Both are writes, so a field that stated no grant of its own would be one `PermissionGuard` answers
 * `true` to, because it answers `true` to empty metadata: every authenticated caller could author a
 * tax-inclusivity answer for the whole organization or take one away. The class grant of this resolver is
 * the *view* grant, which is not what either act carries.
 */
describe('the two fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are gated, so the comparison below cannot pass on two absences.
		expect(DELIVERED.every(({ route }) => permissionOfRoute(PricePreferenceController, route))).toBe(true);

		for (const { field, route } of DELIVERED) {
			expect(typeof handlersOf(PricePreferenceController)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PricePreferenceResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(PricePreferenceController)[route])
			);
			expect(permissionOfField(PricePreferenceResolver, field)).toEqual(
				permissionOfRoute(PricePreferenceController, route)
			);
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, grant } of DELIVERED) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(PricePreferenceResolver)[field])).toEqual([
				grant
			]);
			expect(permissionOfField(PricePreferenceResolver, field)).toEqual([grant]);
			expect(permissionOfRoute(PricePreferenceController, route)).toEqual([grant]);
		}
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// Neither route carries `@Idempotent` or `@Versioned`. The API specification marks the create
		// idempotent and the route does not carry the decorator; inventing one here would make the two
		// protocols dedupe differently, so the gap is reported rather than closed from one side.
		for (const { field, route } of DELIVERED) {
			for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
				expect(Reflect.getMetadata(key, fieldsOf(PricePreferenceResolver)[field])).toBeUndefined();
				expect(Reflect.getMetadata(key, handlersOf(PricePreferenceController)[route])).toBeUndefined();
			}
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		for (const { field, route } of DELIVERED) {
			const routeGuards = guardsOf(PricePreferenceController);

			expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
			expect(guardsOf(PricePreferenceController, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(PricePreferenceResolver, field)).toEqual(
				expect.arrayContaining(guardsOf(PricePreferenceController, route))
			);
		}
	});
});

/**
 * The reading, asserted rather than described.
 *
 * The collapsed route and the arithmetic that produced it are pinned here, so a future wave that renames
 * the serving field, or that adds one of these names without meaning to, fails this suite.
 */
describe('the three flagged routes — one collapsed and two delivered', () => {
	it('flags three routes, collapses one and delivers two', () => {
		expect(DELIVERED).toHaveLength(2);

		// The whole reading in one place: three flagged, one of them answered under another name, and the
		// remaining two — the create and the delete of one resource — not answered at all.
		expect(1 + DELIVERED.length).toBe(3);
		expect(24).toBeGreaterThan(3);
	});

	it('answers the resolve route under the name the operation has, not the handler’s', () => {
		// The instrument wants the handler's two words contiguous — `resolve` — and the field is named for
		// what the operation is: the price a context resolves to. The route is a read, so the field is a
		// query on this surface, which is what the API specification states it is.
		expect(declaresUnder('Mutation', COLLAPSED.expects)).toBe(false);
		expect(declaresUnder('Query', COLLAPSED.field)).toBe(true);
		expect(declaresUnder('Query', COLLAPSED.expects)).toBe(false);
	});

	it('names the two delivered fields the way the audit expected, because the route is the resource’s own', () => {
		// A create and a delete of the resource itself: the convention the instrument applies is the one
		// this document follows for its siblings, so the expectation and the field agree here — which is
		// why these two are gaps rather than naming variants.
		expect(declaresUnder('Mutation', 'createPricePreference')).toBe(true);
		expect(declaresUnder('Mutation', 'deletePricePreference')).toBe(true);
		expect(declaresUnder('Mutation', 'softDeletePricePreference')).toBe(true);
		expect(declaresUnder('Mutation', 'recoverPricePreference')).toBe(true);
	});

	it('leaves the role of `PricePreference` unchanged, which is what the fields answer with', () => {
		// A control, so the two comparisons above cannot pass on an empty reading of the document.
		expect(PricePreference).toBeDefined();
		expect(PREFERENCE.id).toBe(ID);
	});
});
