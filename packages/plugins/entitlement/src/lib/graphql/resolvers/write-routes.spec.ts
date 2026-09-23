/**
 * The write routes of this package that no field answered, and the reading that collapsed or refused
 * the rest.
 *
 * §3.1 requires one mutation per REST write route. A name-based audit reads a route's *handler* name
 * against the root fields this document declares, and it flags **sixteen** of this package's
 * twenty-seven write routes — which is not a gap count, because the instrument is blind in the two
 * directions that matter here. It expects a CRUD handler to be answered by `<verb><Resource>`
 * (`softRemove` -> `softDelete<Resource>`, `softRecover` -> `recover<Resource>`) and it expects a domain
 * verb to appear *somewhere* in a field's name, so it cannot see a capability answered under another
 * name, nor one answered by a parent or by a sibling; and its resource stem is `resource.slice(0, 5)`,
 * which is the same five letters for all three of this package's controllers, so a verb route on any of
 * the three resources is satisfied by a field naming any of them.
 *
 * The reading leaves the sixteen in four buckets, and every row of all four is asserted rather than
 * described:
 *
 * - **Seven genuine gaps**, which this suite is mostly about: the right's `update`, `suspend`, `resume`
 *   and `reduce` routes, the activation's `update` route, and the key's `update` (an assignment) and
 *   `reissue` routes. Each is a capability a REST caller had and a GraphQL caller did not, and each is
 *   delivered here with the arguments its route takes, the permission its route states, the same service
 *   call, and the same `@Idempotent` scope and `@Versioned` expectation where the route declares one.
 * - **Four naming variants**, where the capability is already reachable: the right's `create` is
 *   `grantEntitlement`, `issueKey` is `issueEntitlementKey`, the activation's `create` is
 *   `activateEntitlement`, and the key's own `create` is `issueEntitlementKey` too — four fields the
 *   specification's own entitlement row names, each of which reaches the very method its route reaches.
 * - **One merged pair**: the activation's `release` has no field of its own because `deactivateEntitlement`
 *   serves both ways a slot is given back — `revoked: false` reaches `release`, which is that route, and
 *   `revoked: true` reaches `revoke`, which is its sibling's. The audit flagged the one and silently
 *   "matched" the other against `revokeEntitlement`, a field of a different resource.
 * - **Four routes the specifications refuse to mirror**, each cited where it is refused: the credential's
 *   `reveal`, and the hard `delete` of all three resources. `11-customers-b2b-and-subscriptions-spec.md`
 *   §9.1 ("a key is shown once, at issue"), `02-commerce-domain-model.md` §4.8 E4 ("never returned again
 *   after its single reveal"), `05-database-schema-spec.md` §19.3 ("the plaintext leaves the service
 *   exactly once, in the response to the issuance call") and `13-migration-and-rollout-plan.md`'s risk
 *   register ("returned more than once ... turning an entitlement into a credential leak") refuse the
 *   first; `05` §1.7 ("A hard `DELETE` is only ever issued by a retention job (§25) against a table it
 *   owns") with §25.2, which names these three tables as the retention job's, and
 *   `11` §9.3 ("Revoking an entitlement never deletes its rows: the grant, the activations and the keys
 *   stay readable") refuse the other three. **The counter-evidence is recorded rather than hidden**, in
 *   the resolvers that would carry the fields: §19.3 also defines `keyCiphertext` as existing "so support
 *   can re-display it" and ADR-50 says "read back *where the format allows*"; and §3.1 lists "delete"
 *   among the parity dimensions while `06-api-specification.md` §3 declares `DELETE /:id` in every entity
 *   controller's inherited route set. The distinction that decides the three deletes is the retention
 *   list, not the framework: the returns wave delivers *its* hard deletes because those tables are in
 *   `05` §25.1's "ordinary indexed tables; no special handling", while these three are named in §25.2's
 *   retention-job list.
 *
 * Four properties are pinned for each of the seven, three of them exactly as the lifecycle pair's suite
 * pins them:
 *
 * - it is **declared** in this plugin's document, with the arguments the route takes and the payload its
 *   siblings answer, because a field the document does not carry is one no client can select;
 * - it **states its own route's permission**, read from the route's metadata rather than restated here,
 *   because `PermissionGuard` resolves handler-then-class and the class grant of all three of these
 *   resolvers is the view grant none of these acts carries;
 * - it **reaches the same service call with the same arguments the route reaches**, because two protocols
 *   that perform one act differently are two behaviours waiting to diverge — and it mirrors the route's
 *   `@Idempotent` scope and `@Versioned` expectation, which two of the seven declare and five do not;
 * - its **input states the members the route's own body states**, read out of the DTO's live
 *   class-validator metadata rather than restated, so a member added to a DTO fails here instead of
 *   arriving on one surface only.
 *
 * **Nothing is doubled here but the services.** The three controllers are the real ones, the three
 * resolvers are the real ones with their own decorators and signatures, `CrudController` behind them is
 * the kernel's, and the document the fields are read out of is the real one. What is doubled is
 * `@gauzy/core`, which boots the whole application graph from its barrel and cannot be loaded outside a
 * running application, as this package's other specs record — except for the two write conventions,
 * which are the kernel's own here: a no-op double of `@Idempotent` or `@Versioned` would erase both sides
 * of the comparison this suite exists to make, and it would pass on two absences.
 */

