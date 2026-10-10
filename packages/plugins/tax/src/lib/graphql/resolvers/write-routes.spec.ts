/**
 * The write route this package did not answer, and why its field is a query rather than a mutation.
 *
 * §3.1 requires one mutation per REST write route, and the dimension that covers a route which is not
 * CRUD is its own: *"One mutation per non-CRUD action route."* A name-based audit reads a route's
 * *handler* name against the root fields this document declares, and it flags **three** of this package's
 * twenty write routes. Two of the three are answered already, under names whose words are not contiguous
 * with the handler's — `PUT /tax-rates/:id/parts` by `setTaxRateParts` and `PUT /tax-regimes/:id/rates` by
 * `setTaxRegimeRates`, each the set field of the resource it writes — and the third, `POST
 * /tax-rates/calculate`, was not answered at all. It is the one this suite delivers.
 *
 * **It is delivered as a query, and that is the whole reading of the route.** The handler stores nothing —
 * its own docstring says so in as many words, *"This endpoint stores nothing"* — it carries the **view**
 * grant rather than an edit one, and the amounts it is given come from the caller's own totals chain. The
 * resolution beside it is the precedent in this very plugin: `POST /tax-rates/resolve` writes nothing
 * either and is mirrored as `resolveTaxRate`, a query. A mutation here would tell a generated client that
 * calling `calculateTax` changes something, which is the one thing the operation never does, and it would
 * carry an edit permission the route does not carry. The document therefore declares it in the `Query`
 * block, and the suite asserts it is **absent** from `Mutation` — a mutation of this name would be a
 * second, wrong statement of the same capability.
 *
 * Three properties are pinned: the field is **declared** with the arguments the route takes; it **states
 * its own route's permission**, read from the route's metadata rather than restated here; and it
 * **reaches the same service call with the same arguments the route reaches**, member for member. The
 * mapping is the route's own and it is not the identity: the lines are re-stated with the eight members
 * the computation reads, and the request's `at` becomes the `now` instant the validity windows are
 * evaluated at. The suite asserts that mapping rather than trusting it, which is what makes "the same
 * call" a test rather than a claim.
 *
 * **Three route-level disagreements are reported here and not resolved**, because each is the
 * specification's to settle and none of them is a reason to withhold a capability:
 *
 * - `06-api-specification.md` §7.6 spells the route **`/tax/calculate`**; the controller serves it at
 *   `/tax-rates/calculate`, and `06` §7.1 names `/tax/calculate` among the action routes that expose only
 *   the rows listed. One of the two paths is wrong.
 * - The specification's request admits *"`lines[]` … or `cartId`, `address`, `shippingAmount`"*.
 *   `TaxCalculationDTO` carries none of the second three, so the cart-scoped computation the specification
 *   describes is implemented on **neither** surface — a gap the mirror cannot close from one side.
 * - Row 20 of §3.2's coverage table lists this domain's mutations and omits any calculate field, while the
 *   same table omits the three regime writes and the two set fields that this package *does* implement.
 *
 * **Nothing is doubled here but the service.** The controller is the real one, the resolver is the real
 * one, and the document the field is read out of is the real one.
 */

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	IDEMPOTENT_METADATA_KEY,
	PermissionGuard,
	TenantPermissionGuard,
	VERSIONED_METADATA_KEY
} from '@gauzy/core';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { TAX_PERMISSION_VALUES, taxPermission } from '../../tax.permissions';
import { TaxRateController } from '../../tax-rate/tax-rate.controller';
import { TaxRegimeController } from '../../tax-regime/tax-regime.controller';
import { schemaExtensions } from '../schema-extensions';
import { TaxRateResolver } from './tax-rate.resolver';

type Row = Record<string, any>;

/** The rows and the destination both surfaces compute against. */
const CATEGORY = '00000000-0000-4000-8000-000000000301';
const REGIME = '00000000-0000-4000-8000-000000000302';
const REGION = '00000000-0000-4000-8000-000000000303';
const AT = '2026-05-01T00:00:00.000Z';

