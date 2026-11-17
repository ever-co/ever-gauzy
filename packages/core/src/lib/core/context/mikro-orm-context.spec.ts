import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../testing/mikro-orm-outside-request';
import { runInMikroOrmContext } from './mikro-orm-context';

/**
 * A background job runs outside any request: under DB_ORM=mikro-orm its work runs in a MikroORM request context of its
 * own, on a fresh fork each time (MikroORM refuses its global EntityManager outside one), and under TypeORM as it is.
 * The MikroORM instance is a real one, over SQLite, that refuses as the API's does.
 */
describe('runInMikroOrmContext', () => {
	const originalOrm = process.env.DB_ORM;
	let mikroOrm: IMikroOrmOutsideRequest;

	beforeAll(async () => {
		mikroOrm = await mikroOrmOutsideRequest();
	});
	afterAll(async () => {
		await mikroOrm.close();
	});
	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

	it('under DB_ORM=mikro-orm, writes through MikroORM in a context of its own, a fresh one each time', async () => {
		process.env.DB_ORM = 'mikro-orm';
		// What a job met outside any request: MikroORM refuses its global EntityManager
		await expect(mikroOrm.write()).rejects.toThrow(/global EntityManager/);
		const before = await mikroOrm.rows();

		const first = await runInMikroOrmContext(mikroOrm.orm, () => mikroOrm.write());
		const second = await runInMikroOrmContext(mikroOrm.orm, () => mikroOrm.write());

		expect(await mikroOrm.rows()).toBe(before + 2);
		expect(first).not.toBe(mikroOrm.orm.em);
		expect(second).not.toBe(mikroOrm.orm.em);
		expect(second).not.toBe(first);
		// Nothing of the context outlives the work
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('answers what the work answers, and passes its failure on', async () => {
		process.env.DB_ORM = 'mikro-orm';

		await expect(runInMikroOrmContext(mikroOrm.orm, async () => 42)).resolves.toBe(42);
		await expect(
			runInMikroOrmContext(mikroOrm.orm, async () => {
				throw new Error('the work failed');
			})
		).rejects.toThrow('the work failed');
	});

	it('opens none under TypeORM, nor without the ORM at hand', async () => {
		const create = jest.spyOn(MikroOrmRequestContext, 'create');
		const seen: unknown[] = [];
		const work = async () => {
			seen.push(MikroOrmRequestContext.getEntityManager());
			return 'done';
		};

		process.env.DB_ORM = 'typeorm';
		expect(await runInMikroOrmContext(mikroOrm.orm, work)).toBe('done');
		delete process.env.DB_ORM;
		expect(await runInMikroOrmContext(mikroOrm.orm, work)).toBe('done');
		process.env.DB_ORM = 'mikro-orm';
		expect(await runInMikroOrmContext(null, work)).toBe('done');
		expect(await runInMikroOrmContext(undefined, work)).toBe('done');

		expect(create).not.toHaveBeenCalled();
		expect(seen).toEqual([undefined, undefined, undefined, undefined]);
	});
});