jest.mock('@gauzy/common', () => ({
	/** A no-op decorator factory: the feature gate is not what these cases are about. */
	FeatureFlag: () => () => undefined
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: no controller here is mapped onto a Nest application. */
	const decorator = () => () => undefined;
	const permissions = jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator');
	// The retry scope and the version expectation are metadata this suite compares, so both decorators
	// are the kernel's implementations rather than doubles: they write the keys read below, and the
	// version decorator is what puts `VersionGuard` on the fields as it does on the routes.
	const idempotent = jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator');
	const versioned = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator');

	class CrudController {
		constructor(protected readonly crudService: any) {}
	}

	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}
	}

	class TenantAwareCrudService extends CrudService {
		constructor(
			typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {
			super(typeOrmRepository);
		}
	}

	class BaseEntity {}

	return {
		CrudController,
		CrudService,
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		Permissions: permissions.Permissions,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		EventBus: class {},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		// `@UsePipes(new AbstractValidationPipe(...))` on the inherited mutating routes is evaluated when
		// the controller class is defined, and Nest requires a pipe to expose `transform`, so the double
		// has to as well.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		// The mark the key entity carries over its digest. The entity graph calls it at class-definition
		// time, so without it every suite that loads the entity fails to run at all.
		ExportRedacted: decorator,
		BaseEvent: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		Idempotent: idempotent.Idempotent,
		Versioned: versioned.Versioned,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
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

// The collaborators a resolver injects are doubled at their own modules, so nothing below them is
// loaded: what these cases assert is which service method each surface reaches, not what it returns.
jest.mock('../../entitlement/entitlement.service', () => ({ EntitlementService: class EntitlementService {} }));
jest.mock('../../entitlement-activation/entitlement-activation.service', () => ({
	EntitlementActivationService: class EntitlementActivationService {}
}));
jest.mock('../../entitlement-key/entitlement-key.service', () => ({
	EntitlementKeyService: class EntitlementKeyService {}
}));
jest.mock('../../entitlement-check/entitlement-check.service', () => ({
	EntitlementCheckService: class EntitlementCheckService {}
}));

import { getMetadataStorage } from 'class-validator';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	InputValueDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IDEMPOTENT_METADATA_KEY } from '@gauzy/core/src/lib/idempotency/idempotency.policy';
import { VERSION_EXPECTATION_PROPERTY, VERSIONED_METADATA_KEY } from '@gauzy/core/src/lib/concurrency/version.util';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { EntitlementController } from '../../entitlement/entitlement.controller';
import { EntitlementActivationController } from '../../entitlement-activation/entitlement-activation.controller';
import { EntitlementKeyController } from '../../entitlement-key/entitlement-key.controller';
import { AssignEntitlementKeyDTO, ReissueEntitlementKeyDTO } from '../../entitlement-key/dto';
import { UpdateEntitlementActivationDTO } from '../../entitlement-activation/dto';
import { UpdateEntitlementDTO } from '../../entitlement/dto';
import { schemaExtensions } from '../schema-extensions';
import { EntitlementResolver } from './entitlement.resolver';
import { EntitlementActivationResolver } from './entitlement-activation.resolver';
import { EntitlementKeyResolver } from './entitlement-key.resolver';

type Row = Record<string, any>;

/** The rows both surfaces act on. */
const ID = '00000000-0000-4000-8000-0000000000f1';
const ACTIVATION = '00000000-0000-4000-8000-0000000000f2';
const KEY = '00000000-0000-4000-8000-0000000000f3';
const REPLACEMENT = '00000000-0000-4000-8000-0000000000f4';

/** The reason the operator states, which travels to the service on both surfaces. */
const REASON = 'goodwill, re-opened for the spring push';

/** The ceiling the reduction leaves, and the one the edit states. */
const REDUCED_TO = 1;
const EDITED_TO = 5;

/** The conditions both edit surfaces state, replacing the rule rows the right carries. */
const CONDITIONS = [{ attribute: 'context.region', operator: 'EQ', value: 'EU' }];

/** What the two surfaces of the edit write, and what the service must receive of it. */
const EDIT = { quantity: EDITED_TO, conditions: CONDITIONS };
const CHANGES = { quantity: EDITED_TO };

/** The correction both activation surfaces state. */
const ACTIVATION_CHANGE = { deviceName: "Ana's laptop" };

/** The holder both key surfaces record. */
const ASSIGN = { assignedToEmail: 'ana@example.com' };

/** The replacement both key surfaces ask for. */
const REISSUE = { format: 'GROUPED_16', reason: 'the customer lost the original' };

/**
 * The version the caller read, as the guard leaves it on the request, and the two ways the surfaces
 * carry it: a header's worth on the REST request, and the operation context beside the GraphQL one.
 *
 * One object, so a field that stated a version of its own — a wildcard, or a different number — would
 * reach the service with something the route never would, and the comparison would say so.
 */
const EXPECTATION = { wildcard: false, versions: [2] };
const REQUEST = { [VERSION_EXPECTATION_PROPERTY]: EXPECTATION };
const CONTEXT = { req: REQUEST };

/**
 * What each service answers, so the two surfaces can be compared by identity.
 *
 * They are one row read twice, not two rows: a caller that suspends a right over GraphQL and one that
 * suspends it over REST must be looking at the same record afterwards.
 */
const EDITED = { id: ID, quantity: EDITED_TO, version: 6 };
const SUSPENDED = { id: ID, status: 'SUSPENDED', version: 3 };
const RESUMED = { id: ID, status: 'ACTIVE', version: 4 };
const REDUCED = { id: ID, quantity: REDUCED_TO, version: 5 };
const CORRECTED = { id: ACTIVATION, deviceName: "Ana's laptop" };
const ASSIGNED = { id: KEY, keyPrefix: 'ABCD', assignedToEmail: ASSIGN.assignedToEmail };
const REPLACED = { id: KEY, keyPrefix: 'ABCD', status: 'REVOKED' };
const ISSUED = { id: REPLACEMENT, keyPrefix: 'EFGH', format: REISSUE.format };
const PLAINTEXT = 'EFGH-1234-5678-9012';

/**
 * What a collaborator other than the capability's own service answers with.
 *
 * It is deliberately a different row: a field that reached the wrong service would report it, and the
 * identity assertion below would fail rather than pass on a shared double.
 */
const FOREIGN = { id: '00000000-0000-4000-8000-0000000000ff', wrong: true };

/** The service that owns one capability, which is the stub the field has to reach. */
type ServiceKey = 'entitlement' | 'activation' | 'key';

/**
 * One of the seven routes, its two surfaces, and what its field must mirror.
 */
interface IParity {
	/** The field this wave delivers. */
	field: string;
	/** The handler the route is served by, which is what the audit reads. */
	route: string;
	/** The controller's own resource name, which the audit's expectation is built from. */
	resource: string;
	/** The name the audit looked for, which for a domain verb is the verb itself. */
	expects: string;
	/** Whether the audit looks for the verb anywhere in a field's name rather than for the name itself. */
	verb: boolean;
	/** The arguments the route's handler takes. */
	routeArgs: any[];
	/** The arguments the field takes, which mirror what the route *writes*. */
	fieldArgs: any[];
	/** The arguments the service must receive from both surfaces. */
	serviceArgs: any[];
	/** The further calls both surfaces make, for the one act that is more than one statement. */
	also?: { method: string; args: any[] }[];
	/** The member the payload carries the answer under. */
	member: string;
	/** The row the payload must carry, which is what the service answered. */
	carries: unknown;
	/** The arguments the document declares, in order, and the type each one names. */
	declared: [string, string][];
	/** The type the field answers with, which is what the resource's other mutations answer. */
	answers: string;
	/** The grant the route's own handler states. */
	grant: string;
	/** The method both surfaces must reach. */
	method: string;
	/** The stub that owns the capability. */
	service: ServiceKey;
	controller: new (...args: any[]) => any;
	resolver: new (...args: any[]) => any;
	/** Builds the two surfaces over the stubs. */
	build: (stubs: Row) => { controller: Row; resolver: Row };
}

/**
 * The seven routes no field answered.
 *
 * Each is a capability rather than a spare route: editing what a right *says* without moving its state,
 * pausing one and bringing it back, lowering a ceiling with the arithmetic a partial refund uses,
 * correcting what a slot records, recording who holds a credential, and replacing a lost one. None of
 * them was reachable, because the fields this resolver already carried moved a right's term, withdrew
 * it, retired it, or spent and revoked a credential — and none of those is any of these.
 */
const PARITY: IParity[] = [
	{
		field: 'updateEntitlement',
		route: 'update',
		resource: 'Entitlement',
		expects: 'updateEntitlement',
		verb: false,
		routeArgs: [ID, EDIT, REQUEST],
		fieldArgs: [ID, EDIT, CONTEXT],
		serviceArgs: [ID, CHANGES, EXPECTATION],
		also: [
			{ method: 'replaceConditions', args: [ID, CONDITIONS] },
			{ method: 'findOneDetailed', args: [ID] }
		],
		member: 'entitlement',
		carries: EDITED,
		declared: [
			['id', 'ID'],
			['input', 'UpdateEntitlementInput'],
			['version', 'Int']
		],
		answers: 'EntitlementPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'applyChanges',
		service: 'entitlement',
		controller: EntitlementController,
		resolver: EntitlementResolver,
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.foreign, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementResolver(
				stubs.entitlement,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign
			) as Row
		})
	},
	{
		field: 'suspendEntitlement',
		route: 'suspend',
		resource: 'Entitlement',
		expects: 'suspend',
		verb: true,
		routeArgs: [ID, { reason: REASON }, REQUEST],
		fieldArgs: [ID, REASON, CONTEXT],
		serviceArgs: [ID, REASON, {}, EXPECTATION],
		member: 'entitlement',
		carries: SUSPENDED,
		declared: [
			['id', 'ID'],
			['reason', 'String'],
			['version', 'Int'],
			['idempotencyKey', 'String']
		],
		answers: 'EntitlementPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'suspend',
		service: 'entitlement',
		controller: EntitlementController,
		resolver: EntitlementResolver,
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.foreign, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementResolver(
				stubs.entitlement,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign
			) as Row
		})
	},
	{
		field: 'resumeEntitlement',
		route: 'resume',
		resource: 'Entitlement',
		expects: 'resume',
		verb: true,
		routeArgs: [ID, REQUEST],
		fieldArgs: [ID, CONTEXT],
		serviceArgs: [ID, {}, EXPECTATION],
		member: 'entitlement',
		carries: RESUMED,
		declared: [
			['id', 'ID'],
			['version', 'Int'],
			['idempotencyKey', 'String']
		],
		answers: 'EntitlementPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'resume',
		service: 'entitlement',
		controller: EntitlementController,
		resolver: EntitlementResolver,
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.foreign, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementResolver(
				stubs.entitlement,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign
			) as Row
		})
	},
	{
		field: 'reduceEntitlement',
		route: 'reduce',
		resource: 'Entitlement',
		expects: 'reduce',
		verb: true,
		routeArgs: [ID, { quantity: REDUCED_TO, reason: REASON }, REQUEST],
		fieldArgs: [ID, REDUCED_TO, REASON, CONTEXT],
		serviceArgs: [ID, REDUCED_TO, REASON, {}, EXPECTATION],
		member: 'entitlement',
		carries: REDUCED,
		declared: [
			['id', 'ID'],
			['quantity', 'Int'],
			['reason', 'String'],
			['version', 'Int']
		],
		answers: 'EntitlementPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'reduce',
		service: 'entitlement',
		controller: EntitlementController,
		resolver: EntitlementResolver,
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.foreign, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementResolver(
				stubs.entitlement,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign
			) as Row
		})
	},
	{
		field: 'updateEntitlementActivation',
		route: 'update',
		resource: 'EntitlementActivation',
		expects: 'updateEntitlementActivation',
		verb: false,
		routeArgs: [ACTIVATION, ACTIVATION_CHANGE],
		fieldArgs: [ACTIVATION, ACTIVATION_CHANGE],
		serviceArgs: [ACTIVATION, ACTIVATION_CHANGE],
		member: 'activation',
		carries: CORRECTED,
		declared: [
			['id', 'ID'],
			['input', 'UpdateEntitlementActivationInput']
		],
		answers: 'EntitlementActivationPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'update',
		service: 'activation',
		controller: EntitlementActivationController,
		resolver: EntitlementActivationResolver,
		build: (stubs) => ({
			controller: new EntitlementActivationController(stubs.activation) as Row,
			resolver: new EntitlementActivationResolver(stubs.activation, stubs.foreign) as Row
		})
	},
	{
		field: 'assignEntitlementKey',
		route: 'update',
		resource: 'EntitlementKey',
		expects: 'updateEntitlementKey',
		verb: false,
		routeArgs: [KEY, ASSIGN],
		fieldArgs: [KEY, ASSIGN],
		serviceArgs: [KEY, ASSIGN],
		member: 'key',
		carries: ASSIGNED,
		declared: [
			['id', 'ID'],
			['input', 'AssignEntitlementKeyInput']
		],
		answers: 'EntitlementKeyPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'assign',
		service: 'key',
		controller: EntitlementKeyController,
		resolver: EntitlementKeyResolver,
		build: (stubs) => ({
			controller: new EntitlementKeyController(stubs.key) as Row,
			resolver: new EntitlementKeyResolver(stubs.key) as Row
		})
	},
	{
		field: 'reissueEntitlementKey',
		route: 'reissue',
		resource: 'EntitlementKey',
		expects: 'reissue',
		verb: true,
		routeArgs: [KEY, REISSUE],
		fieldArgs: [KEY, REISSUE],
		serviceArgs: [KEY, REISSUE],
		member: 'key',
		carries: ISSUED,
		declared: [
			['id', 'ID'],
			['input', 'ReissueEntitlementKeyInput']
		],
		answers: 'ReissueEntitlementKeyPayload',
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		method: 'reissue',
		service: 'key',
		controller: EntitlementKeyController,
		resolver: EntitlementKeyResolver,
		build: (stubs) => ({
			controller: new EntitlementKeyController(stubs.key) as Row,
			resolver: new EntitlementKeyResolver(stubs.key) as Row
		})
	}
];

