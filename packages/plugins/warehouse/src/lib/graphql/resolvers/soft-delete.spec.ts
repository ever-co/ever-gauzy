/**
 * The `DELETE /:id/soft` and `PUT /:id/recover` pair, on both surfaces (17 §3.1).
 *
 * §3.1 requires capability parity — one mutation per REST write route, "including the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes inherited from `CrudController<T>`" — and all seven
 * of this plugin's controllers serve that pair while not one of its seven resolvers declared either
 * field. A client could therefore retire a zone, a bin, a wave, a list, a line, a slip or a manifest
 * recoverably over REST and not over GraphQL, where the only deletion-shaped fields it held were the
 * destructive ones — and the destructive ones are exactly what the soft routes exist to avoid on rows
 * that other rows point at. Fourteen fields close that, and three properties are pinned for each:
 *
 * - it is **declared** in this plugin's document, with the identifier the route takes and the row its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   so a caller holding only the class-level read grant is refused exactly as the route refuses it;
 * - it **reaches the same service method the route reaches**, with the same identifier, because two
 *   protocols that retire the same kind of row differently are two behaviours waiting to diverge.
 *
 * **Nothing is doubled here but the service.** The seven controllers are the real ones — including the
 * `softRemove` and `softRecover` overrides, which exist only to state the permission the inherited
 * routes leave unstated — the seven resolvers are the real ones, `CrudController` behind them is the
 * kernel's own, and the document the fields are read out of is the real one. The service is the seam the
 * parity requirement is about: one stub is what makes "the same method with the same identifier" visible
 * without a database behind it.
 *
 * `@gauzy/core` is **not** doubled here, unlike the two sibling specs of this directory. Those substitute
 * it because they exercise the connection helpers and need nothing back from it; this suite reads the
 * permission metadata `@gauzy/core`'s own `Permissions` decorator writes, and a no-op double would leave
 * both surfaces unstated so that every comparison below passed on two `undefined`s. The barrel loads
 * under this package's `transformIgnorePatterns`, which is why the sibling plugin packages state that
 * exception.
 */

import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, TypeNode } from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { WarehousePermissions } from '../../warehouse.permissions';
import { CarrierManifestController } from '../../carrier-manifest/carrier-manifest.controller';
import { PackSlipController } from '../../pack-slip/pack-slip.controller';
import { PickListController } from '../../pick-list/pick-list.controller';
import { PickListLineController } from '../../pick-list-line/pick-list-line.controller';
import { PickWaveController } from '../../pick-wave/pick-wave.controller';
import { WarehouseBinController } from '../../warehouse-bin/warehouse-bin.controller';
import { WarehouseZoneController } from '../../warehouse-zone/warehouse-zone.controller';
import { schemaExtensions } from '../schema-extensions';
import { CarrierManifestResolver } from './carrier-manifest.resolver';
import { PackSlipResolver } from './pack-slip.resolver';
import { PickListResolver } from './pick-list.resolver';
import { PickListLineResolver } from './pick-list-line.resolver';
import { PickWaveResolver } from './pick-wave.resolver';
import { WarehouseBinResolver } from './warehouse-bin.resolver';
import { WarehouseZoneResolver } from './warehouse-zone.resolver';

type Row = Record<string, any>;

/** The row both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000010';

/**
 * What the service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that retires a zone over GraphQL and one that
 * retires it over REST must be looking at the same record afterwards.
 */
const RETIRED = { id: ID, deletedAt: new Date('2026-02-01T00:00:00.000Z') };
const RESTORED = { id: ID, deletedAt: null };

/** One of the seven resources, its two surfaces and what its field answers with. */
interface IResource {
	/** The resource as the domain names it, which is what the root fields are built from. */
	name: string;
	/** The payload its field answers with: the shape its sibling mutations answer in. */
	answers: string;
	/** The member of that payload carrying the row, which is what the retired record is read out of. */
	member: string;
	/** The grant its own routes state, which is what the fields must state. */
	grant: string;
	/** The grant its class states, which the fields must not leave the act to. */
	view: string;
	/**
	 * How many collaborators each surface takes after the resource's own service.
	 *
	 * Both surfaces inject the resource's service first; the extra arguments are the second service
	 * two of them take, and no field of the pair reads one, so they are doubled with an empty object.
	 */
	extra: number;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
}

/**
 * The seven resources whose inherited lifecycle routes had no GraphQL counterpart.
 *
 * Read against each controller's own `@Permissions` on the two overrides rather than against a list, so
 * a grant that moves on that surface moves here with it.
 */