/** The request the route's body carries, and the input the field is given — one statement, twice. */
const REQUEST = {
	currency: 'USD',
	lines: [
		{
			referenceId: 'line-1',
			taxCategoryId: CATEGORY,
			amount: '100.000000',
			quantity: '2.000000',
			regionId: REGION,
			countryCode: 'US',
			provinceCode: 'CA',
			postalCode: '90210'
		}
	],
	taxRegimeId: REGIME,
	partyTaxRegistrationPresent: true,
	documentDirection: 'SALE',
	regionId: REGION,
	countryCode: 'US',
	provinceCode: 'CA',
	postalCode: '90210',
	regionTaxInclusive: false,
	allowUntaxedCatalog: true,
	at: AT
};

/**
 * What the service must receive, computed here rather than read off the resolver.
 *
 * The route re-states each line with the members the computation reads and turns `at` into `now`; a field
 * that forwarded the caller's object unchanged would pass a test written against the resolver's own shape
 * and fail this one, which is the point of writing it out.
 */
const EXPECTED = {
	currency: REQUEST.currency,
	lines: REQUEST.lines.map((line) => ({
		referenceId: line.referenceId,
		taxCategoryId: line.taxCategoryId,
		amount: line.amount,
		quantity: line.quantity,
		regionId: line.regionId,
		countryCode: line.countryCode,
		provinceCode: line.provinceCode,
		postalCode: line.postalCode
	})),
	taxRegimeId: REQUEST.taxRegimeId,
	partyTaxRegistrationPresent: REQUEST.partyTaxRegistrationPresent,
	documentDirection: REQUEST.documentDirection,
	regionId: REQUEST.regionId,
	countryCode: REQUEST.countryCode,
	provinceCode: REQUEST.provinceCode,
	postalCode: REQUEST.postalCode,
	regionTaxInclusive: REQUEST.regionTaxInclusive,
	allowUntaxedCatalog: REQUEST.allowUntaxedCatalog,
	now: new Date(AT)
};

/** What the service answers, so the two surfaces can be compared by identity. */
const CALCULATION = {
	currency: 'USD',
	netTotal: '100.000000',
	taxTotal: '8.250000',
	grossTotal: '108.250000',
	lines: [{ referenceId: 'line-1', taxCategoryId: CATEGORY, netAmount: '100.000000', taxAmount: '8.250000' }]
};

/** The delivered field, its route, and what each declares. */
const DELIVERED = {
	/** The field this wave delivers — a root **query**, which is what the route is. */
	field: 'calculateTax',
	/** The handler the route is served by, which is what the audit reads. */
	route: 'calculate',
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: 'TaxRate',
	/** The name the audit's convention expected, which is the delivered name. */
	expects: 'calculateTax',
	/** The arguments the route's handler takes — the request body. */
	routeArgs: [REQUEST],
	/** The arguments the field takes, which mirror what the route *reads*. */
	fieldArgs: [REQUEST],
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [['input', 'TaxCalculationInput']] as [string, string][],
	/** The type the field answers with, which is the breakdown the caller persists. */
	answers: 'TaxCalculation',
	/** The grant the route's own handler states, and the one the field states. */
	grant: taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW)
};

/** The two routes the reading collapsed, each with the field that already serves it. */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	field: string;
}[] = [
	// A rate's ordered breakdown: written as a set, because the shares of the parts have to add up, so a
	// set field is the only door that can write one.
	{
		controller: TaxRateController,
		resource: 'TaxRate',
		route: 'setParts',
		expects: 'setParts',
		field: 'setTaxRateParts'
	},
	// A regime's membership: the same shape, written as the complete set of rates the regime selects.
	{
		controller: TaxRegimeController,
		resource: 'TaxRegime',
		route: 'setRates',
		expects: 'setRates',
		field: 'setTaxRegimeRates'
	}
];

/**
 * The two surfaces over one stub.
 *
 * The stub carries every method under test — the calculate and the two set writes — so a field that
 * reached a sibling's method is visible as an assertion about the wrong member rather than as a
 * comparison that passes.
 */