/**
 * The four routes the reading collapsed onto a field of another name.
 *
 * A route is listed here because its *capability* is answered, not because its handler name is: the
 * audit's expectation for each is asserted absent below — for the domain verb, absent as a substring of
 * every field's name, which is the test the instrument itself applies — so this table fails if a future
 * wave renames one of the serving fields out from under the routes that name it in their own docstrings.
 * Each row also drives both surfaces, because "the capability is answered under another name" is only a
 * reading of the document until the two of them are shown reaching one method with one body.
 */
const COLLAPSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	/** The audit's expectation: a name for a CRUD handler, and the verb itself for a domain one. */
	expects: string;
	/** Whether the audit looks for the verb anywhere in a field's name rather than for the name itself. */
	verb: boolean;
	/** The field that serves it. */
	field: string;
	/** The method both surfaces must reach. */
	method: string;
	/** The service the method belongs to. */
	service: ServiceKey;
	routeArgs: any[];
	fieldArgs: any[];
	serviceArgs: any[];
	build: (stubs: Row) => { controller: Row; resolver: Row };
}[] = [
	// The right is granted, not "created": `grantEntitlement` is the name the specification's own
	// entitlement row gives the field, and the route's handler is the CRUD base's `create` because that
	// is the shape the kernel's routing expects — the capability is one grant either way.
	{
		controller: EntitlementController,
		resource: 'Entitlement',
		route: 'create',
		expects: 'createEntitlement',
		verb: false,
		field: 'grantEntitlement',
		method: 'grant',
		service: 'entitlement',
		routeArgs: [EDIT],
		fieldArgs: [EDIT],
		serviceArgs: [EDIT],
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.foreign, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementResolver(
				stubs.entitlement,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign,
				stubs.foreign
			) as Row
		})
	},
	// A credential is issued, not "created", and the route on the right's own path takes the right from
	// the path where the field's input states it: the two bodies are one body once the identifier is
	// folded in, which is why the comparison below is an equality and not an approximation. The route is
	// the right controller's and the field is the credential resolver's — one capability, two resources.
	{
		controller: EntitlementController,
		resource: 'Entitlement',
		route: 'issueKey',
		expects: 'issueKey',
		verb: true,
		field: 'issueEntitlementKey',
		method: 'issue',
		service: 'key',
		routeArgs: [ID, REISSUE],
		fieldArgs: [{ entitlementId: ID, ...REISSUE }],
		serviceArgs: [{ entitlementId: ID, ...REISSUE }],
		build: (stubs) => ({
			controller: new EntitlementController(stubs.entitlement, stubs.key, stubs.foreign, stubs.foreign) as Row,
			resolver: new EntitlementKeyResolver(stubs.key) as Row
		})
	},
	// A slot is taken by activating the right, not by "creating" an activation: the field is named for
	// the act and reaches the same `activate`.
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'create',
		expects: 'createEntitlementActivation',
		verb: false,
		field: 'activateEntitlement',
		method: 'activate',
		service: 'activation',
		routeArgs: [ACTIVATION_CHANGE],
		fieldArgs: [ACTIVATION_CHANGE],
		serviceArgs: [ACTIVATION_CHANGE],
		build: (stubs) => ({
			controller: new EntitlementActivationController(stubs.activation) as Row,
			resolver: new EntitlementActivationResolver(stubs.activation, stubs.foreign) as Row
		})
	},
	// The key resource's own create route is the other door onto the same issuance, and it reaches the
	// same method with the same body.
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'create',
		expects: 'createEntitlementKey',
		verb: false,
		field: 'issueEntitlementKey',
		method: 'issue',
		service: 'key',
		routeArgs: [{ entitlementId: ID, ...REISSUE }],
		fieldArgs: [{ entitlementId: ID, ...REISSUE }],
		serviceArgs: [{ entitlementId: ID, ...REISSUE }],
		build: (stubs) => ({
			controller: new EntitlementKeyController(stubs.key) as Row,
			resolver: new EntitlementKeyResolver(stubs.key) as Row
		})
	}
];

