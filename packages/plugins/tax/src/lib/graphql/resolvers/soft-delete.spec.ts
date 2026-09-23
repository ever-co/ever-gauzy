/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all three
 * of this plugin's controllers serve that pair while not one of its three resolvers declared either
 * field. A client could therefore retire a category, a rate or a regime recoverably over REST and not
 * over GraphQL, where the only deletion-shaped field it held was the destructive one — and the
 * destructive one is exactly what the soft routes exist to avoid on a taxonomy that placed tax lines
 * point at. Six fields close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level view grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the service.** The three controllers are the real ones — including the
 * `softRemove` and `softRecover` overrides, which exist only to state the permission the inherited
 * routes leave unstated — the three resolvers are the real ones, `CrudController` behind them is the
 * kernel's own, and the document the fields are read out of is the real one. The service is the seam
 * the parity requirement is about: one stub is what makes "the same method with the same identifier"
 * visible without a database behind it.
 *
 * This package reaches the kernel's real barrel already — `RequestContext` and `Money` are imported
 * from it by the service specs — so the reason the sibling packages give for doubling `@gauzy/core`
 * (the ESM-only `uuid` nested in the request context) does not apply here: `transformIgnorePatterns`
 * in this package's jest config transforms it instead.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../../tax.permissions';
import { TaxCategoryController } from '../../tax-category/tax-category.controller';
import { TaxRateController } from '../../tax-rate/tax-rate.controller';
import { TaxRegimeController } from '../../tax-regime/tax-regime.controller';
import { schemaExtensions } from '../schema-extensions';
import { TaxCategoryResolver } from './tax-category.resolver';
import { TaxRateResolver } from './tax-rate.resolver';
import { TaxRegimeResolver } from './tax-regime.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a category over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the three resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The type its field answers with: the row, which is what its sibling mutations answer too. */
	answers: string;
	/** The grant its own routes state, which is what the fields must state. */
	edit: string;
	/** The grant its class states, which the fields must not leave the act to. */
	view: string;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/** The three resources whose inherited lifecycle routes had no GraphQL counterpart. */
const RESOURCES: IResource[] = [
	{
		name: 'TaxCategory',
		answers: 'TaxCategory',
		edit: taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT),
		view: taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_VIEW),
		controller: TaxCategoryController,
		resolver: TaxCategoryResolver
	},
	{
		name: 'TaxRate',
		answers: 'TaxRate',
		edit: taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_EDIT),
		view: taxPermission(TAX_PERMISSION_VALUES.TAX_RATES_VIEW),
		controller: TaxRateController,
		resolver: TaxRateResolver
	},
	{
		name: 'TaxRegime',
		answers: 'TaxRegime',
		edit: taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_EDIT),
		view: taxPermission(TAX_PERMISSION_VALUES.TAX_REGIMES_VIEW),
		controller: TaxRegimeController,
		resolver: TaxRegimeResolver
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
 *
 * @param entry The resource whose two surfaces are built.
 * @returns The stub, the controller and the resolver over it.
 */
function surfaces(entry: IParity): { service: Row; controller: Row; resolver: Row } {
	const service = {
		softRemove: jest.fn().mockResolvedValue(RETIRED),
		softRecover: jest.fn().mockResolvedValue(RESTORED)
	};

	return {
		service,
		// The category and rate resolvers take a second collaborator, which no field of the pair reads.
		controller: new entry.controller(service) as Row,
		resolver: new entry.resolver(service, service) as Row
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
		throw new Error('the tax document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the tax document declares no Mutation field named "${name}"`);
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
describe('the tax document — the three inherited lifecycle pairs are declared', () => {
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
		// The REST routes answer the row they retired or restored, and so does every mutation this plugin
		// already declared — `deleteTaxCategory` returns the category it retired rather than a result
		// object — so the pair follows that, not a second shape invented for it.
		for (const { field, answers } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createTaxCategory',
			'updateTaxCategory',
			'deleteTaxCategory',
			'createTaxRate',
			'updateTaxRate',
			'deleteTaxRate',
			'setTaxRateParts',
			'createTaxRegime',
			'updateTaxRegime',
			'deleteTaxRegime',
			'setTaxRegimeRates'
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
 * The pair is destructive in both directions — a soft delete takes a category, a rate or a regime out of
 * every resolution and a recover puts it back into what a destination is taxed under — so a field that
 * left the grant to its class would extend the read permission into a write. That is the defect the
 * controllers' own overrides exist to close on the other surface, and the one a GraphQL caller would
 * otherwise reach it through.
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
		// class would let a reader retire or restore a category, a rate or a regime.
		for (const { field, route, controller, resolver, edit, view } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([edit]);
			expect(permissionOfRoute(controller, route)).toEqual([edit]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, resolver)).toEqual([view]);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(TaxCategoryController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});
