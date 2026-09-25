/**
 * The write routes of this package that no field answered, and the reading that collapsed or refused
 * the rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **sixteen** of this package's
 * sixty-four write routes. Two variants of that audit were run — one matching a domain verb by the
 * verb plus the first five characters of the resource, one requiring the resource's full name — and
 * **they report the same sixteen, row for row**. That is not a coincidence, and it is worth stating
 * because the two instruments were built to disagree: the only resources here whose names share a
 * five-character stem are `WarehouseBin` and `WarehouseZone` (both `wareh`), and the only routes where
 * that could bite are their two `unblock` routes, which no field answers under either stem. Every
 * other miss is caused by the verb not being contiguous in the field's name (`closeShort` beside
 * `closePickWaveShort`) or by the capability being served by a field of another shape (`capacityCheck`
 * beside the *query* `warehouseBinCapacity`), and a longer stem cannot repair either.
 *
 * The sixteen are four buckets, and every row of all four is asserted rather than described:
 *
 * - **Eight genuine gaps**, which this suite is mostly about: the update and the destructive delete of
 *   the wave, the list, the slip and the manifest. Each is a capability a REST caller had and a
 *   GraphQL caller did not, and each is delivered here with the arguments its route takes, the
 *   permission its route states and the same service call, in the same order, with the same arguments.
 * - **Three naming variants**, where the capability is already reachable: the wave's short close, which
 *   is `closePickWaveShort`; the bin capacity measurement, which is the *query*
 *   `warehouseBinCapacity` — the route is a read POSTed because it carries a body, and §3.1 says
 *   "Parity is capability parity, not shape parity"; and the bulk range, which is
 *   `createWarehouseBinRange`. The instrument's own expectation for that last one is `bulkWarehouseBin`,
 *   a name this repository's convention never uses — the platform's bulk fields are `bulkCreate<Thing>s`
 *   — and `06` §7.17's own permission catalogue calls the capability "Create a bin, including a bulk
 *   range".
 * - **Two set-field pairs**: `POST /warehouse-bins/:id/unblock` and `POST /warehouse-zones/:id/unblock`
 *   are the second half of a block/unblock pair served by one boolean setter, `setWarehouseBinBlocked`
 *   and `setWarehouseZoneBlocked`, which the instrument cannot match because it looks for the verb
 *   `unblock` in a field's name. `06` §7.17 catalogues the pair as one permission entry — "Update a
 *   bin, move it in the hierarchy, block or unblock it" — so the capability is the pair, not the two
 *   routes.
 * - **Three routes the specifications refuse to mirror**, and the refusal is cited where it is made:
 *   `POST`, `PUT` and `DELETE /pick-list-lines`. `09-inventory-and-fulfillment-spec.md` §14.5 states
 *   the rule in as many words — "**Derivation.** The line set is not authored, it is derived — the
 *   query of §13.2 promoted to rows" — and `16-decision-log-and-open-questions.md` ADR-49 gives
 *   `pick_list_line` as "the picking work **derived from fulfillments**". The resource is in no
 *   catalogue at all: the string `/pick-list-lines` occurs nowhere in `docs/`, no `PICK_LIST_LINES_*`
 *   permission is declared, and the line is addressed everywhere else as a sub-route of
 *   `/pick-lists/:id/lines/…`. §3.1's parity obligation is scoped "for every resource in
 *   `06-api-specification.md` §7", and this is not one.
 *
 * **The counter-evidence is recorded rather than hidden, because it is strong.** The controller and the
 * service implement those three routes deliberately, and their own words say why: "this surface exists
 * for the two cases that are not derivation: a replenishment line, which serves no order, and the
 * corrected line an operator writes by hand". The specification has a door for exactly that — the
 * replenishment route `POST /api/pick-lists/replenish` of §14.12 — and **that route is not implemented
 * in this package**: the capability was re-homed into the line resource in code. So the refusal rests on
 * the derivation sentence plus the resource's absence from every catalogue, and it is **medium-high
 * confidence for the create and medium for the update and the delete**, because those two rewrite and
 * remove a row the derivation owns rather than bringing a line set into being. The three fields an owner
 * ruling the other way would get are `createPickListLine`, `updatePickListLine` and
 * `deletePickListLine`; their absence is asserted below, so adding one fails here first.
 *
 * Three properties are pinned for each of the eight, exactly as the lifecycle pair's suite pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes, the payload its
 *   siblings answer and the members the route's own body carries — read from the DTO the route
 *   validates, so a member added to a DTO and not to the input fails this;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of all four of these
 *   controllers is the *view* grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches** — every delegation
 *   the route makes, in the order it makes them — because two protocols that perform one act
 *   differently are two behaviours waiting to diverge. The eight routes declare **neither**
 *   `@Versioned` nor `@Idempotent`, and the fields mirror that silence: a scope or a version invented
 *   here would refuse or replay over GraphQL a request the REST route lets through, which is a
 *   difference in behaviour rather than in transport.
 *
 * **Three divergences between the routes and the specification are pinned rather than papered over**,
 * because a field has to be one thing or the other and this programme's rule is that it mirrors the
 * route:
 *
 * 1. `09` §14.12 gives `GET`/`PUT /api/carrier-manifests/:id` the grants `PICK_LISTS_VIEW` /
 *    `PICK_LISTS_EDIT`; the route states `FULFILLMENTS_EDIT`, and `06` §7.17 and `appendix-b` agree with
 *    the route. The field states `FULFILLMENTS_EDIT` with it, and the divergence is asserted below.
 *    (§14.12 uses `PICK_LISTS_*` for every zone, bin, slip and manifest row, contradicting `06` §7.17
 *    and the appendix across the whole domain; the code follows `06`.)
 * 2. `06` §7.17 gives `POST /warehouse-bins` and `DELETE /warehouse-bins/:id` the grant
 *    `WAREHOUSE_BINS_EDIT`; the routes state `WAREHOUSE_BINS_CREATE` and `WAREHOUSE_BINS_DELETE`, which
 *    is what `appendix-b`'s permission table says. Asserted as a measurement; nothing is changed here.
 * 3. `06` §7.17 marks `POST /pack-slips/:id/pack` "Yes (Idempotency-Key, **required**)" and the
 *    manifest's dispatch route "Yes (Idempotency-Key, **required**)". The pack route declares
 *    `required: false`, the dispatch route is named `submit` and declares no `@Idempotent` at all, and
 *    the suite records both readings so that whoever settles them changes both surfaces together.
 *
 * **`17` §3.2's warehouse row is stale in both directions and is therefore not used here as a source
 * for what must not exist.** Four names it declares exist nowhere in the repository
 * (`assignPickListToWave`, `completePickListLine`, `closePackSlip`, `closeCarrierManifest`), and the
 * document this package contributes declares mutations the row does not name. A row that is wrong in
 * both directions cannot refuse a field, which is why the refusals above rest on `09` §14.5 and on the
 * absence of the resource from every catalogue instead. The specification is the programme owner's to
 * reconcile and is not edited here.
 *
 * **Nothing is doubled here but the services.** The six controllers are the real ones, the four
 * resolvers are the real ones with their own decorators and signatures, `CrudController` behind them is
 * written as the kernel writes it, and the document the fields are read out of is the real one. A
 * resolver's other collaborators are stubs of their own rather than copies of the one under test, so a
 * field that reached the wrong service is visible instead of passing on a shared double.
 *
 * The kernel barrel is doubled for the reason this package's other suites state: `@gauzy/core` boots
 * the whole application graph from its barrel, the demonstration database configuration among it, so a
 * suite that reads one controller through it pays for the platform. The inherited-route delegation this
 * suite drives is carried across as `CrudController` writes it — `delete(id)` calling
 * `this.crudService.delete(id)` — so the delegation compared below is the platform's shape and not an
 * invention of this file.
 */

jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	// The kernel's own declarations and its conditional write, so the classes under test are declared
	// with the platform's decorators rather than with no-ops.
	const idempotency = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');
	const versionUtil = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The CRUD base, as the controllers extend it.
	 *
	 * The destructive route is the subject of four rows here — one per aggregate — so it is written as
	 * `packages/core/src/lib/core/crud/crud.controller.ts` writes it, the identifier and the service
	 * call, rather than omitted.
	 */
	class CrudController {
		constructor(protected readonly crudService: any) {}
		async delete(id: any, ...options: any[]): Promise<any> {
			return this.crudService.delete(id);
		}
		async softRemove(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRemove(id, options);
		}
		async softRecover(id: any, ...options: any[]): Promise<any> {
			return this.crudService.softRecover(id, options);
		}
	}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		FeatureModule: class {},
		RolePermissionModule: class {},
		SequenceModule: class {},
		SequenceService: class SequenceService {},
		User: class User {},
		Warehouse: class Warehouse {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		// The soft-delete and recover routes construct this pipe at class-definition time, so the double
		// has to export the class those routes build.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class UUIDValidationPipe {},
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: idempotency.IDEMPOTENT_METADATA_KEY,
		Versioned: versioned.Versioned,
		// The key the decorator above writes, so the suite can read back what each surface declared.
		VERSIONED_METADATA_KEY: versionUtil.VERSIONED_METADATA_KEY,
		VERSION_EXPECTATION_PROPERTY: versionUtil.VERSION_EXPECTATION_PROPERTY,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		// The conditional-write SQL conveniences the services and repositories import.
		prepareSQLQuery: (query: unknown) => query,
		toPositionalStatement: (query: unknown) => query,
		registerUnitReferences: () => undefined,
		UnitCategoryCode: {},
		// The page window and the connection the list fields answer with are the kernel's own, so a
		// resolver that is loaded here is loaded with the platform's helpers rather than with holes.
		...jest.requireActual('@gauzy/core/src/lib/api/graphql-connection'),
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

/** The feature-flag decorator is the only value these modules read from `@gauzy/common`. */
jest.mock(
	'@gauzy/common',
	() => ({
		FeatureFlag: () => () => undefined
	}),
	{ virtual: true }
);

import { getMetadataStorage } from 'class-validator';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IDEMPOTENT_METADATA_KEY, PermissionGuard, TenantPermissionGuard, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { WarehousePermissions } from '../../warehouse.permissions';
import { CarrierManifestController } from '../../carrier-manifest/carrier-manifest.controller';
import { UpdateCarrierManifestDTO } from '../../carrier-manifest/dto';
import { PackSlipController } from '../../pack-slip/pack-slip.controller';
import { UpdatePackSlipDTO } from '../../pack-slip/dto';
import { PickListController } from '../../pick-list/pick-list.controller';
import { UpdatePickListDTO } from '../../pick-list/dto';
import { PickListLineController } from '../../pick-list-line/pick-list-line.controller';
import { UpdatePickListLineDTO } from '../../pick-list-line/dto';
import { PickWaveController } from '../../pick-wave/pick-wave.controller';
import { UpdatePickWaveDTO } from '../../pick-wave/dto';
import { WarehouseBinController } from '../../warehouse-bin/warehouse-bin.controller';
import { WarehouseZoneController } from '../../warehouse-zone/warehouse-zone.controller';
import { schemaExtensions } from '../schema-extensions';
import { CarrierManifestResolver } from './carrier-manifest.resolver';
import { PackSlipResolver } from './pack-slip.resolver';
import { PickListResolver } from './pick-list.resolver';
import { PickWaveResolver } from './pick-wave.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ID = '00000000-0000-4000-8000-000000000020';
const WAREHOUSE = '00000000-0000-4000-8000-000000000021';
const CHANNEL = '00000000-0000-4000-8000-000000000022';
const ZONE = '00000000-0000-4000-8000-000000000023';
const PICKER = '00000000-0000-4000-8000-000000000024';
const ORDER = '00000000-0000-4000-8000-000000000025';
const FULFILLMENT = '00000000-0000-4000-8000-000000000026';
const PICK_LIST = '00000000-0000-4000-8000-000000000027';

/** The prose both surfaces keep, which is the operator's and not the service's. */
const NOTE = 'recoded after the aisle was renumbered';
const TRACKING = 'RR123456789GB';
const CARRIER = 'royal-mail';
const WEIGHT = '2.4500';
const VOLUME = '0.1200';

/** The instants a patch may state, one per column an edit names. */
const PLANNED = new Date('2026-04-01T08:00:00.000Z');
const RELEASED = new Date('2026-04-01T09:00:00.000Z');
const STARTED = new Date('2026-04-01T09:30:00.000Z');
const COMPLETED = new Date('2026-04-01T11:00:00.000Z');
const MANIFEST_DAY = new Date('2026-04-02T00:00:00.000Z');
const WINDOW_FROM = new Date('2026-04-02T07:00:00.000Z');
const WINDOW_TO = new Date('2026-04-02T12:00:00.000Z');
const CLOSED_AT = new Date('2026-04-02T12:05:00.000Z');
const HANDED_OVER_AT = new Date('2026-04-02T12:30:00.000Z');
const CANCELED_AT = new Date('2026-04-02T13:00:00.000Z');
const PACKED_AT = new Date('2026-04-01T13:00:00.000Z');

/**
 * The bodies each route validates, stated in full so the two surfaces build the same patch.
 *
 * Every member each input declares is stated rather than left absent, because a member left out would
 * make the comparison below depend on how each surface treats an absent key rather than on what either
 * of them writes. The members are the route's own: `PUT /<resource>/:id` is typed
 * `Update<Resource>DTO & <Resource>DTO`, whose validated member set is the read model's own columns.
 */
const WAVE_EDIT = {
	warehouseId: WAREHOUSE,
	channelId: CHANNEL,
	number: 'WAVE-0002',
	strategy: 'BATCH',
	status: 'DRAFT',
	priority: 5,
	pickerUserId: PICKER,
	plannedAt: PLANNED,
	releasedAt: RELEASED,
	startedAt: STARTED,
	completedAt: COMPLETED,
	orderCount: 3,
	lineCount: 12,
	version: 4,
	metadata: { amended: true }
};

const LIST_EDIT = {
	waveId: ID,
	warehouseId: WAREHOUSE,
	zoneId: ZONE,
	fulfillmentId: FULFILLMENT,
	orderId: ORDER,
	number: 'PICK-0002',
	status: 'ASSIGNED',
	assignedToUserId: PICKER,
	priority: 7,
	lineCount: 12,
	pickedCount: 4,
	shortCount: 1,
	startedAt: STARTED,
	completedAt: COMPLETED,
	note: NOTE,
	version: 3,
	metadata: { amended: true }
};

const SLIP_EDIT = {
	warehouseId: WAREHOUSE,
	pickListId: PICK_LIST,
	orderId: ORDER,
	fulfillmentId: FULFILLMENT,
	number: 'SLIP-0002',
	status: 'OPEN',
	carrierKey: CARRIER,
	packageCount: 2,
	totalWeight: WEIGHT,
	totalVolume: VOLUME,
	trackingNumber: TRACKING,
	labelUrl: 'https://carrier.example/l/2',
	packedAt: PACKED_AT,
	packedByUserId: PICKER,
	note: NOTE,
	version: 2,
	metadata: { amended: true }
};

const MANIFEST_EDIT = {
	warehouseId: WAREHOUSE,
	carrier: CARRIER,
	service: 'tracked-24',
	number: 'MAN-0002',
	status: 'DRAFT',
	manifestDate: MANIFEST_DAY,
	windowFrom: WINDOW_FROM,
	windowTo: WINDOW_TO,
	shipmentCount: 2,
	packageCount: 3,
	totalWeight: WEIGHT,
	closedAt: CLOSED_AT,
	handedOverAt: HANDED_OVER_AT,
	canceledAt: CANCELED_AT,
	documentUrl: 'https://carrier.example/m/2',
	documentData: { rows: 2 },
	note: NOTE,
	version: 5,
	metadata: { amended: true }
};

/** The members each read model declares, which is what the route's body accepts and the input carries. */
const WAVE_MEMBERS = [
	'channelId',
	'completedAt',
	'lineCount',
	'metadata',
	'number',
	'orderCount',
	'pickerUserId',
	'plannedAt',
	'priority',
	'releasedAt',
	'startedAt',
	'status',
	'strategy',
	'version',
	'warehouseId'
];

const LIST_MEMBERS = [
	'assignedToUserId',
	'completedAt',
	'fulfillmentId',
	'lineCount',
	'metadata',
	'note',
	'number',
	'orderId',
	'pickedCount',
	'priority',
	'shortCount',
	'startedAt',
	'status',
	'version',
	'warehouseId',
	'waveId',
	'zoneId'
];

const SLIP_MEMBERS = [
	'carrierKey',
	'fulfillmentId',
	'labelUrl',
	'metadata',
	'note',
	'number',
	'orderId',
	'packageCount',
	'packedAt',
	'packedByUserId',
	'pickListId',
	'status',
	'totalVolume',
	'totalWeight',
	'trackingNumber',
	'version',
	'warehouseId'
];

const MANIFEST_MEMBERS = [
	'canceledAt',
	'carrier',
	'closedAt',
	'documentData',
	'documentUrl',
	'handedOverAt',
	'manifestDate',
	'metadata',
	'note',
	'number',
	'packageCount',
	'service',
	'shipmentCount',
	'status',
	'totalWeight',
	'version',
	'warehouseId',
	'windowFrom',
	'windowTo'
];

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that edits a wave over GraphQL and one that edits
 * it over REST must be looking at the same record afterwards.
 */
const WAVE = { id: ID, number: 'WAVE-0002', status: 'DRAFT', version: 5 };
const LIST = { id: ID, number: 'PICK-0002', status: 'ASSIGNED', version: 4 };
const SLIP = { id: ID, number: 'SLIP-0002', status: 'OPEN', version: 3 };
const MANIFEST = { id: ID, number: 'MAN-0002', status: 'DRAFT', version: 6 };
const REMOVED = { affected: 1, raw: [] };

/**
 * What a collaborator other than the resource's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: ID, wrong: true };

/** The service that owns one capability, which is the stub the field has to reach. */
type ServiceKey = 'pickWave' | 'pickList' | 'packSlip' | 'carrierManifest';

/**
 * The methods any of the eight fields and their routes could reach, which every stub therefore carries.
 *
 * A collaborator is only useful as a negative control if it *could* have answered the call: a stub
 * without the method would make "no other service was touched" pass on an absence rather than on a
 * measurement.
 */
const CAPABILITY_METHODS = [
	'update',
	'delete',
	'findOneDetailed',
	'findOneScoped',
	'create',
	'assign',
	'start',
	'complete',
	'cancel',
	'release',
	'close',
	'closeShort',
	'pack',
	'void',
	'handOver',
	'softRemove',
	'softRecover',
	'createWaveWithLists'
];

/**
 * One of the eight routes, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for. */
	expects: string;
	/** The body both surfaces are handed, carrying every member the input declares. */
	patch: Row;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces, for the method below. */
	serviceArgs: any[];
	/** The further delegations both surfaces make, in the order the route makes them. */
	alsoCalls: [string, any[]][];
	/** Whether the route removes the row rather than editing it. */
	destructive: boolean;
	/** The member the payload carries the answer under. */
	member: string;
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: PermissionsEnum;
	/** The method both surfaces must reach, checked by the assertions above. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The eight routes no field answered.
 *
 * Each is a capability rather than a spare route: editing a wave before it is released, editing a pick
 * list's assignee, priority and note, correcting an open slip's weight and label, correcting a draft
 * manifest's day and window, and the four destructive removals the framework's base controller serves.
 * None of them was reachable, because the fields that existed moved a status, recorded an outcome or
 * retired a row recoverably and none of them wrote what these write.
 */
const PARITY: IParity[] = [
	{
		field: 'updatePickWave',
		route: 'update',
		resource: 'PickWave',
		expects: 'updatePickWave',
		patch: WAVE_EDIT,
		routeArgs: [ID, WAVE_EDIT],
		fieldArgs: [ID, WAVE_EDIT],
		serviceArgs: [ID, WAVE_EDIT],
		alsoCalls: [['findOneDetailed', [ID]]],
		destructive: false,
		member: 'pickWave',
		declared: [
			['id', 'ID'],
			['input', 'UpdatePickWaveInput']
		],
		answers: 'PickWavePayload',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		method: 'update',
		service: 'pickWave',
		controller: PickWaveController,
		resolver: PickWaveResolver,
		build: (stubs) => ({
			controller: new PickWaveController(stubs.pickWave, stubs.pickList) as Row,
			resolver: new PickWaveResolver(stubs.pickWave, stubs.pickList) as Row
		})
	},
	{
		field: 'deletePickWave',
		route: 'delete',
		resource: 'PickWave',
		expects: 'deletePickWave',
		patch: {},
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		destructive: true,
		member: 'pickWave',
		declared: [['id', 'ID']],
		answers: 'PickWavePayload',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		method: 'delete',
		service: 'pickWave',
		controller: PickWaveController,
		resolver: PickWaveResolver,
		build: (stubs) => ({
			controller: new PickWaveController(stubs.pickWave, stubs.pickList) as Row,
			resolver: new PickWaveResolver(stubs.pickWave, stubs.pickList) as Row
		})
	},
	{
		field: 'updatePickList',
		route: 'update',
		resource: 'PickList',
		expects: 'updatePickList',
		patch: LIST_EDIT,
		routeArgs: [ID, LIST_EDIT],
		fieldArgs: [ID, LIST_EDIT],
		serviceArgs: [ID, LIST_EDIT],
		alsoCalls: [['findOneDetailed', [ID]]],
		destructive: false,
		member: 'pickList',
		declared: [
			['id', 'ID'],
			['input', 'UpdatePickListInput']
		],
		answers: 'PickListPayload',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		method: 'update',
		service: 'pickList',
		controller: PickListController,
		resolver: PickListResolver,
		build: (stubs) => ({
			controller: new PickListController(stubs.pickList, stubs.pickListLine) as Row,
			resolver: new PickListResolver(stubs.pickList, stubs.pickListLine) as Row
		})
	},
	{
		field: 'deletePickList',
		route: 'delete',
		resource: 'PickList',
		expects: 'deletePickList',
		patch: {},
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		destructive: true,
		member: 'pickList',
		declared: [['id', 'ID']],
		answers: 'PickListPayload',
		grant: WarehousePermissions.PICK_LISTS_EDIT,
		method: 'delete',
		service: 'pickList',
		controller: PickListController,
		resolver: PickListResolver,
		build: (stubs) => ({
			controller: new PickListController(stubs.pickList, stubs.pickListLine) as Row,
			resolver: new PickListResolver(stubs.pickList, stubs.pickListLine) as Row
		})
	},
	{
		field: 'updatePackSlip',
		route: 'update',
		resource: 'PackSlip',
		expects: 'updatePackSlip',
		patch: SLIP_EDIT,
		routeArgs: [ID, SLIP_EDIT],
		fieldArgs: [ID, SLIP_EDIT],
		serviceArgs: [ID, SLIP_EDIT],
		alsoCalls: [['findOneDetailed', [ID]]],
		destructive: false,
		member: 'packSlip',
		declared: [
			['id', 'ID'],
			['input', 'UpdatePackSlipInput']
		],
		answers: 'PackSlipPayload',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		method: 'update',
		service: 'packSlip',
		controller: PackSlipController,
		resolver: PackSlipResolver,
		build: (stubs) => ({
			controller: new PackSlipController(stubs.packSlip) as Row,
			resolver: new PackSlipResolver(stubs.packSlip) as Row
		})
	},
	{
		field: 'deletePackSlip',
		route: 'delete',
		resource: 'PackSlip',
		expects: 'deletePackSlip',
		patch: {},
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		destructive: true,
		member: 'packSlip',
		declared: [['id', 'ID']],
		answers: 'PackSlipPayload',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		method: 'delete',
		service: 'packSlip',
		controller: PackSlipController,
		resolver: PackSlipResolver,
		build: (stubs) => ({
			controller: new PackSlipController(stubs.packSlip) as Row,
			resolver: new PackSlipResolver(stubs.packSlip) as Row
		})
	},
	{
		field: 'updateCarrierManifest',
		route: 'update',
		resource: 'CarrierManifest',
		expects: 'updateCarrierManifest',
		patch: MANIFEST_EDIT,
		routeArgs: [ID, MANIFEST_EDIT],
		fieldArgs: [ID, MANIFEST_EDIT],
		serviceArgs: [ID, MANIFEST_EDIT],
		alsoCalls: [['findOneScoped', [ID]]],
		destructive: false,
		member: 'carrierManifest',
		declared: [
			['id', 'ID'],
			['input', 'UpdateCarrierManifestInput']
		],
		answers: 'CarrierManifestPayload',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		method: 'update',
		service: 'carrierManifest',
		controller: CarrierManifestController,
		resolver: CarrierManifestResolver,
		build: (stubs) => ({
			controller: new CarrierManifestController(stubs.carrierManifest) as Row,
			resolver: new CarrierManifestResolver(stubs.carrierManifest) as Row
		})
	},
	{
		field: 'deleteCarrierManifest',
		route: 'delete',
		resource: 'CarrierManifest',
		expects: 'deleteCarrierManifest',
		patch: {},
		routeArgs: [ID],
		fieldArgs: [ID],
		serviceArgs: [ID],
		alsoCalls: [],
		destructive: true,
		member: 'carrierManifest',
		declared: [['id', 'ID']],
		answers: 'CarrierManifestPayload',
		grant: WarehousePermissions.FULFILLMENTS_EDIT,
		method: 'delete',
		service: 'carrierManifest',
		controller: CarrierManifestController,
		resolver: CarrierManifestResolver,
		build: (stubs) => ({
			controller: new CarrierManifestController(stubs.carrierManifest) as Row,
			resolver: new CarrierManifestResolver(stubs.carrierManifest) as Row
		})
	}
];

/**
 * The four update inputs, each held to the DTO the route validates its body with.
 *
 * The comparison is read from the DTO rather than restated in the document, so a member added to a
 * read model and not to the input fails here — which is the failure that would otherwise reach a
 * caller as a field they cannot set over GraphQL and can over REST.
 */
const UPDATE_INPUTS: { field: string; input: string; dto: new (...args: any[]) => any; members: string[] }[] = [
	{ field: 'updatePickWave', input: 'UpdatePickWaveInput', dto: UpdatePickWaveDTO, members: WAVE_MEMBERS },
	{ field: 'updatePickList', input: 'UpdatePickListInput', dto: UpdatePickListDTO, members: LIST_MEMBERS },
	{ field: 'updatePackSlip', input: 'UpdatePackSlipInput', dto: UpdatePackSlipDTO, members: SLIP_MEMBERS },
	{
		field: 'updateCarrierManifest',
		input: 'UpdateCarrierManifestInput',
		dto: UpdateCarrierManifestDTO,
		members: MANIFEST_MEMBERS
	}
];

/**
 * The five routes the reading collapsed, each with the fields that already serve it.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is: the
 * audit's expectation for each is asserted absent below — and, for the verb-shaped rows, absent as a
 * substring of every field's name beside the first five letters of the resource, which is the test the
 * instrument itself applies — so this table fails if a future wave renames a serving field out from
 * under the routes that name it in their own docstrings.
 */
const SERVED_ELSEWHERE: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The audit's expectation: a name for a CRUD handler, and the verb itself for a domain one. */
	expects: string;
	/** Whether the audit looks for the verb anywhere in a field's name rather than for the name itself. */
	verb: boolean;
	/** Whether the audit's bulk branch looks for the word `bulk` in any field instead. */
	bulk?: boolean;
	/** Which of the two shapes this collapse is. */
	kind: 'naming' | 'set';
	/** The operation type the serving field is declared in, which for the capacity read is a query. */
	operation: 'query' | 'mutation';
	/** The fields that answer the capability, at least one of which must be declared. */
	served: string[];
}[] = [
	// The wave's short close. The handler is `closeShort` and the field is `closePickWaveShort`, which
	// carries the verb in three pieces — close, the resource, short — so the instrument's substring test
	// for `closeshort` finds nothing. The two surfaces reach one service method with one reason, and the
	// permission is the cancel grant both state, which `appendix-b` gives that route on its own line:
	// "Close a wave short, releasing its bin pins".
	{
		controller: PickWaveController,
		resource: 'PickWave',
		route: 'closeShort',
		expects: 'closeShort',
		verb: true,
		kind: 'naming',
		operation: 'mutation',
		served: ['closePickWaveShort']
	},
	// The capacity measurement. The route is a POST because it carries a body, and the capability is a
	// read, so the field is the query `warehouseBinCapacity` — the same service method, the same
	// arguments, the same `WAREHOUSE_BINS_VIEW` grant. §3.1's own words: "Parity is capability parity,
	// not shape parity", and "Parity is not 'every REST route becomes a root field with the same name'".
	{
		controller: WarehouseBinController,
		resource: 'WarehouseBin',
		route: 'capacityCheck',
		expects: 'capacityCheck',
		verb: true,
		kind: 'naming',
		operation: 'query',
		served: ['warehouseBinCapacity']
	},
	// The bulk range. `06` §7.17's permission catalogue calls the capability "Create a bin, including a
	// bulk range", and the field is named for the operation rather than for the transport: the audit's
	// expectation `bulkWarehouseBin` is a name this repository never uses — its convention is
	// `bulkCreate<Thing>s` — and the bulk branch matches *any* field containing `bulk`, so one such
	// field anywhere in the package would silence every bulk route in it.
	{
		controller: WarehouseBinController,
		resource: 'WarehouseBin',
		route: 'createRange',
		expects: 'bulkWarehouseBin',
		verb: false,
		bulk: true,
		kind: 'naming',
		operation: 'mutation',
		served: ['createWarehouseBinRange']
	},
	// The two block/unblock pairs. The route is the second half of the pair and the field is one boolean
	// setter, so the instrument's search for the verb `unblock` finds nothing while the capability — the
	// pair — is answered. `06` §7.17 catalogues each pair as one permission entry.
	{
		controller: WarehouseBinController,
		resource: 'WarehouseBin',
		route: 'unblock',
		expects: 'unblock',
		verb: true,
		kind: 'set',
		operation: 'mutation',
		served: ['setWarehouseBinBlocked']
	},
	{
		controller: WarehouseZoneController,
		resource: 'WarehouseZone',
		route: 'unblock',
		expects: 'unblock',
		verb: true,
		kind: 'set',
		operation: 'mutation',
		served: ['setWarehouseZoneBlocked']
	}
];