/**
 * The one route served by a field that answers two acts.
 *
 * `deactivateEntitlement` is not a rename of `release`: it is the field for *both* ways a slot is given
 * back, and which act a caller performs is the `revoked` argument. The route the audit silently matched
 * is its sibling's — `POST /entitlement-activations/:id/revoke`, which the instrument counted as
 * answered because `revokeEntitlement` carries the verb and the resource stem, though that field is a
 * right's withdrawal and not a slot's.
 */
const MERGED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	sibling: string;
	expects: string;
	verb: boolean;
	field: string;
}[] = [
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'release',
		sibling: 'revoke',
		expects: 'release',
		verb: true,
		field: 'deactivateEntitlement'
	}
];

/**
 * The four routes the specifications refuse to mirror, and the fields that answer what they were for.
 *
 * These are not gaps to be closed later. The credential's `reveal` would return a key a second time,
 * which four sections refuse in as many words — the citation is on the field that would carry it, in
 * `entitlement-key.resolver.ts` — and the three hard deletes belong to the retention job that `05` §25.2
 * names these three tables under, with the argument for the other reading recorded beside the refusal in
 * `entitlement.resolver.ts`. What a caller reaches instead is the `served` list: a replacement
 * credential, and the recoverable pair each resource answers.
 */
const REFUSED: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	verb: boolean;
	/** The grant the route states, which is asserted rather than assumed: a refusal is a reading of the
	 * specifications, not of an ungated stray. */
	grant: string;
	served: string[];
}[] = [
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'reveal',
		expects: 'reveal',
		verb: true,
		grant: EntitlementPermissions.ENTITLEMENTS_GRANT,
		served: ['issueEntitlementKey', 'reissueEntitlementKey']
	},
	{
		controller: EntitlementController,
		resource: 'Entitlement',
		route: 'delete',
		expects: 'deleteEntitlement',
		verb: false,
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		served: ['softDeleteEntitlement', 'recoverEntitlement']
	},
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'delete',
		expects: 'deleteEntitlementActivation',
		verb: false,
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		served: ['softDeleteEntitlementActivation', 'recoverEntitlementActivation']
	},
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'delete',
		expects: 'deleteEntitlementKey',
		verb: false,
		grant: EntitlementPermissions.ENTITLEMENTS_EDIT,
		served: ['softDeleteEntitlementKey', 'recoverEntitlementKey']
	}
];

/**
 * The six flagged routes whose flag this wave closes.
 *
 * The instrument reads a name, so these are the rows that prove the sixteen were worked rather than
 * argued about: each expectation below is absent before the wave and present after it, and the two
 * tables together account for every one of the sixteen.
 */
const CLOSED: { controller: new (...args: any[]) => any; resource: string; route: string; expects: string; verb: boolean }[] = [
	{ controller: EntitlementController, resource: 'Entitlement', route: 'update', expects: 'updateEntitlement', verb: false },
	{ controller: EntitlementController, resource: 'Entitlement', route: 'suspend', expects: 'suspend', verb: true },
	{ controller: EntitlementController, resource: 'Entitlement', route: 'resume', expects: 'resume', verb: true },
	{ controller: EntitlementController, resource: 'Entitlement', route: 'reduce', expects: 'reduce', verb: true },
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'update',
		expects: 'updateEntitlementActivation',
		verb: false
	},
	{ controller: EntitlementKeyController, resource: 'EntitlementKey', route: 'reissue', expects: 'reissue', verb: true }
];

/**
 * The ten flags the instrument will still report after this wave, and why each is left standing.
 *
 * This is the honest residual: four routes served under another name, one served by a merged field, the
 * one delivered field whose name is deliberately not the one the audit looked for, and the four the
 * specifications refuse. A wave that renamed a field to silence the instrument, or that delivered a
 * refusal to empty the list, fails here.
 */
const RESIDUAL: {
	controller: new (...args: any[]) => any;
	resource: string;
	route: string;
	expects: string;
	verb: boolean;
	reading: string;
}[] = [
	{ controller: EntitlementController, resource: 'Entitlement', route: 'create', expects: 'createEntitlement', verb: false, reading: 'served by grantEntitlement' },
	{ controller: EntitlementController, resource: 'Entitlement', route: 'issueKey', expects: 'issueKey', verb: true, reading: 'served by issueEntitlementKey' },
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'create',
		expects: 'createEntitlementActivation',
		verb: false,
		reading: 'served by activateEntitlement'
	},
	{ controller: EntitlementKeyController, resource: 'EntitlementKey', route: 'create', expects: 'createEntitlementKey', verb: false, reading: 'served by issueEntitlementKey' },
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'release',
		expects: 'release',
		verb: true,
		reading: 'served by deactivateEntitlement(revoked: false)'
	},
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'update',
		expects: 'updateEntitlementKey',
		verb: false,
		reading: 'delivered as assignEntitlementKey, because the route is an assignment (05 §19.3)'
	},
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'reveal',
		expects: 'reveal',
		verb: true,
		reading: 'refused: 11 §9.1, 02 §4.8 E4, 05 §19.3, 13 §R-30'
	},
	{
		controller: EntitlementController,
		resource: 'Entitlement',
		route: 'delete',
		expects: 'deleteEntitlement',
		verb: false,
		reading: 'refused: 05 §1.7 and §25.2, 11 §9.3'
	},
	{
		controller: EntitlementActivationController,
		resource: 'EntitlementActivation',
		route: 'delete',
		expects: 'deleteEntitlementActivation',
		verb: false,
		reading: 'refused: 05 §1.7 and §25.2, §19.2'
	},
	{
		controller: EntitlementKeyController,
		resource: 'EntitlementKey',
		route: 'delete',
		expects: 'deleteEntitlementKey',
		verb: false,
		reading: 'refused: 05 §1.7 and §25.2'
	}
];

