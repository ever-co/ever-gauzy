import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../testing/mikro-orm-outside-request';
import { runInFreshMikroOrmContext, runInMikroOrmContext } from './mikro-orm-context';

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

/**
 * A unit of work that runs long after the context it was set up in — an event a subscription delivers, in the async
 * context the subscription was opened in — runs under DB_ORM=mikro-orm on a fresh fork of the context in force, not on
 * that context's own fork, whose identity map every earlier unit filled.
 */
describe('runInFreshMikroOrmContext', () => {
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

	it('under DB_ORM=mikro-orm, runs each unit on a fresh fork of the context in force', async () => {
		process.env.DB_ORM = 'mikro-orm';

		const { opener, units, after } = await MikroOrmRequestContext.create(mikroOrm.orm.em, async () => {
			const opener = await mikroOrm.write();
			const units = [
				await runInFreshMikroOrmContext(() => mikroOrm.write()),
				await runInFreshMikroOrmContext(() => mikroOrm.write())
			];
			return { opener, units, after: MikroOrmRequestContext.getEntityManager() };
		});

		expect(units[0]).not.toBe(opener);
		expect(units[1]).not.toBe(opener);
		expect(units[1]).not.toBe(units[0]);
		expect(units[0]).not.toBe(mikroOrm.orm.em);
		// Each unit starts with an empty identity map: it holds the one row the unit wrote, not the opener's
		for (const unit of units) {
			expect(unit.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
		}
		// The context in force is the opener's again once a unit is done, and its identity map holds only its own row
		expect(after).toBe(opener);
		expect(opener.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
	});

	it('answers what the work answers, and passes its failure on', async () => {
		process.env.DB_ORM = 'mikro-orm';

		await MikroOrmRequestContext.create(mikroOrm.orm.em, async () => {
			await expect(runInFreshMikroOrmContext(async () => 42)).resolves.toBe(42);
			await expect(
				runInFreshMikroOrmContext(async () => {
					throw new Error('the work failed');
				})
			).rejects.toThrow('the work failed');
		});
	});

	it('calls the work synchronously: a value or a failure reaches the caller as the work answered it', () => {
		process.env.DB_ORM = 'mikro-orm';

		MikroOrmRequestContext.create(mikroOrm.orm.em, () => {
			expect(runInFreshMikroOrmContext(() => 42)).toBe(42);
			expect(() =>
				runInFreshMikroOrmContext(() => {
					throw new Error('the work failed');
				})
			).toThrow('the work failed');
		});
	});

	it('runs the work as it is without a context in force, or under TypeORM', async () => {
		const create = jest.spyOn(MikroOrmRequestContext, 'create');
		const seen: unknown[] = [];
		const work = async () => {
			seen.push(MikroOrmRequestContext.getEntityManager());
			return 'done';
		};

		process.env.DB_ORM = 'mikro-orm';
		// Nothing to fork: the work meets MikroORM exactly as it would have
		expect(await runInFreshMikroOrmContext(work)).toBe('done');
		await expect(runInFreshMikroOrmContext(() => mikroOrm.write())).rejects.toThrow(/global EntityManager/);
		expect(create).not.toHaveBeenCalled();

		// Under TypeORM no context is looked for, even when one is in force
		process.env.DB_ORM = 'typeorm';
		const fork = mikroOrm.orm.em.fork();
		create.mockRestore();
		await MikroOrmRequestContext.create(fork, async () => {
			const nested = jest.spyOn(MikroOrmRequestContext, 'create');
			expect(await runInFreshMikroOrmContext(work)).toBe('done');
			expect(nested).not.toHaveBeenCalled();
		});

		expect(seen[0]).toBeUndefined();
		expect(seen[1]).toBeDefined();
		expect(seen[1]).not.toBe(mikroOrm.orm.em);
	});
});