const RESOURCES: IResource[] = [
	{
		name: 'WarehouseZone',
		answers: 'WarehouseZonePayload',
		member: 'warehouseZone',
		grant: WarehousePermissions.WAREHOUSE_ZONES_DELETE,
		view: WarehousePermissions.WAREHOUSE_ZONES_VIEW,
		extra: 1,
		controller: WarehouseZoneController,
		resolver: WarehouseZoneResolver
	},
	{
		name: 'WarehouseBin',
		answers: 'WarehouseBinPayload',
		member: 'warehouseBin',
		grant: WarehousePermissions.WAREHOUSE_BINS_DELETE,
		view: WarehousePermissions.WAREHOUSE_BINS_VIEW,
		extra: 1,
		controller: WarehouseBinController,
		resolver: WarehouseBinResolver
	},
	{
		name: 'PickWave',
		answers: 'PickWavePayload',
		member: 'pickWave',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		view: WarehousePermissions.PICK_LISTS_VIEW,
		extra: 1,
		controller: PickWaveController,
		resolver: PickWaveResolver
	},
	{
		name: 'PickList',
		answers: 'PickListPayload',
		member: 'pickList',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		view: WarehousePermissions.PICK_LISTS_VIEW,
		extra: 1,
		controller: PickListController,
		resolver: PickListResolver
	},
	{
		name: 'PickListLine',
		answers: 'PickListLinePayload',
		member: 'pickListLine',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		view: WarehousePermissions.PICK_LISTS_VIEW,
		extra: 1,
		controller: PickListLineController,
		resolver: PickListLineResolver
	},
	{
		name: 'PackSlip',
		answers: 'PackSlipPayload',
		member: 'packSlip',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		view: WarehousePermissions.FULFILLMENTS_VIEW,
		extra: 0,
		controller: PackSlipController,
		resolver: PackSlipResolver
	},
	{
		name: 'CarrierManifest',
		answers: 'CarrierManifestPayload',
		member: 'carrierManifest',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		view: WarehousePermissions.FULFILLMENTS_VIEW,
		extra: 0,
		controller: CarrierManifestController,
		resolver: CarrierManifestResolver
	}
];

/** One root field, the inherited route it mirrors and the service method both must reach. */
interface IParity extends IResource {
	field: string;
	route: string;
	method: string;
}

/**
 * The fourteen fields, built from the seven resources so a resource cannot be listed with only half a
 * pair.
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
	// The collaborators after the resource's own service, which no field of the pair reads.
	const others = Array.from({ length: entry.extra }, () => ({}));

	return {
		service,
		controller: new entry.controller(service, ...others) as Row,
		resolver: new entry.resolver(service, ...others) as Row
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
		throw new Error('the warehouse document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the warehouse document declares no Mutation field named "${name}"`);
	}

	return field;
}

/** One field of one type the document declares, by the type's and the field's names. */
function typeField(typeName: string, fieldName: string): FieldDefinitionNode {
	const type = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === typeName
	);
	const field = type?.fields?.find((candidate) => candidate.name.value === fieldName);

	if (!field) {
		throw new Error(`the warehouse document declares no field "${typeName}.${fieldName}"`);
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
describe('the warehouse document — the seven inherited lifecycle pairs are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the identifier each route takes, and nothing else', () => {
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? []).map((argument) => argument.name.value)).toEqual(['id']);
			expect(namedTypeName((mutationField(field).arguments ?? [])[0].type)).toBe('ID');
		}
	});

	it('answers the payload each resource’s other mutations answer, carrying the resource’s own row', () => {
		// Every mutation of this plugin answers a payload rather than the bare row — `deleteWarehouseZone`
		// answers a `WarehouseZonePayload` whose member is nullable, because a delete has no row left to
		// hand back — so the pair follows that shape, and the retired or restored row rides in the member
		// the resource's other mutations put it in.
		for (const { field, answers, member, name } of PARITY) {
			expect(namedTypeOf(mutationField(field))).toBe(answers);
			expect(namedTypeOf(typeField(answers, member))).toBe(name);
			expect(mutationField(field).type.kind).toBe('NonNullType');
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		const declared = mutationFields().map((field) => field.name.value);

		for (const field of [
			'createWarehouseZone',
			'updateWarehouseZone',
			'reorderWarehouseZones',
			'setWarehouseZoneBlocked',
			'deleteWarehouseZone',
			'createWarehouseBin',
			'createWarehouseBinRange',
			'updateWarehouseBin',
			'reparentWarehouseBin',
			'setWarehouseBinBlocked',
			'deleteWarehouseBin',
			'reconcileWarehouseBins',
			'assignWarehouseBinHome',
			'putAwayWarehouseBin',
			'createPickWave',
			'releasePickWave',
			'startPickWave',
			'completePickWave',
			'closePickWave',
			'closePickWaveShort',
			'cancelPickWave',
			'createPickList',
			'assignPickList',
			'startPickList',
			'completePickList',
			'cancelPickList',
			'pickPickListLine',
			'substitutePickListLine',
			'skipPickListLine',
			'createPackSlip',
			'packPackSlip',
			'voidPackSlip',
			'createCarrierManifest',
			'submitCarrierManifest',
			'handOverCarrierManifest',
			'cancelCarrierManifest'
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

		// One answer, one implementation: the row either surface acted on is the same row, and the field
		// carries it in the member its siblings use rather than reporting a failure it did not have.
		expect(overRest).toBe(entry.method === 'softRemove' ? RETIRED : RESTORED);
		expect(overGraphql).toEqual({ [entry.member]: overRest, userErrors: [] });
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * The pair is destructive in both directions — a soft delete takes a zone, a bin or a batch of work out
 * of every resolution and a recover puts it back into them — so a field that left the grant to its class
 * would extend the read permission into a write. That is the defect the controllers' own overrides exist
 * to close on the other surface, and the one a GraphQL caller would otherwise reach it through.
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

	it('demands the grant the two overrides state rather than the grant the class states', () => {
		// Stated explicitly as well as by comparison, because this is the one a reader will look for: the
		// class-level grant of all seven controllers is the READ grant, and a field that left the act to
		// its class would let a reader retire or restore a zone, a bin or a batch of work. Unlike the
		// controllers, the resolvers state no class-level permission at all — every field carries its own
		// — so the field's statement is the only grant the guard can resolve, and it is asserted not to be
		// the reading one.
		for (const { field, route, controller, resolver, grant, view } of PARITY) {
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([view]);
			expect(grant).not.toEqual(view);
		}
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(WarehouseZoneController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});
});