/**
 * The members an edit to a right may state, and the members of the route's own body that it refuses.
 *
 * The two lists are asserted against the DTO's live class-validator metadata below rather than trusted:
 * together they must be every member `UpdateEntitlementDTO` validates. The refused members are the
 * provenance, the allocated number, the kind, the lifecycle state and the grant-only members — what the
 * controller's own docstring says a body may not write, and what the service writes anyway.
 */
const EDITABLE = ['activationLimit', 'conditions', 'endsAt', 'gracePeriodDays', 'metadata', 'quantity', 'startsAt'];
const REFUSED_MEMBERS = [
	'activateImmediately',
	'assignedToEmail',
	'customerId',
	'issueKey',
	'keyFormat',
	'kind',
	'number',
	'orderId',
	'orderLineId',
	'productId',
	'revokedReason',
	'status',
	'subscriptionId',
	'suspendedReason',
	'variantId'
];

/**
 * The members every DTO of this package inherits from the credential rather than declaring.
 *
 * They belong to the caller rather than to a body, no input in this document states them, and a
 * comparison that read them would demand that one did. The base DTO they are declared on is replaced by
 * an empty class in the double above, so on this read they are absent — the filter is kept so the
 * comparison states what it excludes, and the control assertion beside it shows what the read returns.
 */
const SCOPE_MEMBERS = ['organization', 'organizationId', 'sentTo', 'tenant', 'tenantId'];

/**
 * The methods the seven fields and their routes reach, which every stub therefore carries.
 *
 * A collaborator is only useful as a negative control if it *could* have answered the call: a stub
 * without the method would make "no other service was touched" pass on an absence rather than on a
 * measurement.
 */
const CAPABILITY_METHODS = [
	// The right's own service.
	'applyChanges',
	'replaceConditions',
	'findOneDetailed',
	'findOneScoped',
	'grant',
	'suspend',
	'resume',
	'reduce',
	'revoke',
	'extend',
	// The activation's.
	'activate',
	'release',
	'update',
	// The credential's.
	'issue',
	'assign',
	'reissue'
];

/**
 * One collaborator stub, answering the row it is given with every method the seven fields could reach.
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
 * One stub per capability, and every other collaborator is a stub of its own answering a *different* row,
 * so a field wired to the wrong service is caught by the identity assertion rather than hidden behind a
 * shared double.
 *
 * @param entry The route whose two surfaces are built.
 * @returns The stubs, the controller and the resolver over them.
 */
function surfaces(entry: IParity): { stubs: Row; controller: Row; resolver: Row } {
	const stubs: Row = {
		entitlement: {
			...collaborator(FOREIGN),
			applyChanges: jest.fn().mockResolvedValue(EDITED),
			replaceConditions: jest.fn().mockResolvedValue(undefined),
			findOneDetailed: jest.fn().mockResolvedValue(EDITED),
			suspend: jest.fn().mockResolvedValue(SUSPENDED),
			resume: jest.fn().mockResolvedValue(RESUMED),
			reduce: jest.fn().mockResolvedValue(REDUCED)
		},
		activation: {
			...collaborator(FOREIGN),
			// The CRUD base's own answer: an `UpdateResult` on both ORMs, never the row.
			update: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
			findOneScoped: jest.fn().mockResolvedValue(CORRECTED)
		},
		key: {
			...collaborator(FOREIGN),
			assign: jest.fn().mockResolvedValue(ASSIGNED),
			reissue: jest.fn().mockResolvedValue({ key: ISSUED, plaintext: PLAINTEXT, replacedKey: REPLACED })
		},
		// Everything else a resolver injects: a field that reached one of them would answer the foreign row.
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
		throw new Error('the entitlement document declares no Mutation fields');
	}

	return [...mutation.fields];
}

/** Every root mutation field's name, in the order the document states them. */
function mutationNames(): string[] {
	return mutationFields().map((field) => field.name.value);
}

/** Whether the document declares a root mutation field of that name. */
function declares(name: string): boolean {
	return mutationNames().includes(name);
}

/** One root mutation field, as the document spells it. */
function mutationField(name: string): FieldDefinitionNode {
	const field = mutationFields().find((candidate) => candidate.name.value === name);

	if (!field) {
		throw new Error(`the entitlement document declares no Mutation field named "${name}"`);
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
		throw new Error(`the entitlement document declares no input named "${name}"`);
	}

	return input;
}

/** The members an input type declares, in the order the document states them. */
function inputMembers(name: string): string[] {
	return (inputType(name).fields ?? []).map((field) => field.name.value);
}

