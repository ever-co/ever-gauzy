/**
 * The entitlement lifecycle on both ORMs, against real SQLite.
 *
 * Every lifecycle write in this package — granting a right, putting it into force, suspending, resuming,
 * extending, reducing, revoking and expiring it, taking and giving back a slot, issuing and revoking a key
 * — used to open `typeOrm…Repository.manager.transaction(...)` and decide inside it through TypeORM's
 * manager and the row lock's TypeORM query builder, with no ORM branch at all. Under `DB_ORM=mikro-orm`
 * the TypeORM entities carry the base entity's columns and nothing else, so each of those writes failed,
 * or wrote a right with no status and no tenant. The suites below run the **same** scenarios on each ORM:
 *
 * - on **TypeORM** they are the regression net for the path production runs, and every TypeORM
 *   repository is a real one over an in-memory better-sqlite3 database while every MikroORM repository
 *   throws on any member it is asked for — so a TypeORM installation is proven never to reach MikroORM;
 * - on **MikroORM** the roles are swapped: every TypeORM repository throws, the MikroORM repositories are
 *   real, and MikroORM runs with `allowGlobalContext: false`, as the platform configures it — so each
 *   write is also proven to need no request context, which an event consumer and the expiry pass do not
 *   have.
 *
 * **Why the database is real.** What the defect broke is which statements reach which table and under
 * which transaction, so the assertions read the tables back rather than a double's call log: the version
 * predicate committed in ca770416e5, the rollback of a refused transition together with its outbox row,
 * and the relation ids — `tenantId`, `organizationId`, `customerId`, `entitlementId`, `entitlementKeyId`
 * — which MikroORM maps `persist: false` beside the relation that owns the column, and which a write that
 * named only the mirror could lose.
 *
 * The tables are mapped by fixture schemas that carry the columns the services read and write, mapped the
 * way each ORM maps the production entities: on MikroORM each relation id is a `persist: false` mirror of
 * a many-to-one on the same column, and the soft-delete filter is the one `mikro-orm-soft-delete`
 * registers. The real entities cannot be mapped here, because they reach the whole application graph.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites state, and
 * everything the defect lives in is the kernel's own or the package's own: the version helpers, the
 * TypeORM-to-MikroORM criteria translation, the four services, the row lock and the persistence helpers.
 * The outbox double writes the event row through whichever manager it is handed and records whether that
 * manager was inside a transaction, because "the event commits with the change it describes" is the
 * outbox's whole contract.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to what the lifecycle reads of it: the repositories and the ORM. */
	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return mockOrm.current;
		}
	}

	const utils = jest.requireActual('@gauzy/core/src/lib/core/utils');

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		MultiORMEnum: utils.MultiORMEnum,
		getORMType: () => mockOrm.current,
		// The platform's own translation from TypeORM's criteria to MikroORM's: a `Not(...)` the lifecycle
		// states is answered by the code production answers it with, not by a restatement here.
		convertTypeORMWhereToMikroORM: utils.convertTypeORMWhereToMikroORM,
		parseOrderOptions: utils.parseOrderOptions,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class OrganizationContact {},
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		bumpVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').bumpVersion,
		parseEntityVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').parseEntityVersion,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => mockCaller.userId,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			currentIp: () => null,
			currentUserAgent: () => null,
			currentRequest: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	return {
		...actual,
		// The dialect the row lock is decided by. Both halves run on SQLite; the lock case flips these.
		isPostgres: jest.fn(() => false),
		isMySQL: jest.fn(() => false)
	};
});

/** The ORM the services report, as `CrudService.ormType` reports it. */
const mockOrm: { current: 'typeorm' | 'mikro-orm' } = { current: 'typeorm' };

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null; userId: string | null } = {
	tenantId: null,
	organizationId: null,
	userId: null
};

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import {
	EntityCaseNamingStrategy,
	EntityManager as MikroOrmEntityManager,
	EntitySchema as MikroOrmEntitySchema,
	LockMode,
	MikroORM
} from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityRepository } from '@mikro-orm/knex';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import * as gauzyConfig from '@gauzy/config';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { OrganizationContact } from '@gauzy/core';
import { ApiErrorCode } from '@gauzy/core/src/lib/core/errors/api-error-codes';
import { Entitlement } from './entitlement/entitlement.entity';
import { EntitlementActivation } from './entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from './entitlement-key/entitlement-key.entity';
import {
	EntitlementActivationStatus,
	EntitlementKeyStatus,
	EntitlementKind,
	EntitlementStatus
} from './entitlement.enums';
import { EntitlementCheckReason, EntitlementEventName } from './entitlement.types';
import { EntitlementService } from './entitlement/entitlement.service';
import { EntitlementActivationService } from './entitlement-activation/entitlement-activation.service';
import { EntitlementKeyService } from './entitlement-key/entitlement-key.service';
import { EntitlementCheckService } from './entitlement-check/entitlement-check.service';

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';
const OTHER_ORG = '00000000-0000-4000-8000-000000000004';
const CONTACT = '00000000-0000-4000-8000-000000000005';
const USER = '00000000-0000-4000-8000-000000000006';

/** The event row the outbox double writes: enough to say which event, about what, in whose scope. */
class OutboxRow {
	id!: string;
	eventName!: string;
	aggregateType!: string;
	aggregateId!: string;
	payload!: string;
	tenantId?: string | null;
	organizationId?: string | null;
}

/*
|--------------------------------------------------------------------------
| TypeORM: the three tables bound to the package's own classes
|--------------------------------------------------------------------------
*/

/** The base entity's columns, as TypeORM maps them: the scope columns are plain columns there. */
const typeOrmBase = () => ({
	id: { type: 'varchar', primary: true, generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
	isActive: { type: 'boolean', nullable: true, default: true },
	isArchived: { type: 'boolean', nullable: true, default: false },
	archivedAt: { type: 'datetime', nullable: true },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true },
	createdByUserId: { type: 'varchar', nullable: true }
});

