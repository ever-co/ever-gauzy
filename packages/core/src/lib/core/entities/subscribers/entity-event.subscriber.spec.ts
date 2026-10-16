import 'reflect-metadata';
import { Column, DataSource, Entity, EventSubscriber, PrimaryColumn, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import {
	Entity as MikroEntity,
	MikroORM,
	PrimaryKey as MikroPrimaryKey,
	Property as MikroProperty
} from '@mikro-orm/core';
import { MultiORMEnum } from '../../utils';
import { BaseEntityEventSubscriber } from './base-entity-event.subscriber';
import { MultiOrmEntityManager } from './entity-event-subscriber.types';

/**
 * `beforeUpdate` passes the properties a write changes to `beforeEntityUpdate` (#10680), so a hook can
 * tell a write that sets a value from one that only sends the stored value back. Each ORM reports them
 * differently, so both are run against a real better-sqlite database.
 */

const ID = 'work-1';
const STARTED = new Date('2018-03-20T00:00:00.000Z');
const ENDED = new Date('2024-06-30T00:00:00.000Z');

@Entity('typeorm_work_fixture')
class TypeOrmWorkFixture {
	@PrimaryColumn('varchar')
	id: string;

	@Column({ type: 'datetime', nullable: true })
	startedWorkOn?: Date;

	@Column({ type: 'datetime', nullable: true })
	endWork?: Date | null;

	@Column({ type: 'varchar', nullable: true })
	position?: string;
}

/**
 * The work dates as MikroORM maps the real `Employee` columns: `@MultiORMColumn({ nullable: true })` names no
 * type, so MikroORM takes the reflected `Date`. (A `'datetime'` string type reports every unchanged date as
 * changed on better-sqlite, which is a quirk of this test driver, not of the mapping under test.)
 */
@MikroEntity({ tableName: 'mikro_work_fixture' })
class MikroWorkFixture {
	@MikroPrimaryKey({ type: 'string' })
	id!: string;

	@MikroProperty({ type: Date, nullable: true })
	startedWorkOn?: Date;

	@MikroProperty({ type: Date, nullable: true })
	endWork?: Date | null;

	@MikroProperty({ type: 'string', nullable: true })
	position?: string;
}

/** What each `beforeEntityUpdate` call received as its changed properties. */
let reported: Array<string[] | undefined> = [];

abstract class RecordingSubscriber<Entity> extends BaseEntityEventSubscriber<Entity> {
	async beforeEntityUpdate(_entity: Entity, _em?: MultiOrmEntityManager, changedProperties?: string[]) {
		reported.push(changedProperties ? [...changedProperties].sort() : changedProperties);
	}
}

@EventSubscriber()
class TypeOrmRecordingSubscriber extends RecordingSubscriber<TypeOrmWorkFixture> {
	listenTo() {
		return TypeOrmWorkFixture;
	}
}

class MikroRecordingSubscriber extends RecordingSubscriber<MikroWorkFixture> {
	listenTo() {
		return MikroWorkFixture;
	}
}

describe('EntityEventSubscriber.beforeUpdate — changed properties', () => {
	const previousOrm = process.env.DB_ORM;

	beforeEach(() => {
		reported = [];
	});

	afterAll(() => {
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	describe('TypeORM', () => {
		let dataSource: DataSource;
		let rows: Repository<TypeOrmWorkFixture>;

		beforeAll(async () => {
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [TypeOrmWorkFixture],
				subscribers: [TypeOrmRecordingSubscriber],
				synchronize: true,
				logging: false
			});
			await dataSource.initialize();
			rows = dataSource.getRepository(TypeOrmWorkFixture);
		});

		afterAll(async () => {
			await dataSource?.destroy();
		});

		beforeEach(async () => {
			process.env.DB_ORM = MultiORMEnum.TypeORM;
			await rows.clear();
			await rows.insert({ id: ID, startedWorkOn: STARTED, endWork: ENDED, position: 'Developer' });
		});

		it('save() reports only the columns that differ from the stored row', async () => {
			// The Employment tab sends the stored start date back, as JSON, next to the field it edits.
			await rows.save(rows.create({ id: ID, startedWorkOn: STARTED.toISOString() as any, position: 'Lead' }));

			expect(reported).toEqual([['position']]);
		});

		it('save() reports a cleared column', async () => {
			await rows.save(rows.create({ id: ID, endWork: null }));

			expect(reported).toEqual([['endWork']]);
		});

		it('a query builder update() reports nothing, its entity holds only the values it sets', async () => {
			await rows.update({ id: ID }, { position: 'Lead' });

			expect(reported).toEqual([undefined]);
		});
	});

	describe('MikroORM', () => {
		let orm: MikroORM;

		beforeAll(async () => {
			orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [MikroWorkFixture],
				subscribers: [new MikroRecordingSubscriber()],
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});
			await orm.schema.createSchema();
		});

		afterAll(async () => {
			await orm?.close(true);
		});

		beforeEach(async () => {
			process.env.DB_ORM = MultiORMEnum.MikroORM;
			const em = orm.em.fork();
			await em.nativeDelete(MikroWorkFixture, {});
			await em.insert(MikroWorkFixture, {
				id: ID,
				startedWorkOn: STARTED,
				endWork: ENDED,
				position: 'Developer'
			});
		});

		/** The way `CrudService.create()` updates a row under MikroORM: load, assign the payload, flush. */
		async function assignAndFlush(payload: Partial<MikroWorkFixture>) {
			const em = orm.em.fork();
			const row = await em.findOneOrFail(MikroWorkFixture, { id: ID });
			em.assign(row, payload);
			await em.flush();
		}

		it('reports only the properties in the change set, although the entity is the whole stored row', async () => {
			// The Employment tab sends the stored start date back, as JSON, next to the field it edits.
			await assignAndFlush({ startedWorkOn: STARTED.toISOString() as any, position: 'Lead' });

			expect(reported).toEqual([['position']]);
		});

		it('reports a cleared property', async () => {
			await assignAndFlush({ endWork: null });

			expect(reported).toEqual([['endWork']]);
		});
	});
});