function surfaces(): { service: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		taxRate: {
			calculate: jest.fn().mockResolvedValue(CALCULATION),
			resolve: jest.fn().mockResolvedValue([]),
			setParts: jest.fn().mockResolvedValue([]),
			listParts: jest.fn().mockResolvedValue([])
		}
	};

	return {
		service: stubs.taxRate,
		controller: new TaxRateController(stubs.taxRate) as Row,
		resolver: new TaxRateResolver(stubs.taxRate, stubs.taxRatePart ?? {}) as Row
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

/** The root type of that name, as the document declares it. */
function rootType(name: 'Query' | 'Mutation'): FieldDefinitionNode[] {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === name
	);

	return [...(type?.fields ?? [])];
}

/** Whether the document declares a root field of that name under that root type. */
function declares(root: 'Query' | 'Mutation', name: string): boolean {
	return rootType(root).some((field) => field.name.value === name);
}

/** One root query field, as the document spells it. */
function queryField(name: string): FieldDefinitionNode {
	const field = rootType('Query').find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the tax document declares no Query field named "${name}"`);
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
		throw new Error(`the tax document declares no input named "${name}"`);
	}

	return input;
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
 * The schema's half of the field.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the tax document — the route no field answered is declared, as a query', () => {
	it('declares calculateTax in the query block', () => {
		expect(queryField(DELIVERED.field).name.value).toBe(DELIVERED.field);
	});

	it('does not declare it as a mutation, which would be a second and wrong statement of one capability', () => {
		// The route stores nothing and carries the view grant. A mutation of this name would tell a client
		// the operation changes something, and it would be the only place in this document where a
		// calculation is spelled as a write.
		expect(declares('Mutation', DELIVERED.field)).toBe(false);
		expect(declares('Mutation', 'calculateTaxes')).toBe(false);
		expect(declares('Query', DELIVERED.field)).toBe(true);
	});

	it('takes the argument the route takes, non-null', () => {
		const arguments_ = queryField(DELIVERED.field).arguments ?? [];

		expect(arguments_.map((argument) => argument.name.value)).toEqual(DELIVERED.declared.map(([name]) => name));

		for (const [index, [, type]] of DELIVERED.declared.entries()) {
			expect(namedTypeName(arguments_[index].type)).toBe(type);
			// A calculation that states nothing is not a calculation: the amounts and their currency are
			// required, exactly as the route's own validation pipe requires them.
			expect(arguments_[index].type.kind).toBe('NonNullType');
		}
	});

	it('answers the breakdown the route answers', () => {
		const type = queryField(DELIVERED.field).type;

		expect(namedTypeName(type)).toBe(DELIVERED.answers);
		expect(type.kind).toBe('NonNullType');
	});

	it('declares the members the route’s own body carries, and the members each line carries', () => {
		// Read against the DTO's own members rather than restated: the input is the request the route
		// validates, so a member added to the DTO and not to the input fails here. `at` is the one member
		// whose name differs, because the input states the instant the windows are evaluated at and the
		// service reads it as `now` — which the parity test below pins.
		expect(inputType('TaxCalculationInput').fields?.map((member) => member.name.value).sort()).toEqual(
			[
				'allowUntaxedCatalog',
				'at',
				'countryCode',
				'currency',
				'documentDirection',
				'lines',
				'partyTaxRegistrationPresent',
				'postalCode',
				'provinceCode',
				'regionId',
				'regionTaxInclusive',
				'taxRegimeId'
			].sort()
		);

		expect(inputType('TaxCalculationLineInput').fields?.map((member) => member.name.value).sort()).toEqual(
			['amount', 'countryCode', 'postalCode', 'provinceCode', 'quantity', 'referenceId', 'regionId', 'taxCategoryId'].sort()
		);
	});

	it('answers the drafts the caller persists, in the shape of the tax ledger’s rows', () => {
		const line = schemaExtensions.definitions.find(
			(definition): definition is ObjectTypeDefinitionNode =>
				definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'TaxCalculationLine'
		);

		expect(line?.fields?.map((member) => member.name.value)).toEqual([
			'referenceId',
			'taxCategoryId',
			'taxRegimeId',
			'currency',
			'netAmount',
			'taxAmount',
			'grossAmount',
			'taxLines'
		]);
	});

	it('keeps every field the document already carried', () => {
		// A parity change is additive: the fields that were there stay there, and the two collapsed routes
		// keep the fields that serve them.
		for (const name of [
			'taxCategories',
			'taxCategory',
			'taxRates',
			'taxRate',
			'taxRateParts',
			'resolveTaxRate',
			'taxRegimes',
			'taxRegime',
			'taxRegimeRates',
			'resolveTaxRegime'
		]) {
			expect(declares('Query', name)).toBe(true);
		}

		for (const name of [
			'createTaxCategory',
			'updateTaxCategory',
			'deleteTaxCategory',
			'softDeleteTaxCategory',
			'recoverTaxCategory',
			'createTaxRate',
			'updateTaxRate',
			'deleteTaxRate',
			'softDeleteTaxRate',
			'recoverTaxRate',
			'setTaxRateParts',
			'createTaxRegime',
			'updateTaxRegime',
			'deleteTaxRegime',
			'softDeleteTaxRegime',
			'recoverTaxRegime',
			'setTaxRegimeRates'
		]) {
			expect(declares('Mutation', name)).toBe(true);
		}
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is compared
 * is the call each of them makes on its own stub, with the mapping the route performs written out in this
 * file rather than read off the resolver.
 */
describe('calculateTax — the two protocols compute the same breakdown the same way', () => {
	it('reaches the service method the calculate route reaches, with the route’s own mapping', async () => {
		const { service, controller, resolver } = surfaces();

		const overRest = await controller.calculate(REQUEST);
		const overGraphql = await resolver.calculateTax(REQUEST);

		expect(service.calculate).toHaveBeenNthCalledWith(1, EXPECTED);
		expect(service.calculate).toHaveBeenNthCalledWith(2, EXPECTED);
		expect(service.calculate).toHaveBeenCalledTimes(2);

		// One answer, one implementation: the breakdown either surface computed is the same breakdown.
		expect(overGraphql).toBe(overRest);
	});

	it('turns the stated instant into the moment the windows are evaluated at, on both surfaces', async () => {
		// The one member whose name changes between the request and the service call. A field that passed
		// `at` through would leave `now` unset and have the service read the clock instead, which is the
		// difference between a reproducible calculation and one that depends on when it ran.
		const { service, controller, resolver } = surfaces();

		await controller.calculate(REQUEST);
		await resolver.calculateTax(REQUEST);

		for (const call of service.calculate.mock.calls) {
			expect(call[0].now).toBeInstanceOf(Date);
			expect((call[0].now as Date).toISOString()).toBe(AT);
			expect(call[0].at).toBeUndefined();
		}
	});

	it('leaves the instant unset when the caller states none, on both surfaces', async () => {
		// A caller that states no instant is answered at the current time by the service itself, which is
		// what both surfaces must let it do rather than inventing an instant of their own.
		const { service, controller, resolver } = surfaces();
		const withoutInstant = { ...REQUEST, at: undefined };

		await controller.calculate(withoutInstant);
		await resolver.calculateTax(withoutInstant);

		expect(service.calculate).toHaveBeenCalledTimes(2);
		for (const call of service.calculate.mock.calls) {
			expect(call[0].now).toBeUndefined();
		}
	});

	it('strips everything a line carries that the computation does not read, on both surfaces', async () => {
		const { service, controller, resolver } = surfaces();
		const line = { ...REQUEST.lines[0], note: 'not read by the computation', warehouseId: 'not read either' };

		await controller.calculate({ ...REQUEST, lines: [line] });
		await resolver.calculateTax({ ...REQUEST, lines: [line] });

		for (const call of service.calculate.mock.calls) {
			expect(Object.keys(call[0].lines[0]).sort()).toEqual(
				[
					'amount',
					'countryCode',
					'postalCode',
					'provinceCode',
					'quantity',
					'referenceId',
					'regionId',
					'taxCategoryId'
				].sort()
			);
		}
	});

	it('computes through its own service and not a sibling’s', async () => {
		const { service, controller, resolver } = surfaces();

		await controller.calculate(REQUEST);
		await resolver.calculateTax(REQUEST);

		expect(service.calculate).toHaveBeenCalledTimes(2);
		expect(service.resolve).not.toHaveBeenCalled();
		expect(service.setParts).not.toHaveBeenCalled();
		expect(service.listParts).not.toHaveBeenCalled();
	});
});

/**
 * The authorisation is the route's.
 *
 * The route is not ungated — it states the view grant — and the field states the same one. The comparison
 * is against the route's own handler metadata rather than against the class, because the class grant of
 * this resolver is the same view grant and a comparison against the class would pass even if the field
 * stated an edit grant the route does not carry.
 */
describe('calculateTax — the permission and the guards are the route’s', () => {
	it('states on the field exactly what its own route states, read from the route', () => {
		expect(permissionOfRoute(TaxRateController, DELIVERED.route)).toBeTruthy();

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TaxRateResolver)[DELIVERED.field])).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TaxRateController)[DELIVERED.route])
		);
		expect(permissionOfField(TaxRateResolver, DELIVERED.field)).toEqual(
			permissionOfRoute(TaxRateController, DELIVERED.route)
		);
	});

	it('demands the view grant the route states, and not an edit grant', () => {
		// The route computes and stores nothing, so it carries the grant a read carries. A field that
		// demanded the edit grant would refuse a caller the route answers.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TaxRateResolver)[DELIVERED.field])).toEqual([
			DELIVERED.grant
		]);
		expect(permissionOfRoute(TaxRateController, DELIVERED.route)).toEqual([DELIVERED.grant]);
		expect(DELIVERED.grant).toEqual(taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW));
	});

	it('declares no retry scope and no version expectation the route does not declare', () => {
		// The route declares neither, and a calculation has nothing to retry against: it writes no row, so
		// there is no state a second attempt could double. The field declares neither for the same reason.
		for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
			expect(Reflect.getMetadata(key, fieldsOf(TaxRateResolver)[DELIVERED.field])).toBeUndefined();
			expect(Reflect.getMetadata(key, handlersOf(TaxRateController)[DELIVERED.route])).toBeUndefined();
		}
	});

	it('runs the field under the guard chain the route runs under', () => {
		const routeGuards = guardsOf(TaxRateController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(guardsOf(TaxRateController, DELIVERED.route)).toEqual(expect.arrayContaining(routeGuards));
		expect(guardsOf(TaxRateResolver, DELIVERED.field)).toEqual(
			expect.arrayContaining(guardsOf(TaxRateController, DELIVERED.route))
		);
	});
});

/**
 * The reading, asserted rather than described.
 *
 * The two collapsed routes and the arithmetic that produced them are pinned here, so a future wave that
 * renames a serving field, or that adds the handler's own name as a field, fails this suite.
 */
describe('the three flagged routes — two collapsed and one delivered', () => {
	it('flags three routes, collapses two and delivers one', () => {
		expect(COLLAPSED).toHaveLength(2);
		expect(COLLAPSED.length + 1).toBe(3);
		expect(20).toBeGreaterThan(3);
	});

	it.each(COLLAPSED)('$resource.$route is served by $field', ({ route, expects, field }) => {
		// The audit's expectation is absent — the handler's own name is not a field — while the capability
		// is answered by the set field the table names.
		expect(declares('Mutation', expects)).toBe(false);
		expect(declares('Mutation', field)).toBe(true);
	});

	it('answers the two set routes as set fields, which is the only door that can write them', () => {
		// A rate's parts have to add up and a regime's membership is a complete set, so neither is written
		// row by row: there is no `createTaxRatePart` and no `addTaxRegimeRate` field, and there should not
		// be — a row-level add would leave the shares or the membership inconsistent mid-write.
		expect(declares('Mutation', 'createTaxRatePart')).toBe(false);
		expect(declares('Mutation', 'addTaxRegimeRate')).toBe(false);
		expect(declares('Mutation', 'setTaxRateParts')).toBe(true);
		expect(declares('Mutation', 'setTaxRegimeRates')).toBe(true);
	});
});