const TypeOrmContact = new EntitySchema<any>({
	name: 'OrganizationContact',
	target: OrganizationContact,
	tableName: 'organization_contact',
	columns: { id: { type: 'varchar', primary: true }, name: { type: 'varchar', nullable: true } }
});

const TypeOrmEntitlement = new EntitySchema<any>({
	name: 'Entitlement',
	target: Entitlement,
	tableName: 'entitlement',
	columns: {
		...(typeOrmBase() as any),
		customerId: { type: 'varchar', nullable: true },
		orderId: { type: 'varchar', nullable: true },
		orderLineId: { type: 'varchar', nullable: true },
		subscriptionId: { type: 'varchar', nullable: true },
		productId: { type: 'varchar', nullable: true },
		variantId: { type: 'varchar', nullable: true },
		number: { type: 'varchar' },
		kind: { type: 'varchar', default: EntitlementKind.LICENCE },
		quantity: { type: 'int', default: 1 },
		startsAt: { type: 'datetime' },
		endsAt: { type: 'datetime', nullable: true },
		gracePeriodDays: { type: 'int', default: 0 },
		activationLimit: { type: 'int', nullable: true },
		activationCount: { type: 'int', default: 0 },
		status: { type: 'varchar', default: EntitlementStatus.PENDING },
		revokedAt: { type: 'datetime', nullable: true },
		revokedByUserId: { type: 'varchar', nullable: true },
		revokedReason: { type: 'varchar', nullable: true },
		suspendedReason: { type: 'varchar', nullable: true },
		version: { type: 'int', default: 1 },
		metadata: { type: 'simple-json', nullable: true }
	},
	relations: {
		customer: {
			type: 'many-to-one',
			target: 'OrganizationContact',
			joinColumn: { name: 'customerId' },
			nullable: true
		},
		activations: { type: 'one-to-many', target: 'EntitlementActivation', inverseSide: 'entitlement' },
		keys: { type: 'one-to-many', target: 'EntitlementKey', inverseSide: 'entitlement' }
	}
});

const TypeOrmActivation = new EntitySchema<any>({
	name: 'EntitlementActivation',
	target: EntitlementActivation,
	tableName: 'entitlement_activation',
	columns: {
		...(typeOrmBase() as any),
		entitlementId: { type: 'varchar' },
		entitlementKeyId: { type: 'varchar', nullable: true },
		deviceId: { type: 'varchar' },
		deviceName: { type: 'varchar', nullable: true },
		fingerprint: { type: 'varchar', nullable: true },
		seatReference: { type: 'varchar', nullable: true },
		activatedByCustomerId: { type: 'varchar', nullable: true },
		status: { type: 'varchar', default: EntitlementActivationStatus.ACTIVE },
		activatedAt: { type: 'datetime' },
		lastSeenAt: { type: 'datetime', nullable: true },
		deactivatedAt: { type: 'datetime', nullable: true },
		revokedAt: { type: 'datetime', nullable: true },
		revokedByUserId: { type: 'varchar', nullable: true },
		revocationReason: { type: 'varchar', nullable: true },
		ipAddress: { type: 'varchar', nullable: true },
		userAgent: { type: 'varchar', nullable: true },
		metadata: { type: 'simple-json', nullable: true }
	},
	relations: {
		entitlement: {
			type: 'many-to-one',
			target: 'Entitlement',
			joinColumn: { name: 'entitlementId' },
			inverseSide: 'activations'
		}
	}
});

const TypeOrmKey = new EntitySchema<any>({
	name: 'EntitlementKey',
	target: EntitlementKey,
	tableName: 'entitlement_key',
	columns: {
		...(typeOrmBase() as any),
		entitlementId: { type: 'varchar' },
		keyHash: { type: 'varchar' },
		keyCiphertext: { type: 'varchar', nullable: true },
		keyPrefix: { type: 'varchar', nullable: true },
		format: { type: 'varchar', default: 'UUID' },
		status: { type: 'varchar', default: EntitlementKeyStatus.ISSUED },
		assignedAt: { type: 'datetime', nullable: true },
		assignedToEmail: { type: 'varchar', nullable: true },
		assignedToCustomerId: { type: 'varchar', nullable: true },
		activationLimit: { type: 'int', nullable: true },
		activationCount: { type: 'int', default: 0 },
		expiresAt: { type: 'datetime', nullable: true },
		revokedAt: { type: 'datetime', nullable: true },
		revokedByUserId: { type: 'varchar', nullable: true },
		metadata: { type: 'simple-json', nullable: true }
	},
	relations: {
		entitlement: {
			type: 'many-to-one',
			target: 'Entitlement',
			joinColumn: { name: 'entitlementId' },
			inverseSide: 'keys'
		}
	}
});