/**
 * The three routes the specifications refuse to mirror.
 *
 * `09-inventory-and-fulfillment-spec.md` §14.5 is the rule: "**Derivation.** The line set is not
 * authored, it is derived — the query of §13.2 promoted to rows", and the derivation it prints is an
 * `INSERT … SELECT` over `fulfillment_line`. `16-decision-log-and-open-questions.md` ADR-49 says the
 * same of the table: "`pick_list` and `pick_list_line` | the picking work derived from fulfillments".
 * The resource is in no catalogue: `/pick-list-lines` occurs nowhere in `docs/`, no
 * `PICK_LIST_LINES_*` permission exists, `06` §7.17 and `17` §3.2's warehouse row list only the six
 * catalogued resources, and `09` §14.12 addresses the line as a sub-route of `/pick-lists/:id/lines/…`.
 * A field mirroring the route would declare the line set authorable, which is the one thing the
 * derivation sentence denies.
 *
 * The counter-evidence is strong and is not hidden: the plugin implements the three routes on purpose
 * and its own docstrings say why — "this surface exists for the two cases that are not derivation: a
 * replenishment line, which serves no order, and the corrected line an operator writes by hand" — and
 * the specification's own door for that case, `POST /api/pick-lists/replenish` (`09` §14.12), is **not
 * implemented**, so the capability was re-homed into this resource in code. Confidence is medium-high
 * for the create and medium for the update and the delete; the field each would add is named in the
 * table and asserted absent, so delivering one fails here first.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	/** The field an owner ruling the other way would add, and the DTO whose columns it would patch. */
	fields: string[];
	dto: new (...args: any[]) => any;
	/** How settled the refusal is, so a later wave does not have to rediscover the confidence. */
	confidence: 'medium-high' | 'medium';
}[] = [
	{
		controller: PickListLineController,
		resource: 'PickListLine',
		route: 'create',
		expects: 'createPickListLine',
		fields: ['createPickListLine'],
		dto: UpdatePickListLineDTO,
		confidence: 'medium-high'
	},
	{
		controller: PickListLineController,
		resource: 'PickListLine',
		route: 'update',
		expects: 'updatePickListLine',
		fields: ['updatePickListLine'],
		dto: UpdatePickListLineDTO,
		confidence: 'medium'
	},
	{
		controller: PickListLineController,
		resource: 'PickListLine',
		route: 'delete',
		expects: 'deletePickListLine',
		fields: ['deletePickListLine'],
		dto: UpdatePickListLineDTO,
		confidence: 'medium'
	}
];