/** One member of an input type, as the document declares it. */
function inputMember(name: string, member: string): InputValueDefinitionNode {
	const field = (inputType(name).fields ?? []).find((candidate) => candidate.name.value === member);

	if (!field) {
		throw new Error(`the entitlement document declares no member "${member}" on "${name}"`);
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
 * The members a DTO validates, its own and the ones it inherits.
 *
 * The wholesale read, needed for a `PartialType`: it returns a class the declared DTO only *extends*, so
 * the metadata it copied carries the returned class as its target and an own-target read of the declared
 * one would find nothing at all.
 *
 * @param dto The DTO to read.
 * @returns Every member name it validates, sorted.
 */
function dtoMembers(dto: new (...args: any[]) => any): string[] {
	const metadata = getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false);

	return Array.from(new Set(metadata.map((entry) => entry.propertyName)))
		.filter((member) => !SCOPE_MEMBERS.includes(member))
		.sort();
}

/**
 * Whether the audit's own test holds for a domain verb: a field whose name carries the verb *and* the
 * first five letters of the resource.
 *
 * Reproduced rather than described, because a row that says "the audit looked for this and there is no
 * such field" is only worth reading if the test applies the instrument's rule — including the one that
 * makes its stem the same five letters for all three of this package's controllers.
 *
 * @param verb The route's handler name.
 * @param resource The controller's resource name.
 * @returns True when some field would satisfy the instrument.
 */
function auditHoldsForVerb(verb: string, resource: string): boolean {
	const stem = resource.slice(0, 5).toLowerCase();

	return mutationNames().some(
		(name) => name.toLowerCase().includes(verb.toLowerCase()) && name.toLowerCase().includes(stem)
	);
}

/**
 * Whether the audit would still flag a route: by name for a CRUD handler, and by the verb rule for a
 * domain one.
 *
 * @param entry The route, its expectation and which of the two rules the instrument applies to it.
 * @returns True when the instrument finds an answer.
 */
function auditAnswered(entry: {
	controller: new (...args: any[]) => any;
	resource: string;
	expects: string;
	verb: boolean;
}): boolean {
	return entry.verb
		? auditHoldsForVerb(entry.expects, entry.resource)
		: declares(entry.expects);
}

/**
 * The schema's half of the seven fields.
 *
 * A capability a client cannot express is not delivered: a field the document does not carry is one no
 * client can select, and the document is parsed by the tag it is written in — so a document that does not
 * build fails here rather than at boot.
 */
describe('the entitlement document — the seven routes no field answered are declared', () => {
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

	it('requires the members a write cannot be made without, and leaves the rest optional', () => {
		// A write that names no row is not a write, so every argument that addresses one is non-null, and
		// an input object is required for the four acts whose body is one: a call that states nothing has
		// nothing to change. The reduction's ceiling is required for the same reason — a reduction that
		// states no quantity states no reduction. Everything else is nullable, including the version:
		// `@Versioned` is what requires it at runtime, and the four fields that declare it declare it the
		// way the right's two existing versioned fields do.
		for (const { field } of PARITY) {
			expect((mutationField(field).arguments ?? [])[0].type.kind).toBe('NonNullType');
		}

		for (const field of ['updateEntitlement', 'updateEntitlementActivation', 'assignEntitlementKey', 'reissueEntitlementKey']) {
			expect(mutationField(field).arguments?.[1].type.kind).toBe('NonNullType');
		}

		expect(mutationField('reduceEntitlement').arguments?.[1].type.kind).toBe('NonNullType');
		expect(mutationField('suspendEntitlement').arguments?.[1].type.kind).toBe('NamedType');
		expect(mutationField('reduceEntitlement').arguments?.[2].type.kind).toBe('NamedType');

		for (const { field, declared } of PARITY) {
			if (!declared.some(([name]) => name === 'version')) {
				continue;
			}

			const version = (mutationField(field).arguments ?? []).find((argument) => argument.name.value === 'version');

			expect(namedTypeName(version!.type)).toBe('Int');
			expect(version!.type.kind).toBe('NamedType');
		}
	});

	it('answers the payload each resource’s other mutations answer', () => {
		for (const { field, answers } of PARITY) {
			const type = mutationField(field).type;

			expect(namedTypeName(type)).toBe(answers);
			expect(type.kind).toBe('NonNullType');
		}
	});

	it('declares the members an edit may state, and refuses the rest of the route’s body', () => {
		// Read from the DTO the route validates its body with rather than restated here, so a member added
		// to that DTO and not to the input fails this rather than arriving on one surface only.
		const body = dtoMembers(UpdateEntitlementDTO);

		// The control, so the comparisons below cannot pass on an empty read — and the DTO's own member
		// list, which is what the two lists below must account for between them.
		expect(body).toEqual([...EDITABLE, ...REFUSED_MEMBERS].sort());

		expect(inputMembers('UpdateEntitlementInput').sort()).toEqual([...EDITABLE].sort());

		// The members the field refuses are exactly what the body carries and the input does not: the
		// provenance, the allocated number, the kind, the lifecycle state and the grant-only members. A
		// REST caller can write `status` through the route's body today — `applyChanges` hands its patch
		// to the conditional `update` without filtering a member — and a right's state is not a field a
		// body owns (05 §19.1), so this surface does not carry the hole.
		const omitted = body.filter((member) => !inputMembers('UpdateEntitlementInput').includes(member));

		expect(omitted).toEqual([...REFUSED_MEMBERS].sort());
		expect(omitted).toEqual(expect.arrayContaining(['status', 'kind', 'number', 'orderLineId', 'revokedReason']));
	});

	it('declares the members the other three routes’ own bodies carry, and only those', () => {
		// The activation's correction is the route's body member for member, including the two members
		// that DTO's docstrings call closed while its metadata declares them — the divergence is recorded
		// on the field, and the mirror is asserted rather than the divergence repaired on one side only.
		expect(inputMembers('UpdateEntitlementActivationInput').sort()).toEqual(dtoMembers(UpdateEntitlementActivationDTO));

		// The key's assignment states one member, because the route's body does: a general update of a
		// credential is the capability 05 §19.3 refuses.
		expect(inputMembers('AssignEntitlementKeyInput').sort()).toEqual(dtoMembers(AssignEntitlementKeyDTO));

		// The replacement's body, which the service reads as its own input.
		expect(inputMembers('ReissueEntitlementKeyInput').sort()).toEqual(dtoMembers(ReissueEntitlementKeyDTO));
	});

	it('leaves every member of every input optional, as the routes’ own bodies do', () => {
		// Every one of the four bodies is a `PartialType` or an all-optional DTO, so an input that required
		// a member would refuse a call its route accepts. `conditions` is a list, and a list is nullable
		// even when its elements are not — so the claim is about the member's own wrapper, not its element.
		for (const input of [
			'UpdateEntitlementInput',
			'UpdateEntitlementActivationInput',
			'AssignEntitlementKeyInput',
			'ReissueEntitlementKeyInput'
		]) {
			for (const member of inputMembers(input)) {
				expect(inputMember(input, member).type.kind).not.toBe('NonNullType');
			}
		}
	});

	it('keeps every mutation the document already carried', () => {
		// A parity change is additive: the fields that were there stay there.
		for (const name of [
			'grantEntitlement',
			'revokeEntitlement',
			'extendEntitlement',
			'softDeleteEntitlement',
			'recoverEntitlement',
			'activateEntitlement',
			'deactivateEntitlement',
			'softDeleteEntitlementActivation',
			'recoverEntitlementActivation',
			'issueEntitlementKey',
			'revokeEntitlementKey',
			'softDeleteEntitlementKey',
			'recoverEntitlementKey'
		]) {
			expect(declares(name)).toBe(true);
		}
	});

	it('declares no root field twice, which no assertion inside a document can see', () => {
		// The `gql` tag parses a document with two fields of one name and `buildASTSchema` then fails with
		// `Field "Mutation.x" can only be defined once` — at boot, not here. A duplicate is therefore
		// asserted rather than left to the composition pass.
		const names = mutationNames();

		expect(new Set(names).size).toBe(names.length);
	});

	it('carries a plaintext on exactly the two fields whose call created the credential', () => {
		// The refusal of `reveal` is structural, not a note: the mutations whose payload states a plaintext
		// are the three that answer with one they have just minted, and no mutation answers a bare scalar,
		// which is the shape a read-back would take.
		const withPlaintext = mutationFields()
			.filter((field) =>
				['GrantEntitlementPayload', 'IssueEntitlementKeyPayload', 'ReissueEntitlementKeyPayload'].includes(
					namedTypeOf(field)
				)
			)
			.map((field) => field.name.value);

		expect(withPlaintext.sort()).toEqual(['grantEntitlement', 'issueEntitlementKey', 'reissueEntitlementKey']);
		expect(mutationFields().filter((field) => namedTypeName(field.type) === 'String')).toEqual([]);
		expect(mutationNames().filter((name) => name.toLowerCase().includes('reveal'))).toEqual([]);
	});
});

/**
 * One capability, two protocols, the same delegation.
 *
 * The two surfaces are one act stated twice, so the route is driven as well as the field: what is
 * compared is the call each of them makes on its own stub, not a service method named in this file.
 */
describe('the seven fields — the two protocols write the same rows the same way', () => {
	it.each(PARITY)('$field reaches the service method the $route route reaches', async (entry) => {
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		// One call each, with the same arguments in the same order: the route's body and the field's input
		// are one statement about the row, and a field that reordered them or dropped one would be a
		// different write. The version rides in the request on one surface and in the operation context on
		// the other, and both reach the service as the same accepted revision.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);

		// The acts that are more than one statement make the same further calls on both surfaces: an edit
		// writes the fields and then replaces the rule rows, and both read the right back afterwards.
		for (const { method, args } of entry.also ?? []) {
			expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(1, ...args);
			expect(stubs[entry.service][method]).toHaveBeenNthCalledWith(2, ...args);
			expect(stubs[entry.service][method]).toHaveBeenCalledTimes(2);
		}

		// No other collaborator was touched: a field wired to the wrong service is a field that acts on the
		// wrong aggregate, and the payload would carry whatever that one returned.
		for (const [name, stub] of Object.entries(stubs)) {
			if (name === entry.service) {
				continue;
			}

			expect(stub[entry.method]).not.toHaveBeenCalled();
		}

		// One answer, one implementation: the row either surface wrote is the same row.
		expect(overGraphql[entry.member]).toBe(entry.carries);
		expect(overGraphql.userErrors).toEqual([]);
	});

	it('reaches the reduction and not the extension, which would leave live slots above the ceiling', async () => {
		// The one wrong answer that would pass every other assertion in this file: `extend` accepts a
		// quantity, so a field that called it with the reduced ceiling would write the same column — and
		// would also move the term forward, return a suspended right to force, and leave the surplus
		// activations live above the new ceiling (05 I-68, 02 §4.8 E2).
		const entry = PARITY.find(({ field }) => field === 'reduceEntitlement') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		expect(stubs.entitlement.reduce).toHaveBeenCalledTimes(2);
		expect(stubs.entitlement.extend).not.toHaveBeenCalled();
	});

	it('reads the slot back after the correction, because the inherited update answers a result', async () => {
		// The CRUD base's `update` answers an `UpdateResult` on both ORMs, so a field whose payload carries
		// an activation reads it back. The route hands the raw result to its caller, which is a difference
		// of the answer and not of the write — and the read is asserted rather than assumed.
		const entry = PARITY.find(({ field }) => field === 'updateEntitlementActivation') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		expect(overRest).toEqual({ affected: 1, raw: [] });
		expect(stubs.activation.update).toHaveBeenCalledTimes(2);
		expect(stubs.activation.findOneScoped).toHaveBeenCalledTimes(1);
		expect(stubs.activation.findOneScoped).toHaveBeenNthCalledWith(1, ACTIVATION);
		expect(overGraphql.activation).toBe(CORRECTED);
	});

	it('replaces the credential rather than minting a second one, and answers all three members', async () => {
		// `issue` has no live-key guard, so a field that reached it would leave two working credentials
		// against one right; the replacement is the one operation that revokes what it replaces. The
		// plaintext of the replacement travels once, in this payload, as the issuance's does.
		const entry = PARITY.find(({ field }) => field === 'reissueEntitlementKey') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		const overRest = await controller[entry.route](...entry.routeArgs);
		const overGraphql = await resolver[entry.field](...entry.fieldArgs);

		expect(stubs.key.reissue).toHaveBeenCalledTimes(2);
		expect(stubs.key.issue).not.toHaveBeenCalled();

		expect(overRest.replacedKey).toBe(REPLACED);
		expect(overGraphql.key).toBe(ISSUED);
		expect(overGraphql.plaintextKey).toBe(PLAINTEXT);
		expect(overGraphql.replacedKey).toBe(REPLACED);
	});

	it('records the holder through the assignment and not through a general update', async () => {
		// The route's handler is named `update` and its body is `AssignEntitlementKeyDTO`: what it does is
		// assign, and 05 §19.3 closes the general write a field named for the handler would invite.
		const entry = PARITY.find(({ field }) => field === 'assignEntitlementKey') as IParity;
		const { stubs, controller, resolver } = surfaces(entry);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		expect(stubs.key.assign).toHaveBeenCalledTimes(2);
		expect(stubs.key.update).not.toHaveBeenCalled();
	});

	it('reports a refusal on each resource the way its siblings do, as a user error', async () => {
		// The convention every mutation of this plugin follows: an outcome the caller could have avoided is
		// reported in the payload with the operation succeeding, and only a request that could not have been
		// made correctly becomes a GraphQL error. The two services that can refuse are driven here, and the
		// member each payload carries is null with the code the service named.
		const refusal = new Error('ENTITLEMENT_KEY_REVOKED: a withdrawn key is never replaced.');

		const reissue = PARITY.find(({ field }) => field === 'reissueEntitlementKey') as IParity;
		const reissueSurfaces = surfaces(reissue);
		reissueSurfaces.stubs.key.reissue.mockRejectedValue(refusal);

		const suspended = PARITY.find(({ field }) => field === 'suspendEntitlement') as IParity;
		const suspendSurfaces = surfaces(suspended);
		suspendSurfaces.stubs.entitlement.suspend.mockRejectedValue(refusal);

		const answered = await reissueSurfaces.resolver[reissue.field](...reissue.fieldArgs);
		expect(answered.key).toBeNull();
		expect(answered.plaintextKey).toBeNull();
		expect(answered.replacedKey).toBeNull();
		expect(answered.userErrors).toEqual([
			{ code: 'ENTITLEMENT_KEY_REVOKED', message: refusal.message, path: [], details: null }
		]);

		const refused = await suspendSurfaces.resolver[suspended.field](...suspended.fieldArgs);
		expect(refused.entitlement).toBeNull();
		expect(refused.userErrors).toEqual([
			{ code: 'ENTITLEMENT_KEY_REVOKED', message: refusal.message, path: [], details: null }
		]);
	});
});

/**
 * The authorisation is the route's, field by field.
 *
 * Each of the seven is a write, so a field that stated no grant of its own would be one `PermissionGuard`
 * answers `true` to, because it answers `true` to empty metadata: every authenticated caller could edit a
 * right's ceiling, pause it, correct a slot, or hand a credential to someone. No resolver in this plugin
 * states a class-level grant that could close that — every one of them states the *view* grant — which is
 * why the comparison is against the route's own handler metadata rather than against the class.
 */
describe('the seven fields — the permission and the guards are the route’s', () => {
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

	it('demands the editing grant each route states, on the handler itself', () => {
		for (const { field, route, controller, resolver, grant } of PARITY) {
			// Read from the field's own handler rather than through the override rule the guards apply:
			// `PermissionGuard` answers `true` to empty metadata, and every resolver of this plugin states a
			// class-level *view* grant that must not stand in for the field's own.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(resolver)[field])).toEqual([grant]);
			expect(permissionOfField(resolver, field)).toEqual([grant]);
			expect(permissionOfRoute(controller, route)).toEqual([grant]);
		}

		expect(new Set(PARITY.map(({ grant }) => grant))).toEqual(
			new Set([EntitlementPermissions.ENTITLEMENTS_EDIT])
		);
	});

	it('mirrors the retry scope and the version expectation the route declares, and invents neither', () => {
		// Two of the seven routes carry `@Idempotent` and four carry `@Versioned`, and the field beside each
		// carries the same metadata — the same scope object, not a scope of the same name — so a retry over
		// GraphQL dedupes exactly where a retry over REST does, and a version is required exactly where the
		// route requires one.
		for (const { field, route, controller, resolver } of PARITY) {
			for (const key of [IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY]) {
				expect(Reflect.getMetadata(key, fieldsOf(resolver)[field])).toEqual(
					Reflect.getMetadata(key, handlersOf(controller)[route])
				);
			}
		}

		// Stated explicitly as well, because this is what a reader will look for: the four fields whose
		// routes carry a version state one, and the two retry scopes are the routes' own names. The version
		// is the right's own service, which is what the route declares — the field states no version of its
		// own and the guard is what requires it.
		for (const field of ['updateEntitlement', 'suspendEntitlement', 'resumeEntitlement', 'reduceEntitlement']) {
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(EntitlementResolver)[field])).toEqual({
				resource: expect.anything()
			});
		}

		expect(
			Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(EntitlementResolver)['suspendEntitlement'])
		).toEqual(expect.objectContaining({ scope: 'entitlement.suspend', required: false }));
		expect(
			Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(EntitlementResolver)['resumeEntitlement'])
		).toEqual(expect.objectContaining({ scope: 'entitlement.resume', required: false }));

		// The three that carry neither convention, because their routes carry neither: a retry scope or a
		// version expectation invented here would dedupe, or refuse, where the route does not.
		for (const [resolver, field] of [
			[EntitlementActivationResolver, 'updateEntitlementActivation'],
			[EntitlementKeyResolver, 'assignEntitlementKey'],
			[EntitlementKeyResolver, 'reissueEntitlementKey']
		] as [new (...args: any[]) => any, string][]) {
			expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
			expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, fieldsOf(resolver)[field])).toBeUndefined();
		}

		// And the one that carries the version and not the scope: the edit's route declares both conventions
		// except this one, and a scope invented for it would answer a repeated edit from a stored response
		// rather than from the row the version already protects.
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(EntitlementResolver)['updateEntitlement'])).toBeUndefined();
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, fieldsOf(EntitlementResolver)['reduceEntitlement'])).toBeUndefined();
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
 * The four collapsed routes — and the merged pair — reached, not merely named.
 *
 * The reading that collapsed these is only worth anything if the field it names really is the same
 * capability, so each pair is driven as well as declared: the same service method, with the same body,
 * once on each surface.
 */