const TypeOrmOutbox = new EntitySchema<any>({
	name: 'OutboxRow',
	target: OutboxRow,
	tableName: 'outbox_row',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		eventName: { type: 'varchar' },
		aggregateType: { type: 'varchar' },
		aggregateId: { type: 'varchar' },
		payload: { type: 'text' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

/*
|--------------------------------------------------------------------------
| MikroORM: the same tables, mapped the way the kernel's decorators map them
|--------------------------------------------------------------------------
*/

/** The soft-delete filter `mikro-orm-soft-delete` registers on every production entity. */
const softDelete = {
	[SOFT_DELETABLE_FILTER]: { name: SOFT_DELETABLE_FILTER, cond: { deletedAt: null }, default: true }
};

/** A many-to-one, and the `persist: false` relation id beside it on the same column. */
const relationWithId = (relation: string, entity: string, nullable = true) => ({
	[relation]: { kind: 'm:1', entity, nullable, joinColumn: `${relation}Id`, referenceColumnName: 'id' },
	[`${relation}Id`]: { type: 'string', nullable, persist: false }
});

/** The base entity's properties, as `@MultiORMColumn` and `@MultiORMManyToOne` map them on MikroORM. */
const mikroOrmBase = () => ({
	id: { type: 'string', primary: true },
	createdAt: { type: 'Date', nullable: true },
	updatedAt: { type: 'Date', nullable: true },
	deletedAt: { type: 'Date', nullable: true },
	isActive: { type: 'boolean', nullable: true, default: true },
	isArchived: { type: 'boolean', nullable: true, default: false },
	archivedAt: { type: 'Date', nullable: true },
	...relationWithId('tenant', 'Tenant'),
	...relationWithId('organization', 'Organization'),
	...relationWithId('createdByUser', 'User')
});

/** A table another capability owns, reduced to the key a relation references. */
const mikroOrmParent = (name: string, tableName: string) =>
	new MikroOrmEntitySchema<any>({
		name,
		tableName,
		filters: softDelete as any,
		properties: { id: { type: 'string', primary: true }, deletedAt: { type: 'Date', nullable: true } } as any
	});

const MikroOrmEntitlement = new MikroOrmEntitySchema<any>({
	name: 'Entitlement',
	tableName: 'entitlement',
	filters: softDelete as any,
	properties: {
		...mikroOrmBase(),
		...relationWithId('customer', 'OrganizationContact'),
		orderId: { type: 'string', nullable: true },
		orderLineId: { type: 'string', nullable: true },
		subscriptionId: { type: 'string', nullable: true },
		productId: { type: 'string', nullable: true },
		variantId: { type: 'string', nullable: true },
		number: { type: 'string' },
		kind: { type: 'string', default: EntitlementKind.LICENCE },
		quantity: { type: 'integer', default: 1 },
		startsAt: { type: 'Date' },
		endsAt: { type: 'Date', nullable: true },
		gracePeriodDays: { type: 'integer', default: 0 },
		activationLimit: { type: 'integer', nullable: true },
		activationCount: { type: 'integer', default: 0 },
		status: { type: 'string', default: EntitlementStatus.PENDING },
		revokedAt: { type: 'Date', nullable: true },
		revokedByUserId: { type: 'string', nullable: true },
		revokedReason: { type: 'string', nullable: true },
		suspendedReason: { type: 'string', nullable: true },
		version: { type: 'integer', default: 1 },
		metadata: { type: 'json', nullable: true },
		activations: { kind: '1:m', entity: 'EntitlementActivation', mappedBy: 'entitlement' },
		keys: { kind: '1:m', entity: 'EntitlementKey', mappedBy: 'entitlement' }
	} as any
});

const MikroOrmActivation = new MikroOrmEntitySchema<any>({
	name: 'EntitlementActivation',
	tableName: 'entitlement_activation',
	filters: softDelete as any,
	properties: {
		...mikroOrmBase(),
		...relationWithId('entitlement', 'Entitlement', false),
		...relationWithId('entitlementKey', 'EntitlementKey'),
		deviceId: { type: 'string' },
		deviceName: { type: 'string', nullable: true },
		fingerprint: { type: 'string', nullable: true },
		seatReference: { type: 'string', nullable: true },
		activatedByCustomerId: { type: 'string', nullable: true },
		status: { type: 'string', default: EntitlementActivationStatus.ACTIVE },
		activatedAt: { type: 'Date' },
		lastSeenAt: { type: 'Date', nullable: true },
		deactivatedAt: { type: 'Date', nullable: true },
		revokedAt: { type: 'Date', nullable: true },
		revokedByUserId: { type: 'string', nullable: true },
		revocationReason: { type: 'string', nullable: true },
		ipAddress: { type: 'string', nullable: true },
		userAgent: { type: 'string', nullable: true },
		metadata: { type: 'json', nullable: true }
	} as any
});

const MikroOrmKey = new MikroOrmEntitySchema<any>({
	name: 'EntitlementKey',
	tableName: 'entitlement_key',
	filters: softDelete as any,
	properties: {
		...mikroOrmBase(),
		...relationWithId('entitlement', 'Entitlement', false),
		keyHash: { type: 'string' },
		keyCiphertext: { type: 'string', nullable: true },
		keyPrefix: { type: 'string', nullable: true },
		format: { type: 'string', default: 'UUID' },
		status: { type: 'string', default: EntitlementKeyStatus.ISSUED },
		assignedAt: { type: 'Date', nullable: true },
		assignedToEmail: { type: 'string', nullable: true },
		assignedToCustomerId: { type: 'string', nullable: true },
		activationLimit: { type: 'integer', nullable: true },
		activationCount: { type: 'integer', default: 0 },
		expiresAt: { type: 'Date', nullable: true },
		revokedAt: { type: 'Date', nullable: true },
		revokedByUserId: { type: 'string', nullable: true },
		metadata: { type: 'json', nullable: true }
	} as any
});

const MikroOrmOutbox = new MikroOrmEntitySchema<any>({
	name: 'OutboxRow',
	tableName: 'outbox_row',
	properties: {
		id: { type: 'string', primary: true },
		eventName: { type: 'string' },
		aggregateType: { type: 'string' },
		aggregateId: { type: 'string' },
		payload: { type: 'text' },
		tenantId: { type: 'string', nullable: true },
		organizationId: { type: 'string', nullable: true }
	} as any
});

/*
|--------------------------------------------------------------------------
| The harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	entitlements: EntitlementService;
	activations: EntitlementActivationService;
	keys: EntitlementKeyService;
	check: EntitlementCheckService;
	/** Every row of a table, as the table holds it. */
	rows(table: string): Promise<Row[]>;
	/** One row of a table, as the table holds it. */
	row(table: string, id: string): Promise<Row | undefined>;
	/** Writes columns straight into a row, outside the services — a concurrent writer. */
	poke(table: string, id: string, columns: Row): Promise<void>;
	/** The events the outbox double wrote, oldest first, with the kind of manager each was handed. */
	appended: Array<{ name: string; aggregateId: string; through: string }>;
	/** What the services published on the in-process bus. */
	published: any[];
	/** Makes the next outbox append fail, after the transition it describes was written. */
	failNextAppend(): void;
	/** Empties the package's tables and the outbox beneath the services, so a case starts from nothing. */
	clear(): Promise<void>;
	close(): Promise<void>;
}

/** A repository this half must never reach: any member it is asked for fails the case. */
function unreachable(name: string): any {
	return new Proxy(
		{},
		{
			get: (_target, property) => {
				throw new Error(`The ${name} was reached (${String(property)}).`);
			}
		}
	);
}

/** The collaborators the lifecycle delegates to and this suite is not about. */
function collaborators() {
	let number = 0;
	const published: any[] = [];

	return {
		published,
		sequenceService: { allocate: async () => ({ formatted: `ENT-${String(++number).padStart(4, '0')}` }) },
		ruleService: {
			assertWritable: () => undefined,
			findByOwner: async () => [],
			evaluateRules: () => ({ matched: true, failedRules: [], unresolvedAttributes: [], coercionFailures: [] }),
			replaceOwnerRules: async () => undefined
		},
		eventBus: { publish: async (event: unknown) => void published.push(event) }
	};
}

/**
 * The outbox, reduced to the call the lifecycle makes on it. It writes the event row through the manager it
 * is handed — TypeORM's, or MikroORM's — so a rollback of the transition takes the row with it, and it
 * records whether that manager was inside a transaction.
 */
function outboxDouble(state: { failNext: boolean; appended: IHarness['appended'] }) {
	return {
		append: async (manager: any, input: any) => {
			if (state.failNext) {
				state.failNext = false;

				throw new Error('the outbox could not be written');
			}

			const row = {
				id: randomUUID(),
				eventName: input.name,
				aggregateType: input.aggregateType,
				aggregateId: input.aggregateId,
				payload: JSON.stringify(input.data ?? {}),
				tenantId: input.tenantId ?? null,
				organizationId: input.organizationId ?? null
			};

			if (manager instanceof MikroOrmEntityManager) {
				state.appended.push({
					name: input.name,
					aggregateId: input.aggregateId,
					through: manager.isInTransaction() ? 'mikro-orm:transaction' : 'mikro-orm'
				});
				await manager.insert('OutboxRow', row);
			} else {
				state.appended.push({
					name: input.name,
					aggregateId: input.aggregateId,
					through: manager?.queryRunner?.isTransactionActive ? 'typeorm:transaction' : 'typeorm'
				});
				await manager.insert(OutboxRow, row);
			}
		}
	};
}

/** Wires the four services the way the module does, over the repositories one half hands in. */
function wire(repositories: {
	typeOrm: { entitlement: any; activation: any; key: any };
	mikroOrm: { entitlement: any; activation: any; key: any };
	outbox: unknown;
}) {
	const { published, sequenceService, ruleService, eventBus } = collaborators();
	const { typeOrm, mikroOrm, outbox } = repositories;

	const check = new EntitlementCheckService(
		typeOrm.entitlement,
		typeOrm.key,
		typeOrm.activation,
		ruleService as never,
		mikroOrm.entitlement
	);
	const keys = new EntitlementKeyService(typeOrm.key, mikroOrm.key, typeOrm.entitlement, outbox as never);
	const activations = new EntitlementActivationService(
		typeOrm.activation,
		mikroOrm.activation,
		keys,
		check,
		outbox as never,
		eventBus as never
	);
	const entitlements = new EntitlementService(
		typeOrm.entitlement,
		mikroOrm.entitlement,
		activations,
		keys,
		sequenceService as never,
		ruleService as never,
		outbox as never,
		eventBus as never
	);

	return { entitlements, activations, keys, check, published };
}

const TABLES = ['outbox_row', 'entitlement_activation', 'entitlement_key', 'entitlement'];

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmContact, TypeOrmEntitlement, TypeOrmActivation, TypeOrmKey, TypeOrmOutbox],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});

	await dataSource.initialize();
	await dataSource.query(`INSERT INTO "organization_contact" ("id") VALUES (?)`, [CONTACT]);

	const state = { failNext: false, appended: [] as IHarness['appended'] };
	const services = wire({
		typeOrm: {
			entitlement: dataSource.getRepository(Entitlement),
			activation: dataSource.getRepository(EntitlementActivation),
			key: dataSource.getRepository(EntitlementKey)
		},
		mikroOrm: {
			entitlement: unreachable('MikroORM entitlement repository'),
			activation: unreachable('MikroORM activation repository'),
			key: unreachable('MikroORM key repository')
		},
		outbox: outboxDouble(state)
	});

	return {
		...services,
		appended: state.appended,
		rows: (table) => dataSource.query(`SELECT * FROM "${table}"`),
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		poke: async (table, id, columns) => {
			const names = Object.keys(columns);

			await dataSource.query(
				`UPDATE "${table}" SET ${names.map((name) => `"${name}" = ?`).join(', ')} WHERE "id" = ?`,
				[...names.map((name) => columns[name]), id]
			);
		},
		failNextAppend: () => void (state.failNext = true),
		clear: async () => {
			for (const table of TABLES) {
				await dataSource.query(`DELETE FROM "${table}"`);
			}
		},
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [
			mikroOrmParent('Tenant', 'tenant'),
			mikroOrmParent('Organization', 'organization'),
			mikroOrmParent('User', 'user'),
			mikroOrmParent('OrganizationContact', 'organization_contact'),
			MikroOrmEntitlement,
			MikroOrmActivation,
			MikroOrmKey,
			MikroOrmOutbox
		],
		// The naming strategy production sets, so a relation lands on the `<relation>Id` column it names.
		namingStrategy: EntityCaseNamingStrategy,
		// As the platform configures it: work that needs a context must bring one.
		allowGlobalContext: false,
		discovery: { warnWhenNoEntities: false }
	});

	await orm.getSchemaGenerator().createSchema();

	const seed = orm.em.fork();

	for (const [table, id] of [
		['tenant', TENANT],
		['tenant', OTHER_TENANT],
		['organization', ORG],
		['organization', OTHER_ORG],
		['user', USER],
		['organization_contact', CONTACT]
	]) {
		await seed.getConnection().execute(`INSERT INTO "${table}" ("id") VALUES (?)`, [id]);
	}

	const state = { failNext: false, appended: [] as IHarness['appended'] };
	const repository = (entityName: string) => new EntityRepository<any>(orm.em as any, entityName);
	const services = wire({
		typeOrm: {
			entitlement: unreachable('TypeORM entitlement repository'),
			activation: unreachable('TypeORM activation repository'),
			key: unreachable('TypeORM key repository')
		},
		mikroOrm: {
			entitlement: repository('Entitlement'),
			activation: repository('EntitlementActivation'),
			key: repository('EntitlementKey')
		},
		outbox: outboxDouble(state)
	});
	const execute = (sql: string, parameters: unknown[] = []) =>
		orm.em.fork().getConnection().execute(sql, parameters) as Promise<Row[]>;

	return {
		...services,
		appended: state.appended,
		rows: (table) => execute(`SELECT * FROM "${table}"`),
		row: async (table, id) => (await execute(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		poke: async (table, id, columns) => {
			const names = Object.keys(columns);

			await execute(`UPDATE "${table}" SET ${names.map((name) => `"${name}" = ?`).join(', ')} WHERE "id" = ?`, [
				...names.map((name) => columns[name]),
				id
			]);
		},
		failNextAppend: () => void (state.failNext = true),
		clear: async () => {
			for (const table of TABLES) {
				await execute(`DELETE FROM "${table}"`);
			}
		},
		close: () => orm.close(true)
	};
}

/** The caller every case acts as, unless it says otherwise. */
const SCOPE = { tenantId: TENANT, organizationId: ORG };

/** Lets the clock move, so rows written one after another carry distinct instants. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/** The event names the outbox holds, oldest first. */
async function eventNames(harness: IHarness): Promise<string[]> {
	return (await harness.rows('outbox_row')).map((row) => row.eventName);
}

describe.each([
	['TypeORM', 'typeorm', typeOrmHarness],
	['MikroORM', 'mikro-orm', mikroOrmHarness]
] as const)('The entitlement lifecycle under %s (real SQLite)', (_label, orm, open) => {
	let harness: IHarness;

	/** The kind of manager every event of this half must have been appended through. */
	const transactional = `${orm}:transaction`;

	beforeAll(async () => {
		mockOrm.current = orm;
		harness = await open();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		mockOrm.current = orm;
		Object.assign(mockCaller, { tenantId: TENANT, organizationId: ORG, userId: USER });
		(gauzyConfig.isPostgres as jest.Mock).mockReturnValue(false);
		(gauzyConfig.isMySQL as jest.Mock).mockReturnValue(false);

		await harness.clear();
		harness.appended.length = 0;
		harness.published.length = 0;
	});

	afterEach(() => jest.restoreAllMocks());

	it('grants a right with every column it states, its event in the same transaction, and answers a replay with it', async () => {
		const { entitlement, created } = await harness.entitlements.grant(
			{ number: 'ENT-GRANTED', customerId: CONTACT, quantity: 2, metadata: { tier: 'gold' } } as any,
			SCOPE
		);

		expect(created).toBe(true);

		const stored = await harness.row('entitlement', entitlement.id as string);

		// The relation ids are columns of the row, not only members of the answer: under MikroORM each is a
		// `persist: false` mirror, and a write that named the mirror alone could leave the column empty.
		expect(stored).toMatchObject({
			tenantId: TENANT,
			organizationId: ORG,
			customerId: CONTACT,
			number: 'ENT-GRANTED',
			kind: EntitlementKind.LICENCE,
			quantity: 2,
			status: EntitlementStatus.ACTIVE,
			version: 1,
			activationCount: 0
		});
		expect(JSON.parse(stored.metadata)).toEqual({ tier: 'gold' });
		// The answer carries what the row holds, so the next write can state the version it read.
		expect(entitlement).toMatchObject({ id: stored.id, version: 1, tenantId: TENANT, customerId: CONTACT });

		expect(harness.appended).toEqual([
			{ name: EntitlementEventName.CREATED, aggregateId: entitlement.id, through: transactional }
		]);

		const replay = await harness.entitlements.grant({ number: 'ENT-GRANTED' } as any, SCOPE);

		expect(replay.created).toBe(false);
		expect(replay.entitlement.id).toBe(entitlement.id);
		expect(await harness.rows('entitlement')).toHaveLength(1);
	});

	it('puts a purchased right into force, and lapses one whose term ran out while the money settled', async () => {
		const current = await harness.entitlements.grant({ orderId: 'order-1', orderLineId: 'line-1' } as any, SCOPE);
		const lapsed = await harness.entitlements.grant(
			{
				orderId: 'order-1',
				orderLineId: 'line-2',
				startsAt: new Date('2020-01-01T00:00:00.000Z'),
				endsAt: new Date('2020-02-01T00:00:00.000Z')
			} as any,
			SCOPE
		);

		expect(current.entitlement.status).toBe(EntitlementStatus.PENDING);

		const activated = await harness.entitlements.activateGranted({ orderId: 'order-1' }, SCOPE);

		expect(activated).toEqual([current.entitlement.id]);
		expect(await harness.row('entitlement', current.entitlement.id as string)).toMatchObject({
			status: EntitlementStatus.ACTIVE,
			version: 2
		});
		expect(await harness.row('entitlement', lapsed.entitlement.id as string)).toMatchObject({
			status: EntitlementStatus.EXPIRED,
			version: 2
		});
		// The pending rights are read in no stated order, so the two transitions are compared as a set.
		expect((await eventNames(harness)).sort()).toEqual(
			[
				EntitlementEventName.CREATED,
				EntitlementEventName.CREATED,
				EntitlementEventName.EXPIRED,
				EntitlementEventName.ACTIVATED
			].sort()
		);
		expect(harness.appended.every((event) => event.through === transactional)).toBe(true);

		// Replayed settlement: nothing is pending, so nothing moves and nothing is announced.
		expect(await harness.entitlements.activateGranted({ orderId: 'order-1' }, SCOPE)).toEqual([]);
		expect(await harness.rows('outbox_row')).toHaveLength(4);
	});

	it('writes a transition only on a version the caller listed, and a refusal writes nothing', async () => {
		const { entitlement } = await harness.entitlements.grant({} as any, SCOPE);
		const id = entitlement.id as string;

		// ca770416e5: a list that does not name the version the right holds is refused before any statement.
		const stale = await harness.entitlements
			.suspend(id, 'DISPUTE', SCOPE, { wildcard: false, versions: [3, 4] })
			.catch((error) => error);

		expect(stale).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 3, actualVersion: 1 }
		});

		// A list that names nothing accepts nothing.
		const empty = await harness.entitlements
			.suspend(id, 'DISPUTE', SCOPE, { wildcard: false, versions: [] })
			.catch((error) => error);

		expect(empty).toMatchObject({ status: 428, code: ApiErrorCode.VERSION_REQUIRED });
		expect(await harness.row('entitlement', id)).toMatchObject({ status: EntitlementStatus.ACTIVE, version: 1 });
		expect(await eventNames(harness)).toEqual([EntitlementEventName.CREATED]);

		const suspended = await harness.entitlements.suspend(id, 'DISPUTE', SCOPE, { wildcard: false, versions: [1] });

		expect(suspended).toMatchObject({
			status: EntitlementStatus.SUSPENDED,
			suspendedReason: 'DISPUTE',
			version: 2
		});

		const resumed = await harness.entitlements.resume(id, SCOPE, { wildcard: false, versions: [2] });

		expect(resumed).toMatchObject({ status: EntitlementStatus.ACTIVE, version: 3 });
		expect((await harness.row('entitlement', id)).suspendedReason).toBeNull();
		expect(await eventNames(harness)).toEqual([EntitlementEventName.CREATED, EntitlementEventName.SUSPENDED]);
	});

	it('refuses a transition whose read went stale, through the statement’s own version predicate', async () => {
		const { entitlement } = await harness.entitlements.grant({} as any, SCOPE);
		const id = entitlement.id as string;

		await harness.entitlements.suspend(id, 'DISPUTE', SCOPE);

		// A resume reads the right before its transaction opens. Another writer moves the row on in between,
		// so the read says version 2 and the row holds 3: the UPDATE predicated on version 2 matches nothing.
		const read = harness.entitlements.findOneScoped.bind(harness.entitlements);

		jest.spyOn(harness.entitlements, 'findOneScoped').mockImplementationOnce(async (...args: [any, any]) => {
			const answered = await read(...args);

			await harness.poke('entitlement', id, { version: 3 });

			return answered;
		});

		const refusal = await harness.entitlements.resume(id, SCOPE).catch((error) => error);

		expect(refusal).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 2 }
		});
		expect(await harness.row('entitlement', id)).toMatchObject({ status: EntitlementStatus.SUSPENDED, version: 3 });
	});

	it('rolls a transition back with its event when the event cannot be written', async () => {
		const { entitlement } = await harness.entitlements.grant({} as any, SCOPE);
		const id = entitlement.id as string;

		harness.failNextAppend();

		await expect(harness.entitlements.suspend(id, 'DISPUTE', SCOPE)).rejects.toThrow(
			'the outbox could not be written'
		);

		// The status write ran before the append failed; the transaction took it back.
		expect(await harness.row('entitlement', id)).toMatchObject({ status: EntitlementStatus.ACTIVE, version: 1 });
		expect(await eventNames(harness)).toEqual([EntitlementEventName.CREATED]);
	});

	it('takes, refuses and gives back a seat under the row lock, and re-derives the counters', async () => {
		const { entitlement } = await harness.entitlements.grant({ quantity: 1 } as any, SCOPE);
		const id = entitlement.id as string;

		const first = await harness.activations.activate({ entitlementId: id, deviceId: 'device-a' } as any);

		expect(first.created).toBe(true);
		expect(first.remainingQuantity).toBe(0);

		const slot = await harness.row('entitlement_activation', first.activation.id as string);

		// The right the slot counts against, and the scope, are columns of the slot.
		expect(slot).toMatchObject({
			entitlementId: id,
			tenantId: TENANT,
			organizationId: ORG,
			createdByUserId: USER,
			status: EntitlementActivationStatus.ACTIVE
		});
		expect((await harness.row('entitlement', id)).activationCount).toBe(1);

		// The same device again is a refresh of the slot it holds, not a second slot.
		expect((await harness.activations.activate({ entitlementId: id, deviceId: 'device-a' } as any)).created).toBe(
			false
		);

		// Another device finds the last seat taken.
		await expect(harness.activations.activate({ entitlementId: id, deviceId: 'device-b' } as any)).rejects.toThrow(
			BadRequestException
		);

		const released = await harness.activations.release(first.activation.id as string, 'UNINSTALLED');

		expect(released.status).toBe(EntitlementActivationStatus.RELEASED);
		expect((await harness.row('entitlement', id)).activationCount).toBe(0);
		expect((await harness.activations.activate({ entitlementId: id, deviceId: 'device-b' } as any)).created).toBe(
			true
		);

		expect(await harness.check.check({ entitlementId: id })).toMatchObject({
			allowed: false,
			reason: EntitlementCheckReason.QUANTITY_EXHAUSTED
		});
		expect(await eventNames(harness)).toEqual([
			EntitlementEventName.CREATED,
			EntitlementEventName.ACTIVATED,
			EntitlementEventName.DEACTIVATED,
			EntitlementEventName.ACTIVATED
		]);
		expect(harness.appended.every((event) => event.through === transactional)).toBe(true);
	});

	it('lowers the ceiling by revoking the surplus seats, keeping the one taken last, and extends the term', async () => {
		const { entitlement } = await harness.entitlements.grant({ quantity: 3 } as any, SCOPE);
		const id = entitlement.id as string;
		const slots: string[] = [];

		for (const device of ['oldest', 'middle', 'newest']) {
			slots.push(
				(await harness.activations.activate({ entitlementId: id, deviceId: device } as any)).activation
					.id as string
			);
			await tick();
		}

		const reduced = await harness.entitlements.reduce(id, 1, 'PARTIAL_REFUND', SCOPE);

		// The seats are read newest first and the ceiling keeps that many of them, which is what the
		// package's own suite pins: the seat taken last survives, the older ones are revoked.
		expect(reduced).toMatchObject({ quantity: 1, activationCount: 1, version: 2 });
		expect((await harness.row('entitlement_activation', slots[2])).status).toBe(EntitlementActivationStatus.ACTIVE);

		for (const surplus of [slots[0], slots[1]]) {
			expect(await harness.row('entitlement_activation', surplus)).toMatchObject({
				status: EntitlementActivationStatus.REVOKED,
				revocationReason: 'PARTIAL_REFUND'
			});
		}

		const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		const extended = await harness.entitlements.extend(id, { endsAt }, SCOPE);

		expect(extended).toMatchObject({ status: EntitlementStatus.ACTIVE, version: 3 });
		expect(new Date(extended.endsAt).getTime()).toBe(endsAt.getTime());
		expect((await eventNames(harness)).slice(-2)).toEqual([
			EntitlementEventName.REDUCED,
			EntitlementEventName.RENEWED
		]);
	});

	it('revokes a right with its keys and live seats in one transaction, and a replay changes nothing', async () => {
		const { entitlement } = await harness.entitlements.grant({ quantity: 2 } as any, SCOPE);
		const id = entitlement.id as string;
		const { key, plaintext } = await harness.keys.issue({ entitlementId: id, storeKey: true } as any, SCOPE);

		// The key is stored as its digest, against the right, in the caller's scope.
		expect(await harness.row('entitlement_key', key.id as string)).toMatchObject({
			entitlementId: id,
			tenantId: TENANT,
			organizationId: ORG,
			status: EntitlementKeyStatus.ISSUED,
			keyPrefix: key.keyPrefix
		});
		expect(await harness.keys.reveal(key.id as string)).toBe(plaintext);

		const seat = await harness.activations.activate({
			entitlementId: id,
			deviceId: 'device-a',
			key: plaintext
		} as any);

		expect(await harness.row('entitlement_activation', seat.activation.id as string)).toMatchObject({
			entitlementKeyId: key.id
		});
		expect((await harness.row('entitlement_key', key.id as string)).status).toBe(EntitlementKeyStatus.ACTIVATED);
		expect(await harness.check.check({ key: plaintext })).toMatchObject({ allowed: true, entitlementId: id });

		const revoked = await harness.entitlements.revoke(id, 'REFUNDED', SCOPE);

		expect(revoked).toMatchObject({
			status: EntitlementStatus.REVOKED,
			revokedReason: 'REFUNDED',
			activationCount: 0
		});
		expect((await harness.row('entitlement', id)).revokedByUserId).toBe(USER);
		expect((await harness.row('entitlement_key', key.id as string)).status).toBe(EntitlementKeyStatus.REVOKED);
		expect((await harness.row('entitlement_activation', seat.activation.id as string)).status).toBe(
			EntitlementActivationStatus.REVOKED
		);
		expect(await harness.check.check({ key: plaintext })).toMatchObject({
			allowed: false,
			reason: EntitlementCheckReason.KEY_REVOKED
		});

		const events = (await eventNames(harness)).length;

		await harness.entitlements.revoke(id, 'REFUNDED', SCOPE);

		expect(await eventNames(harness)).toHaveLength(events);
	});

	it('reissues a key: the replacement is issued, the old key revoked and its seat released, the pair linked', async () => {
		const { entitlement } = await harness.entitlements.grant({ quantity: 2 } as any, SCOPE);
		const id = entitlement.id as string;
		const { key, plaintext } = await harness.keys.issue({ entitlementId: id } as any, SCOPE);
		const seat = await harness.activations.activate({
			entitlementId: id,
			deviceId: 'device-a',
			key: plaintext
		} as any);

		const reissued = await harness.keys.reissue(key.id as string, { reason: 'LOST' });

		expect(reissued.replacedKey).toMatchObject({ id: key.id, status: EntitlementKeyStatus.REVOKED });
		expect(JSON.parse((await harness.row('entitlement_key', key.id as string)).metadata)).toMatchObject({
			replacedByKeyId: reissued.key.id,
			replacedReason: 'LOST'
		});
		expect(JSON.parse((await harness.row('entitlement_key', reissued.key.id as string)).metadata)).toMatchObject({
			replacedKeyId: key.id
		});
		expect((await harness.row('entitlement_activation', seat.activation.id as string)).status).toBe(
			EntitlementActivationStatus.REVOKED
		);
		expect((await harness.row('entitlement', id)).activationCount).toBe(0);

		const assigned = await harness.keys.assign(reissued.key.id as string, {
			assignedToEmail: 'holder@example.com'
		});

		expect(assigned.assignedToEmail).toBe('holder@example.com');
	});

	it('expires every right past its term and grace, and never a perpetual one', async () => {
		const due = await harness.entitlements.grant(
			{ startsAt: new Date('2020-01-01T00:00:00.000Z'), endsAt: new Date('2020-02-01T00:00:00.000Z') } as any,
			SCOPE
		);
		const graced = await harness.entitlements.grant(
			{
				startsAt: new Date('2020-01-01T00:00:00.000Z'),
				endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
				gracePeriodDays: 30
			} as any,
			SCOPE
		);
		const perpetual = await harness.entitlements.grant({} as any, SCOPE);

		expect(await harness.entitlements.expireDue(100, SCOPE)).toEqual([due.entitlement.id]);
		expect((await harness.row('entitlement', due.entitlement.id as string)).status).toBe(EntitlementStatus.EXPIRED);

		for (const inForce of [graced, perpetual]) {
			expect((await harness.row('entitlement', inForce.entitlement.id as string)).status).toBe(
				EntitlementStatus.ACTIVE
			);
		}
	});

	it('reads a right with its seats and keys, and re-derives a counter that drifted', async () => {
		const { entitlement } = await harness.entitlements.grant({ quantity: 2, customerId: CONTACT } as any, SCOPE);
		const id = entitlement.id as string;

		await harness.activations.activate({ entitlementId: id, deviceId: 'device-a' } as any);
		await harness.keys.issue({ entitlementId: id } as any, SCOPE);

		const detailed = await harness.entitlements.findOneDetailed(id);

		// The relations the read asked for, loaded as TypeORM loads them: the collections as arrays, which is
		// what the GraphQL field resolvers answer from without a second read.
		expect(detailed.activations.map((activation) => activation.deviceId)).toEqual(['device-a']);
		expect(detailed.keys).toHaveLength(1);
		expect(detailed.customer?.id).toBe(CONTACT);

		// A read that asked for no relation answers none — not a reference with nothing but its key.
		const plain = await harness.entitlements.findOneScoped(id);

		expect(plain).toMatchObject({ id, tenantId: TENANT, organizationId: ORG, customerId: CONTACT });
		expect(plain.customer).toBeUndefined();
		expect((plain as any).tenant).toBeUndefined();

		await harness.poke('entitlement', id, { activationCount: 7 });

		expect(await harness.entitlements.recount(id)).toEqual({ entitlementId: id, activationCount: 1 });
		expect((await harness.row('entitlement', id)).activationCount).toBe(1);
	});

	it('never reaches a right of another tenant or another organization', async () => {
		const foreignTenant = await harness.entitlements.grant({} as any, {
			tenantId: OTHER_TENANT,
			organizationId: OTHER_ORG
		});
		const foreignOrganization = await harness.entitlements.grant({} as any, {
			tenantId: TENANT,
			organizationId: OTHER_ORG
		});

		for (const foreign of [foreignTenant, foreignOrganization]) {
			const id = foreign.entitlement.id as string;

			await expect(harness.entitlements.suspend(id, 'DISPUTE')).rejects.toThrow(NotFoundException);
			await expect(harness.entitlements.revoke(id, 'REFUNDED')).rejects.toThrow(NotFoundException);
			await expect(harness.entitlements.findOneDetailed(id)).rejects.toThrow(NotFoundException);
			await expect(
				harness.activations.activate({ entitlementId: id, deviceId: 'device-a' } as any)
			).rejects.toThrow(NotFoundException);
			await expect(harness.keys.issue({ entitlementId: id } as any)).rejects.toThrow(NotFoundException);
			expect(await harness.check.check({ entitlementId: id })).toMatchObject({
				allowed: false,
				reason: EntitlementCheckReason.NOT_FOUND
			});
			expect(await harness.row('entitlement', id)).toMatchObject({
				status: EntitlementStatus.ACTIVE,
				version: 1
			});
		}

		// The expiry pass is scoped too: a due right of another tenant is not the caller's to lapse.
		await harness.poke('entitlement', foreignTenant.entitlement.id as string, {
			endsAt: orm === 'typeorm' ? '2020-02-01 00:00:00.000' : new Date('2020-02-01T00:00:00.000Z').getTime()
		});

		expect(await harness.entitlements.expireDue(100, SCOPE)).toEqual([]);
		expect((await harness.row('entitlement', foreignTenant.entitlement.id as string)).status).toBe(
			EntitlementStatus.ACTIVE
		);
	});

	if (orm === 'mikro-orm') {
		it('takes the row lock on the dialects that have one, in the transaction the transition runs in', async () => {
			const { entitlement } = await harness.entitlements.grant({} as any, SCOPE);
			const reads = jest.spyOn(MikroOrmEntityManager.prototype, 'findOne');

			(gauzyConfig.isPostgres as jest.Mock).mockReturnValue(true);

			await harness.entitlements.suspend(entitlement.id as string, 'DISPUTE', SCOPE);

			// The package's own reads ask for no identity map; MikroORM answers each of them by calling itself again
			// on a fork that keeps the transaction, which is the second call a spy on the prototype sees.
			const locked = reads.mock.calls.filter(
				([, , options]: any[]) => options?.lockMode !== undefined && options?.disableIdentityMap === true
			);

			// One locking read of the right, by the same three predicates the TypeORM lock states.
			expect(locked).toHaveLength(1);
			expect(locked[0][2]).toMatchObject({ lockMode: LockMode.PESSIMISTIC_WRITE });
			expect(locked[0][1]).toMatchObject({
				id: entitlement.id,
				tenantId: TENANT,
				organizationId: ORG,
				deletedAt: null
			});
			expect((reads.mock.instances[reads.mock.calls.indexOf(locked[0])] as any).isInTransaction()).toBe(true);

			(gauzyConfig.isPostgres as jest.Mock).mockReturnValue(false);
			reads.mockClear();

			await harness.entitlements.resume(entitlement.id as string, SCOPE);

			// The embedded dialect serialises writers, so no lock is asked for there — as on TypeORM.
			expect(reads.mock.calls.some(([, , options]: any[]) => options?.lockMode !== undefined)).toBe(false);
		});
	}
});