/**
 * The counts the reading turns on, stated so the arithmetic below is a test rather than a sentence.
 *
 * `FLAGGED` is what both instruments reported — the loose one and the strict one, with the same rows —
 * and the three tables above classify every one of the sixteen.
 */
const FLAGGED = 16;

/** The handler names the instrument expects to be answered by an exact `<verb><Resource>` field. */
const CRUD_HANDLERS = ['create', 'update', 'delete', 'softRemove', 'softRecover'];

/** The mutations the document carried before this wave, which a parity change leaves standing. */
const PRE_EXISTING = [
	'createWarehouseZone',
	'updateWarehouseZone',
	'reorderWarehouseZones',
	'setWarehouseZoneBlocked',
	'deleteWarehouseZone',
	'softDeleteWarehouseZone',
	'recoverWarehouseZone',
	'createWarehouseBin',
	'createWarehouseBinRange',
	'updateWarehouseBin',
	'reparentWarehouseBin',
	'setWarehouseBinBlocked',
	'deleteWarehouseBin',
	'softDeleteWarehouseBin',
	'recoverWarehouseBin',
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
	'softDeletePickWave',
	'recoverPickWave',
	'createPickList',
	'assignPickList',
	'startPickList',
	'completePickList',
	'cancelPickList',
	'softDeletePickList',
	'recoverPickList',
	'pickPickListLine',
	'substitutePickListLine',
	'skipPickListLine',
	'softDeletePickListLine',
	'recoverPickListLine',
	'createPackSlip',
	'packPackSlip',
	'voidPackSlip',
	'softDeletePackSlip',
	'recoverPackSlip',
	'createCarrierManifest',
	'submitCarrierManifest',
	'handOverCarrierManifest',
	'cancelCarrierManifest',
	'softDeleteCarrierManifest',
	'recoverCarrierManifest'
];