describe('the collapsed routes — the capability is answered under another name', () => {
	it.each(COLLAPSED)('$resource.$route is served by $field', async (entry) => {
		// The route is real and declared, which is what makes the audit's flag a statement about the
		// surface rather than about a handler that does not exist.
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');

		// The audit's expectation is absent — the name it built from the handler and the resource, or,
		// for a domain verb, every field name that carries the verb — while the capability is answered by
		// the field the table names.
		expect(auditAnswered(entry)).toBe(false);
		expect(declares(entry.field)).toBe(true);

		const stubs: Row = {
			entitlement: collaborator(FOREIGN),
			activation: collaborator(FOREIGN),
			key: collaborator(FOREIGN),
			foreign: collaborator(FOREIGN)
		};
		const { controller, resolver } = entry.build(stubs);

		await controller[entry.route](...entry.routeArgs);
		await resolver[entry.field](...entry.fieldArgs);

		// One method, one body: the naming variant is a naming variant because the two surfaces state the
		// same write, not because they are assumed to.
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(1, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenNthCalledWith(2, ...entry.serviceArgs);
		expect(stubs[entry.service][entry.method]).toHaveBeenCalledTimes(2);
	});

	it('serves the slot’s release and its sibling’s revocation through the one deactivating field', async () => {
		// The field is not a rename: the act a caller performs is the `revoked` argument, and each of the
		// two acts reaches the method its own route reaches. The route the audit silently matched — the
		// sibling revocation — is asserted here as well, because the field that matched it is a right's
		// withdrawal and answers a different capability entirely.
		const entry = MERGED[0];
		const stubs: Row = { activation: collaborator(FOREIGN), foreign: collaborator(FOREIGN) };
		const controller = new EntitlementActivationController(stubs.activation) as Row;
		const resolver = new EntitlementActivationResolver(stubs.activation, stubs.foreign) as Row;

		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(typeof handlersOf(entry.controller)[entry.sibling]).toBe('function');
		expect(auditHoldsForVerb(entry.expects, entry.resource)).toBe(false);
		expect(declares(entry.field)).toBe(true);

		await controller[entry.route](ACTIVATION, { reason: REASON });
		await resolver[entry.field](ACTIVATION, REASON, false);

		expect(stubs.activation.release).toHaveBeenNthCalledWith(1, ACTIVATION, REASON);
		expect(stubs.activation.release).toHaveBeenNthCalledWith(2, ACTIVATION, REASON);
		expect(stubs.activation.release).toHaveBeenCalledTimes(2);

		await controller[entry.sibling](ACTIVATION, { reason: REASON });
		await resolver[entry.field](ACTIVATION, REASON, true);

		expect(stubs.activation.revoke).toHaveBeenNthCalledWith(1, ACTIVATION, REASON);
		expect(stubs.activation.revoke).toHaveBeenNthCalledWith(2, ACTIVATION, REASON);
		expect(stubs.activation.revoke).toHaveBeenCalledTimes(2);
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
describe('the sixteen flagged routes — four buckets, none of them left unread', () => {
	it('flags sixteen routes, collapses four, merges one, refuses four and implements seven', () => {
		expect(COLLAPSED).toHaveLength(4);
		expect(MERGED).toHaveLength(1);
		expect(REFUSED).toHaveLength(4);
		expect(PARITY).toHaveLength(7);
		expect(COLLAPSED.length + MERGED.length + REFUSED.length + PARITY.length).toBe(16);
	});

	it('closes six of the sixteen flags and leaves ten standing, each for a stated reason', () => {
		// The residual is the measurement a reader should meet rather than a claim: the instrument reads
		// names, so four renamed routes, one merged field, one delivered-but-differently-named field and
		// four refusals keep their flags, and a wave that renamed something to silence the instrument
		// would have to delete a row here to do it.
		expect(CLOSED.length + RESIDUAL.length).toBe(16);
		expect(CLOSED).toHaveLength(6);
		expect(RESIDUAL).toHaveLength(10);

		// Sixteen routes, sixteen distinct expectations: each flag is accounted for exactly once, so a
		// bucket that quietly dropped a row fails here rather than in a reader's arithmetic.
		const expectations = [...CLOSED, ...RESIDUAL].map((entry) => entry.expects);

		expect(new Set(expectations).size).toBe(16);

		for (const entry of RESIDUAL) {
			expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
			expect(auditAnswered(entry)).toBe(false);
			expect(entry.reading.length).toBeGreaterThan(0);
		}
	});

	it.each(CLOSED)('$resource.$route is now answered, which is what this wave delivered', (entry) => {
		expect(typeof handlersOf(entry.controller)[entry.route]).toBe('function');
		expect(auditAnswered(entry)).toBe(true);
	});

	it.each(REFUSED)('$resource.$route is refused, and what it was for is answered', ({ controller, route, expects, verb, grant, served }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The name the audit looked for is not declared, and the suite asserts that rather than describing
		// it: a wave that adds one of these writes to the schema has to delete the row that refuses it.
		expect(verb ? auditHoldsForVerb(expects, controller.name.replace(/Controller$/, '')) : declares(expects)).toBe(false);

		// What the route was for is reached another way on every one of the four: a replacement credential,
		// or the recoverable pair each resource serves.
		for (const field of served) {
			expect(declares(field)).toBe(true);
		}

		// And the route is a real, gated capability rather than an ungated stray: it states its own grant —
		// the issuing one for the re-display, the editing one for the deletes — which is why the refusal is
		// a reading of the specifications and not of the guard metadata.
		expect(permissionOfRoute(controller, route)).toEqual([grant]);
	});
});
