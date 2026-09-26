import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { readMikroOrmScopeColumn, resolveMikroOrmScopeColumn } from './mikro-orm-scope-column.helper';

/**
 * How `resolveMikroOrmScopeColumn` reads the three ways an entity can carry a scope column under MikroORM,
 * from the metadata MikroORM itself builds (discovery only; nothing is connected).
 *
 * - The platform's mapping: a `tenant` relation owning the `tenantId` column, and a `persist: false`
 *   `tenantId` mirror beside it (what `MultiORMColumn({ relationId: true })` produces).
 * - A plain persisted `tenantId` column with no relation.
 * - A `persist: false` property that mirrors no relation, which names no column, and a relation with no
 *   scalar property at all — both of which a statement cannot be scoped by.
 */

class ScopeTenant {
	id!: string;
}

class MirroredRow {
	id!: string;
	tenant?: ScopeTenant;
	tenantId?: string;
}

class PersistedRow {
	id!: string;
	tenantId?: string;
}

class UnmappedRow {
	id!: string;
	tenant?: ScopeTenant;
	employeeId?: string;
}

const schemas = [
	new EntitySchema<ScopeTenant>({ class: ScopeTenant, properties: { id: { type: 'string', primary: true } } }),
	new EntitySchema<MirroredRow>({
		class: MirroredRow,
		properties: {
			id: { type: 'string', primary: true },
			tenant: { kind: 'm:1', entity: () => ScopeTenant, nullable: true, joinColumn: 'tenantId' },
			tenantId: { type: 'string', nullable: true, persist: false }
		}
	}),
	new EntitySchema<PersistedRow>({
		class: PersistedRow,
		properties: {
			id: { type: 'string', primary: true },
			tenantId: { type: 'string', nullable: true }
		}
	}),
	new EntitySchema<UnmappedRow>({
		class: UnmappedRow,
		properties: {
			id: { type: 'string', primary: true },
			tenant: { kind: 'm:1', entity: () => ScopeTenant, nullable: true, joinColumn: 'tenantId' },
			employeeId: { type: 'string', nullable: true, persist: false }
		}
	})
];

describe('resolveMikroOrmScopeColumn', () => {
	let orm: MikroORM;

	beforeAll(async () => {
		orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			connect: false,
			entities: schemas,
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	const metaOf = (entity: new () => object) => orm.getMetadata().get(entity.name);

	it('reads the platform’s mirror as the column, hydrated through the relation that owns it', () => {
		expect(resolveMikroOrmScopeColumn(metaOf(MirroredRow), 'tenantId')).toEqual({
			property: 'tenantId',
			relation: 'tenant',
			hydratedBy: 'tenant'
		});
	});

	it('reads a persisted column as itself', () => {
		expect(resolveMikroOrmScopeColumn(metaOf(PersistedRow), 'tenantId')).toEqual({
			property: 'tenantId',
			relation: undefined,
			hydratedBy: 'tenantId'
		});
	});

	it('finds no column behind a mirror of nothing, a relation without a scalar, or an absent property', () => {
		expect(resolveMikroOrmScopeColumn(metaOf(UnmappedRow), 'employeeId')).toBeNull();
		expect(resolveMikroOrmScopeColumn(metaOf(UnmappedRow), 'tenantId')).toBeNull();
		expect(resolveMikroOrmScopeColumn(metaOf(PersistedRow), 'employeeId')).toBeNull();
		expect(resolveMikroOrmScopeColumn(undefined, 'tenantId')).toBeNull();
	});
});

describe('readMikroOrmScopeColumn', () => {
	const mirror = { property: 'tenantId', relation: 'tenant', hydratedBy: 'tenant' };

	it('reads the mirror when the load set it, and the relation’s key when it did not', () => {
		expect(readMikroOrmScopeColumn({ tenantId: 'a', tenant: { id: 'a' } }, mirror)).toBe('a');
		expect(readMikroOrmScopeColumn({ tenant: { id: 'b' } }, mirror)).toBe('b');
	});

	it('answers nothing for no entity, and for an entity whose tenant is empty', () => {
		expect(readMikroOrmScopeColumn(null, mirror)).toBeUndefined();
		expect(readMikroOrmScopeColumn({ tenant: null }, mirror)).toBeUndefined();
	});
});