/**
 * The members a DTO validates, its own and the ones it inherits.
 *
 * The wholesale read, needed because a `PartialType` returns a class the declared DTO only *extends*, so
 * the metadata it copied carries the returned class as its target and an own-target read of the
 * declared one would find nothing at all.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function allDtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName))).sort();
}

/**
 * One collaborator stub, answering the row it is given with every method the eight fields could reach.
 *
 * @param answer What the stub answers with.
 * @returns The stub.
 */
function collaborator(answer: unknown): Row {
	return Object.fromEntries(CAPABILITY_METHODS.map((method) => [method, jest.fn().mockResolvedValue(answer)]));
}

/**
 * Both surfaces over the stubs that own them.
 *
 * One stub per capability, and every other collaborator is a stub of its own answering a *different*
 * row, so a field wired to the wrong service is caught by the identity assertion rather than hidden
 * behind a shared double.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		pickWave: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(WAVE),
			findOneDetailed: jest.fn().mockResolvedValue(WAVE),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		pickList: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(LIST),
			findOneDetailed: jest.fn().mockResolvedValue(LIST),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		pickListLine: {
			...collaborator(FOREIGN),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		packSlip: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(SLIP),
			findOneDetailed: jest.fn().mockResolvedValue(SLIP),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		carrierManifest: {
			...collaborator(FOREIGN),
			update: jest.fn().mockResolvedValue(MANIFEST),
			findOneScoped: jest.fn().mockResolvedValue(MANIFEST),
			delete: jest.fn().mockResolvedValue(REMOVED)
		},
		// Everything else a resolver injects: a field that reached one of them would answer the foreign
		// row.
		foreign: collaborator(FOREIGN)
	};

	const { controller, resolver } = entry.build(stubs);

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

/** The guards one surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler?: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = handler ? Reflect.getMetadata('__guards__', handlersOf(surface)[handler]) ?? [] : [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The root fields of one operation type, as the document declares them. */
function rootFieldsOf(operation: 'Query' | 'Mutation'): FieldDefinitionNode[] {
	const declared = schemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === operation
	);

	if (!declared?.fields?.length) {
		throw new Error(`the warehouse document declares no ${operation} fields`);
	}

	return [...declared.fields];
}

/** The root mutation type's own fields. */
function mutationFields(): FieldDefinitionNode[] {
	return rootFieldsOf('Mutation');
}

/** Every root mutation field's name, in the order the document states them. */
function mutationNames(): string[] {
	return mutationFields().map((field) => field.name.value);
}

/** Every root query field's name, in the order the document states them. */
function queryNames(): string[] {
	return rootFieldsOf('Query').map((field) => field.name.value);
}

/**
 * Every root field's name, of either operation type.
 *
 * This is the pool the audit itself reads: its field reader matches `@Query` and `@Mutation` alike, so a
 * capability served by a query is answered as far as the instrument is concerned — which is exactly why
 * the capacity measurement is a naming variant and not a gap.
 *
 * @returns The names, queries first.
 */
function rootNames(): string[] {
	return [...queryNames(), ...mutationNames()];
}

/** The root field names of one operation type. */
function operationNames(operation: 'query' | 'mutation'): string[] {
	return operation === 'query' ? queryNames() : mutationNames();
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationNames().includes(name);
}

/**
 * Whether the audit's own test holds for a domain verb: a field whose name carries the verb *and* the
 * first five letters of the resource.
 *
 * Reproduced rather than described, because a row that says "the audit looked for this and there is no
 * such field" is only worth reading if the test applies the instrument's rule. The pool is every root
 * field of either operation type, as the instrument's own reader collects them.
 *
 * @param verb The route's handler name.
 * @param resource The controller's resource name.
 * @returns True when some field would satisfy the instrument.
 */
function auditHoldsForVerb(verb: string, resource: string): boolean {
	const stem = resource.slice(0, 5).toLowerCase();

	return rootNames().some(
		(name) => name.toLowerCase().includes(verb.toLowerCase()) && name.toLowerCase().includes(stem)
	);
}

/**
 * Whether the audit's bulk branch would count a route as answered: it looks for the word `bulk` in any
 * field's name, whatever resource that field belongs to.
 *
 * @returns True when some field would silence every bulk route in the package.
 */
