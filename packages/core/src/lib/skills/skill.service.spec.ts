// Only the service's queries are under test. The real `Skill` entity pulls the whole core entity graph in
// (Employee, Organization) and its circular import with the custom validators; the fixtures below map the
// columns `findOneByName` reads instead.
jest.mock('./skill.entity', () => ({ Skill: class Skill {} }));

import 'reflect-metadata';
import { Column, DataSource, Entity, PrimaryColumn } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import {
	Entity as MikroEntity,
	MikroORM,
	PrimaryKey as MikroPrimaryKey,
	Property as MikroProperty
} from '@mikro-orm/core';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { SkillService } from './skill.service';

/**
 * #10682: `GET /skills/getByName/:name` filtered on the name only, so the skills picker could pick up
 * another tenant's skill, and saving an employee or organization with it then failed with 403. The
 * lookup now matches only the caller's tenant. Same skill name in two tenants, on both ORMs.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

@Entity('skill')
class TypeOrmSkillFixture {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar')
	name: string;

	@Column('varchar', { nullable: true })
	tenantId: string;
}

@MikroEntity({ tableName: 'skill' })
class MikroSkillFixture {
	@MikroPrimaryKey({ type: 'string' })
	id!: string;

	@MikroProperty({ type: 'string' })
	name!: string;

	@MikroProperty({ type: 'string', nullable: true })
	tenantId?: string;
}

const ROWS = [
	{ id: 'skill-a', name: 'Angular', tenantId: TENANT_A },
	{ id: 'skill-b', name: 'Angular', tenantId: TENANT_B },
	{ id: 'skill-b-only', name: 'NestJS', tenantId: TENANT_B }
];

/** The lookup each test makes, as a user of `tenantId`. */
function findAs(service: SkillService, tenantId: string, name: string) {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
	return service.findOneByName(name);
}

describe('SkillService.findOneByName — tenant scope', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('TypeORM', () => {
		let dataSource: DataSource;
		let service: SkillService;

		beforeAll(async () => {
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [TypeOrmSkillFixture],
				synchronize: true,
				logging: false
			});
			await dataSource.initialize();
			await dataSource.getRepository(TypeOrmSkillFixture).insert(ROWS);
		});

		afterAll(async () => {
			await dataSource?.destroy();
		});

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			service = new SkillService(dataSource.getRepository(TypeOrmSkillFixture) as any, {} as any);
		});

		it('answers each tenant its own skill of a shared name', async () => {
			await expect(findAs(service, TENANT_A, 'Angular')).resolves.toMatchObject({ id: 'skill-a' });
			await expect(findAs(service, TENANT_B, 'Angular')).resolves.toMatchObject({ id: 'skill-b' });
		});

		it('answers null when only another tenant has the skill', async () => {
			await expect(findAs(service, TENANT_A, 'NestJS')).resolves.toBeNull();
		});
	});

	describe('MikroORM', () => {
		let orm: MikroORM;
		let service: SkillService;

		beforeAll(async () => {
			orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [MikroSkillFixture],
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});
			await orm.schema.createSchema();
			await orm.em.fork().insertMany(MikroSkillFixture, ROWS);
		});

		afterAll(async () => {
			await orm?.close(true);
		});

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			service = new SkillService({} as any, orm.em.fork().getRepository(MikroSkillFixture) as any);
		});

		it('answers each tenant its own skill of a shared name', async () => {
			await expect(findAs(service, TENANT_A, 'Angular')).resolves.toMatchObject({ id: 'skill-a' });
			await expect(findAs(service, TENANT_B, 'Angular')).resolves.toMatchObject({ id: 'skill-b' });
		});

		it('answers null when only another tenant has the skill', async () => {
			await expect(findAs(service, TENANT_A, 'NestJS')).resolves.toBeNull();
		});
	});
});