function auditHoldsForBulk(): boolean {
	return rootNames().some((name) => name.toLowerCase().includes('bulk'));
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the warehouse document declares no Mutation field named "${name}"`);
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
		throw new Error(`the warehouse document declares no input named "${name}"`);
	}

	return input;
}

/** The members an input type declares, in the order the document states them. */
function inputMembers(name: string): string[] {
	return (inputType(name).fields ?? []).map((field) => field.name.value);
}

/** The name of the type behind whatever wrappers a declaration states, `ID!` and `[X!]!` included. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** How one member of an input type is declared: `NamedType` for a nullable one, `NonNullType` otherwise. */
function memberKind(input: string, member: string): string {
	const field = (inputType(input).fields ?? []).find((candidate) => candidate.name.value === member);

	if (!field) {
		throw new Error(`the warehouse document declares no member "${member}" on "${input}"`);
	}

	return field.type.kind;
}

/**
 * Whether the audit's own test would still flag a route this wave delivered.
 *
 * The instrument branches on the handler: a CRUD handler is answered by an exact `<verb><Resource>` name
 * and anything else by its verb appearing anywhere in a field's name. Reproduced rather than assumed,
 * because the count below is only worth reading if the test applies the instrument's rule.
 *
 * @param entry The delivered route.
 * @returns True when the instrument would not count it as answered.
 */
function instrumentStillFlags(entry: IParity): boolean {
	return CRUD_HANDLERS.includes(entry.route)
		? declares(entry.expects) === false
		: auditHoldsForVerb(entry.expects, entry.resource) === false;
}

/** Whether the instrument would still flag one of the collapsed routes, by the branch that covers it. */
function collapseStillFlagged(row: (typeof SERVED_ELSEWHERE)[number]): boolean {
	if (row.bulk) {
		return auditHoldsForBulk() === false;
	}

	return row.verb ? auditHoldsForVerb(row.expects, row.resource) === false : declares(row.expects) === false;
}

/**
 * The schema's half of the eight fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does
 * not build fails here rather than at boot.
 */
describe('the warehouse document — the eight routes no field answered are declared', () => {
	it.each(PARITY)('declares $field in the mutation block', ({ field }) => {
		expect(mutationField(field).name.value).toBe(field);
	});

	it('takes the arguments each route takes, in the order the route states them', () => {
		for (const { field, declared } of PARITY) {
			const arguments_ = mutationField(field).arguments ?? [];

			expect(arguments_.map((argument) => argument.name.value)).toEqual(declared.map(([name]) => name));

			for (const [index, [, type]] of declared.entries()) {
				expect(namedTypeName(arguments_[index].type)).toBe(type);
			}
		}
	});

	it('requires the identifier and the input every write cannot be made without', () => {
		// A write that names no row is not a write, so the identifier is non-null on all eight — and an
		// input is non-null wherever the route's body is, because a call that states nothing has nothing
		// to write. The four destructive rows take the identifier alone, as their routes do.
		for (const { field } of PARITY) {
			expect({ field, kind: (mutationField(field).arguments ?? [])[0].type.kind }).toEqual({
				field,
				kind: 'NonNullType'
			});
		}

		for (const { field, declared } of PARITY) {
			if (declared.length < 2) {
				continue;
			}

			expect({ field, kind: (mutationField(field).arguments ?? [])[1].type.kind }).toEqual({
				field,
				kind: 'NonNullType'
			});
		}
	});

	it('answers the payload each resource’s other mutations answer', () => {
		for (const { field, answers } of PARITY) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('declares the members the route’s own body carries, and only those', () => {
		// Read from the DTO each route validates its body with rather than restated here, so a member
		// added to a read model and not to the input fails this. The controls come first: the four reads
		// are measurements only if the DTOs answer with their own columns.
		expect(allDtoMembers(UpdatePickWaveDTO)).toEqual(WAVE_MEMBERS);
		expect(allDtoMembers(UpdatePickListDTO)).toEqual(LIST_MEMBERS);
		expect(allDtoMembers(UpdatePackSlipDTO)).toEqual(SLIP_MEMBERS);
		expect(allDtoMembers(UpdateCarrierManifestDTO)).toEqual(MANIFEST_MEMBERS);

		for (const { field, input, dto, members } of UPDATE_INPUTS) {
			// The expression the audit's expectation for a CRUD handler is built from, so a field named
			// for anything but its route fails the delivery assertion above rather than this one.
			expect(declares(field)).toBe(true);

			expect({ input, members: inputMembers(input).sort() }).toEqual({ input, members: [...members].sort() });
			expect(inputMembers(input).sort()).toEqual(allDtoMembers(dto));
		}
	});

	it('leaves every member of an edit optional, as the route’s own body does', () => {
		// An edit states what changed rather than restating the row, and the routes declare their bodies as
		// partial read models, so every member of every input here is nullable. A member declared non-null
		// would refuse an edit that states only the one field it moves.
		for (const { input } of UPDATE_INPUTS) {
			for (const member of inputMembers(input)) {
				expect({ input, member, kind: memberKind(input, member) }).toEqual({ input, member, kind: 'NamedType' });
			}
		}

		// The control, so the loop above cannot pass on an empty reading.
		expect(inputMembers('UpdatePackSlipInput').length).toBeGreaterThan(10);
	});

	it('declares every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of PRE_EXISTING) {
			expect(declares(name)).toBe(true);
		}

		expect(PRE_EXISTING).toHaveLength(50);
	});

	it('declares no root field twice, which no assertion inside a document can see', () => {
		// The `gql` tag parses a document with two fields of one name and `buildASTSchema` then fails with
		// `Field "Mutation.x" can only be defined once` — at boot, not here. A duplicate is therefore
		// asserted rather than left to the composition pass.
		const names = mutationNames();

		expect(new Set(names).size).toBe(names.length);
		expect(names).toHaveLength(58);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on its own stub, not a service method named in this file.
 * Every delegation the route makes is compared, not only the first, because the read-back the four
 * edits make is what answers the caller with the row as the edit left it.
 */
describe('the eight fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write. The patch is compared by identity as well, because a field that copied the input
		// into a new object would be one the service could not recognise as the same statement.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		if (!entry.destructive) {
			expect(stubs[entry.service][entry.method].mock.calls[0][1]).toBe(entry.patch);
			expect(stubs[entry.service][entry.method].mock.calls[1][1]).toBe(entry.patch);
		}

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on the
		// wrong aggregate, and the payload would carry whatever that one returned.
		for (const [name, stub] of Object.entries(stubs)) {
			if (name === entry.service) {
				continue;
			}

			expect(stub[entry.method]).not.toHaveBeenCalled();
		}

		// The destructive four answer no row, because the row the route's own answer described no longer
		// exists: the route answers a `DeleteResult` and the payload has no member for one, so what the two
		// surfaces agree on is *which* row went and that nothing was refused.
		if (entry.destructive) {
			expect(overRest).toBe(REMOVED);
			expect(overGraphql[entry.member]).toBeNull();
			expect(overGraphql.userErrors).toEqual([]);

			return;
		}

		expect(overGraphql[entry.member]).toBe(overRest);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it.each(PARITY.filter((entry) => entry.alsoCalls.length > 0))(
		'$field makes every further delegation the $route route makes',
		async (entry) => {
			// The edit is a write and a read: the route answers the row as the edit left it — with the lines
			// and the re-derived counters the detail read carries, or the manifest itself — and a field that
			// answered the update's own result would describe the same edit with less.
			const { stubs, controller, resolver } = surfaces(entry);

			await controller[entry.route](...entry.routeArgs);
			await resolver[entry.field](...entry.fieldArgs);

			for (const [method, args] of entry.alsoCalls) {
				expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(1, ...args);
				expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(2, ...args);
				expect(stubs[entry.service][method]).toHaveBeenCalledTimes(2);
			}
		}
	);

	it('carries the route’s own answer back on the read the four edits make', async () => {
		// The four edits answer the row their read returned, so the identity is checked against the stub's
		// own answer rather than against a copy: a field that built its own payload from the update's result
		// would answer a row the detail read never produced.
		const expected: [string, any][] = [
			['updatePickWave', WAVE],
			['updatePickList', LIST],
			['updatePackSlip', SLIP],
			['updateCarrierManifest', MANIFEST]
		];

		for (const [field, row] of expected) {
			const entry = PARITY.find((candidate) => candidate.field === field) as IParity;
			const { resolver } = surfaces(entry);
			const answer = await resolver[field](...entry.fieldArgs);

			expect(answer[entry.member]).toBe(row);
		}
	});

	it('answers the refusal in userErrors rather than as a GraphQL error', async () => {
		// Every mutation of this plugin reports a refusal in the payload, so a client reads one shape for
		// both outcomes. A field that let the service's exception escape would answer a transport error
		// where its siblings answer a payload — and the REST route answers the same refusal as an HTTP
		// status with the platform's code, which the payload carries through `toUserError`.
		for (const { field, fieldArgs, service, method, build } of PARITY) {
			const stubs: Row = {
				pickWave: collaborator(FOREIGN),
				pickList: collaborator(FOREIGN),
				pickListLine: collaborator(FOREIGN),
				packSlip: collaborator(FOREIGN),
				carrierManifest: collaborator(FOREIGN),
				foreign: collaborator(FOREIGN)
			};

			stubs[service][method] = jest.fn().mockRejectedValue(new Error(`${field} refused`));

			const { resolver } = build(stubs);
			const answer = await resolver[field](...fieldArgs);

			expect(answer.userErrors).toHaveLength(1);
			expect(answer.userErrors[0].message).toBe(`${field} refused`);
		}
	});

	it('answers NOT_FOUND in userErrors when the removal matched no row, rather than an empty success', async () => {
		// The four destructive fields used to answer `userErrors: []` whenever the service did not raise —
		// and `TenantAwareCrudService.delete` does not raise for a scoped statement that matched nothing: an
		// identifier of another tenant, a stale one or one already removed reports `affected: 0`. The route
		// passes that result on, so a REST caller could read it; the payload now says the same thing in its
		// own vocabulary, which is the outcome the REST surface gives the identifier on a read.
		const destructive = PARITY.filter((entry) => entry.destructive);

		// The control: the four removals are all here, so the loop below is not a loop over nothing.
		expect(destructive.map(({ field }) => field).sort()).toEqual([
			'deleteCarrierManifest',
			'deletePackSlip',
			'deletePickList',
			'deletePickWave'
		]);

		for (const entry of destructive) {
			const { stubs, controller, resolver } = surfaces(entry);
			const nothing = { affected: 0, raw: [] };

			stubs[entry.service][entry.method].mockResolvedValue(nothing);

			const overRest = await controller[entry.route](...entry.routeArgs);
			const answer = await resolver[entry.field](...entry.fieldArgs);

			expect(overRest).toBe(nothing);
			expect(answer[entry.member]).toBeNull();
			expect(answer.userErrors).toEqual([
				{
					code: 'NOT_FOUND',
					message: expect.stringContaining(ID),
					path: ['id'],
					details: { id: ID }
				}
			]);
		}
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the eight is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could
 * rewrite a released wave's columns, re-point a pick list, rewrite the weight of record on a slip a
 * carrier is rating, or remove a manifest outright. The four resolvers state no class-level grant at
 * all, which is why the comparison is against the route's own handler metadata and not the class.
 */
describe('the eight fields — the permission and the guards are the route’s', () => {
	it('states on every field exactly what its own route states, read from the route', () => {
		// A control first: the routes are not all ungated, so the comparison below cannot pass on two
		// absences.
		expect(PARITY.some(({ route, controller }) => permissionOfRoute(controller, route))).toBe(true);

		for (const { field, route, controller, resolver } of PARITY) {
			expect(typeof handlersOf(controller)[route]).toBe('function');

			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[route])
			);
			expect(permissionOfField(resolver, field)).toEqual(permissionOfRoute(controller, route));
		}
	});

	it('demands the grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply: no
			// resolver of this plugin states a class-level grant that could stand in for the field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}
	});

	it('states the two grants the eight routes state, and never a view grant', () => {
		expect(new Set(PARITY.map(({ grant }) => grant))).toEqual(
			new Set([WarehousePermissions.PICK_LISTS_EDIT, WarehousePermissions.FULFILLMENTS_EDIT])
		);

		const views = [
			WarehousePermissions.PICK_LISTS_VIEW,
			WarehousePermissions.FULFILLMENTS_VIEW,
			WarehousePermissions.WAREHOUSE_BINS_VIEW,
			WarehousePermissions.WAREHOUSE_ZONES_VIEW
		];

		for (const { grant } of PARITY) {
			expect(views).not.toContain(grant);
		}
	});

	it('states a view grant on the controller class, which is what a field without one would inherit', () => {
		// The class grant is the reason the field's own metadata is load-bearing: the four controllers
		// state the *view* grant for the resource, so a field that stated nothing would be gated by
		// nothing at all on the resolver side while the route it mirrors demands an edit grant.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PickWaveController)).toEqual([WarehousePermissions.PICK_LISTS_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PickListController)).toEqual([WarehousePermissions.PICK_LISTS_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PackSlipController)).toEqual([WarehousePermissions.FULFILLMENTS_VIEW]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CarrierManifestController)).toEqual([
			WarehousePermissions.FULFILLMENTS_VIEW
		]);
	});

	it('mirrors the route’s version expectation and its retry scope, and invents neither', () => {
		// None of the eight routes carries `@Versioned` or `@Idempotent`, and none of the eight fields
		// carries one either: a version expectation invented here would refuse over GraphQL a write the
		// REST route accepts, and a scope invented here would replay a GraphQL retry the REST route lets
		// through — a difference in behaviour rather than in transport.
		for (const { field, route, controller, resolver } of PARITY) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toEqual(
				Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(controller)[route])
			);
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(controller)[route])).toBeUndefined();
		}

		// The controls, so the two absences above are measurements of *these* routes rather than of a mock
		// that never records metadata: the pack route does declare a retry scope, and a versioned route
		// exists in the same controllers.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(PackSlipController)['pack'])).toMatchObject({
			scope: 'warehouse.pack',
			required: false
		});
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, handlersOf(PickListController)['pick'])).toBeDefined();
	});

	it('runs the fields under the guard chain the routes run under', () => {
		const routeGuards = guardsOf(PickWaveController);

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));

		for (const { field, route, controller, resolver } of PARITY) {
			expect(guardsOf(controller, route)).toEqual(expect.arrayContaining(routeGuards));
			expect(guardsOf(resolver, field)).toEqual(expect.arrayContaining(guardsOf(controller, route)));
		}
	});

	it('pins the three route-versus-specification divergences without resolving them', () => {
		// (1) `09` §14.12 gives the manifest's PUT `PICK_LISTS_*`; the route and this field state
		// `FULFILLMENTS_EDIT`, which is what `06` §7.17 and `appendix-b` say.
		expect(permissionOfRoute(CarrierManifestController, 'update')).toEqual([WarehousePermissions.FULFILLMENTS_EDIT]);
		expect(permissionOfRoute(CarrierManifestController, 'update')).not.toEqual([WarehousePermissions.PICK_LISTS_EDIT]);

		// (2) `06` §7.17 gives the bin's create and delete `WAREHOUSE_BINS_EDIT`; the routes state the
		// create and delete grants of the same resource, which `appendix-b`'s table declares.
		expect(permissionOfRoute(WarehouseBinController, 'create')).toEqual([WarehousePermissions.WAREHOUSE_BINS_CREATE]);
		expect(permissionOfRoute(WarehouseBinController, 'delete')).toEqual([WarehousePermissions.WAREHOUSE_BINS_DELETE]);

		// (3) `06` §7.17 marks the pack route's key "required"; the route declares it optional, and the
		// manifest's dispatch route — named `submit` here — declares no key at all while its hand-over
		// sibling does. Both readings are recorded, so whoever settles them changes both surfaces together.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(CarrierManifestController)['submit'])).toBeUndefined();
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, handlersOf(CarrierManifestController)['handOver'])).toMatchObject(
			{ scope: 'warehouse.handover', required: false }
		);
	});
});

/**
 * The reading, asserted rather than described.
 *
 * Every route the audit flagged and this suite does not implement is pinned here: the name it looked for
 * is absent from the document, and the field that serves the capability — or the door the capability
 * actually has — is present. A future wave that renames a serving field, or that adds one of these names
 * without meaning to, fails here.
 */
describe('the sixteen routes — four buckets, none of them left unread', () => {
	it('flags sixteen, implements eight, collapses five and refuses three', () => {
		expect(FLAGGED).toBe(16);

		expect(PARITY).toHaveLength(8);
		expect(SERVED_ELSEWHERE).toHaveLength(5);
		expect(REFUSED).toHaveLength(3);

		expect(PARITY.length + SERVED_ELSEWHERE.length + REFUSED.length).toBe(FLAGGED);
	});

	it('splits the collapsed five into three naming variants and two set-field pairs', () => {
		// The two shapes collapse for different reasons and a reader has to be able to tell them apart: a
		// naming variant is one capability under a name the instrument cannot build, and a set-field pair is
		// two routes served by one boolean setter.
		expect(SERVED_ELSEWHERE.filter(({ kind }) => kind === 'naming')).toHaveLength(3);
		expect(SERVED_ELSEWHERE.filter(({ kind }) => kind === 'set')).toHaveLength(2);
	});

	it('splits the delivered eight into four edits and four destructive removals', () => {
		expect(PARITY.filter(({ destructive }) => destructive)).toHaveLength(4);
		expect(PARITY.filter(({ route }) => route === 'update')).toHaveLength(4);
	});

	it.each(SERVED_ELSEWHERE)('$resource.$route is served by $served', ({ controller, route, expects, verb, operation, served }) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the surface
		// rather than about a handler that does not exist.
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The audit's expectation is absent — either the name it built from the handler and the resource, or,
		// for a domain verb, every field name that carries the verb — while the capability is answered by at
		// least one of the fields the table names, **in the operation type the row states**.
		if (verb) {
			expect(auditHoldsForVerb(expects, controller.name.replace(/Controller$/, ''))).toBe(false);
		} else {
			expect(declares(expects)).toBe(false);
		}

		expect(served.filter((field) => operationNames(operation).includes(field)).length).toBeGreaterThan(0);

		// Where the door is a query, there is no mutation beside it: the act is a read, and a second field
		// that also measured a capacity would be two doors to one capability rather than one.
		if (operation === 'query') {
			expect(served.some((field) => mutationNames().includes(field))).toBe(false);
		}
	});

	it.each(REFUSED)('$resource.$route is refused, and what it was for is named', ({ controller, route, expects, fields, confidence, dto }) => {
		// The route exists — which is why the flag is about the surface and not about a typo — and the field
		// it would have had is asserted absent, so a later wave that delivers one has to delete this row.
		expect(typeof handlersOf(controller)[route]).toBe('function');
		expect(declares(expects)).toBe(false);

		for (const field of fields) {
			expect(declares(field)).toBe(false);
		}

		// The confidence is part of the record, because the create and the two lifecycle routes do not rest
		// on the same reading: the derivation sentence is about how the line set comes into being.
		expect(['medium-high', 'medium']).toContain(confidence);

		// The DTO the refused routes patch is a real patch of a real read model, so the refusal is a
		// judgement about the route rather than about a resource that does not exist.
		expect(allDtoMembers(dto).length).toBeGreaterThan(0);
	});

	it('refuses the three line routes the derivation sentence and every catalogue deny', () => {
		// The citation is the assertion's reason, so it is repeated where it is applied: §14.5 gives the line
		// set one author — the derivation — and the resource is in no catalogue at all.
		expect(REFUSED.map(({ expects }) => expects).sort()).toEqual([
			'createPickListLine',
			'deletePickListLine',
			'updatePickListLine'
		]);

		// What the line's own lifecycle already has is the recoverable pair, which is delivered and stays:
		// the refusal is about authoring and destroying a derived row, not about the pair the design gives it.
		expect(declares('softDeletePickListLine')).toBe(true);
		expect(declares('recoverPickListLine')).toBe(true);

		// The resources the catalogues *do* declare are all present, which is the other half of the reading:
		// the six catalogued resources plus the line's own recoverable pair.
		for (const name of ['createPickList', 'createPickWave', 'createPackSlip', 'createCarrierManifest']) {
			expect(declares(name)).toBe(true);
		}
	});

	it('delivers the four destructive removals beside the two the plugin already mirrored', () => {
		// The internal precedent that decided the four hard deletes: this plugin already mirrors the same
		// `CrudController` route for its two layout resources, so leaving the four aggregates' removals
		// unmirrored would be one plugin answering one route two ways.
		for (const name of ['deleteWarehouseBin', 'deleteWarehouseZone']) {
			expect(declares(name)).toBe(true);
		}

		for (const name of ['deletePickWave', 'deletePickList', 'deletePackSlip', 'deleteCarrierManifest']) {
			expect(declares(name)).toBe(true);
		}

		// And the recoverable pair each of the four serves stands beside it, which is what the docstrings of
		// the delivered fields say a caller who may want the row back must use instead.
		for (const name of [
			'softDeletePickWave',
			'recoverPickWave',
			'softDeletePickList',
			'recoverPickList',
			'softDeletePackSlip',
			'recoverPackSlip',
			'softDeleteCarrierManifest',
			'recoverCarrierManifest'
		]) {
			expect(declares(name)).toBe(true);
		}
	});

	it('clears the eight delivered rows and leaves the instrument flagging exactly the other eight', () => {
		// The count a reader will meet by running either instrument after this wave: **eight**, down from
		// sixteen — the five collapsed rows no renaming was wanted for, plus the three refused. Both variants
		// of the instrument report that same eight, for the reason the suite's opening states: the stem
		// narrowing cannot see a verb that is not contiguous and cannot see a setter that carries no verb.
		const unexplained = PARITY.filter(instrumentStillFlags).map(({ field }) => field);

		expect(unexplained).toEqual([]);

		const collapsed = SERVED_ELSEWHERE.filter(collapseStillFlagged);

		expect(collapsed).toHaveLength(5);

		const refused = REFUSED.filter(({ expects }) => declares(expects) === false);

		expect(refused).toHaveLength(3);

		// The arithmetic of the residual, stated so the instruments' reported number is derivable here.
		expect(collapsed.length + refused.length).toBe(FLAGGED - PARITY.length);
		expect(FLAGGED - PARITY.length).toBe(8);
	});

	it('cannot tell a set-field pair from an unanswered route, which is why the reading was independent', () => {
		// The instrument's own test, applied to the two `unblock` routes it flagged: no field carries the
		// verb under either stem or under the full name, so the test that flagged them cannot distinguish
		// them from a genuine gap — while the capability is answered by one boolean setter each.
		expect(auditHoldsForVerb('unblock', 'WarehouseBin')).toBe(false);
		expect(auditHoldsForVerb('unblock', 'WarehouseZone')).toBe(false);

		// The control: the block half of the same pair *is* seen, because `setWarehouseBinBlocked` carries
		// both the verb and the stem — so the pair is answered and only its second half looks missing.
		expect(auditHoldsForVerb('block', 'WarehouseBin')).toBe(true);
		expect(auditHoldsForVerb('block', 'WarehouseZone')).toBe(true);

		// What the instrument cannot see, the surface states.
		expect(declares('setWarehouseBinBlocked')).toBe(true);
		expect(declares('setWarehouseZoneBlocked')).toBe(true);
		expect(declares('unblockWarehouseBin')).toBe(false);
		expect(declares('unblockWarehouseZone')).toBe(false);
	});

	it('explains the two instruments’ identical counts, which the stem narrowing cannot change', () => {
		// The loose instrument matches a domain verb by the verb plus the first five characters of the
		// resource; the strict one requires the resource's full name. They can only differ where two
		// resources share a five-character stem — here `wareh`, for the bin and the zone — and the two rows
		// that could sit in that difference are the `unblock` routes, which fail both tests identically
		// because no field in the document contains `unblock` at all. That is why the two instruments
		// reported the same sixteen rows and why this suite reads all sixteen rather than their difference.
		const stems = ['WarehouseBin', 'WarehouseZone'].map((resource) => resource.slice(0, 5).toLowerCase());

		expect(stems[0]).toBe(stems[1]);
		expect(mutationNames().filter((name) => name.toLowerCase().includes('unblock'))).toEqual([]);

		// And the other two rows in the collapsed table fail for reasons a longer stem cannot repair: a verb
		// split across the field's name, and a bulk branch that looks for a word the field does not use.
		expect(mutationNames().filter((name) => name.toLowerCase().includes('closeshort'))).toEqual([]);
		expect(auditHoldsForBulk()).toBe(false);
	});
});
