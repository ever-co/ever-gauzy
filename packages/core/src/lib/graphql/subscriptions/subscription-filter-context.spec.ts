import { EntityManager, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { ApolloDriver } from '@nestjs/apollo';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../../core/testing/mikro-orm-outside-request';
import { MikroOrmAwareApolloDriver, forkMikroOrmContextPerFilter } from './subscription-filter-context';

/**
 * The Apollo driver evaluates a `@Subscription` filter for every event it reads, and drops a rejected one to await the
 * next inside the same read. Under DB_ORM=mikro-orm each evaluation runs on a fresh fork of the context in force, so a
 * filter that reads through a repository decides each event on the row as it is then; under TypeORM the filter is
 * Apollo's own, untouched. The MikroORM instance is a real one, over SQLite, that refuses as the API's does.
 */
describe('forkMikroOrmContextPerFilter', () => {
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
	});

	it('under DB_ORM=mikro-orm, evaluates each call on a fresh fork of the context in force', async () => {
		process.env.DB_ORM = 'mikro-orm';
		const seen: EntityManager[] = [];
		const filter = forkMikroOrmContextPerFilter<(payload: unknown) => Promise<boolean>>(async () => {
			seen.push(await mikroOrm.write());
			return true;
		});

		const pull = await MikroOrmRequestContext.create(mikroOrm.orm.em, async () => {
			await filter({ id: 'w1' });
			await filter({ id: 'w2' });
			return MikroOrmRequestContext.getEntityManager();
		});

		expect(seen).toHaveLength(2);
		expect(seen[0]).not.toBe(seen[1]);
		expect(seen).not.toContain(pull);
		expect(seen).not.toContain(mikroOrm.orm.em);
		for (const fork of seen) {
			expect(fork.getUnitOfWork().getIdentityMap().keys()).toHaveLength(1);
		}
	});

	it('answers and fails exactly as the filter does, with the receiver and arguments it is given', () => {
		process.env.DB_ORM = 'mikro-orm';
		const resolver = { tenantId: 'tenant-a' };
		const filter = forkMikroOrmContextPerFilter(function (
			this: typeof resolver,
			payload: unknown,
			variables: unknown
		): boolean {
			if (payload === 'throw') {
				throw new Error('the filter failed');
			}
			return this.tenantId === 'tenant-a' && (variables as { pass: boolean }).pass;
		});

		MikroOrmRequestContext.create(mikroOrm.orm.em, () => {
			// A synchronous answer stays synchronous, and a synchronous failure is thrown, not turned into a rejection.
			expect(filter.call(resolver, 'event', { pass: true }, {})).toBe(true);
			expect(filter.call(resolver, 'event', { pass: false }, {})).toBe(false);
			expect(() => filter.call(resolver, 'throw', { pass: true }, {})).toThrow('the filter failed');
		});
	});

	it('hands the filter back as it is under TypeORM', () => {
		const filter = () => true;

		process.env.DB_ORM = 'typeorm';
		expect(forkMikroOrmContextPerFilter(filter)).toBe(filter);
		delete process.env.DB_ORM;
		expect(forkMikroOrmContextPerFilter(filter)).toBe(filter);
	});

	it('is what the platform driver hands Apollo’s filter wrapper', () => {
		process.env.DB_ORM = 'typeorm';
		const base = jest.spyOn(ApolloDriver.prototype, 'subscriptionWithFilter');
		const filter = () => true;
		const create = () => () => undefined;

		MikroOrmAwareApolloDriver.prototype.subscriptionWithFilter.call(undefined, 'resolver', filter, create);
		expect(base).toHaveBeenLastCalledWith('resolver', filter, create);

		process.env.DB_ORM = 'mikro-orm';
		MikroOrmAwareApolloDriver.prototype.subscriptionWithFilter.call(undefined, 'resolver', filter, create);
		const [, wrapped] = base.mock.calls[base.mock.calls.length - 1];
		expect(wrapped).not.toBe(filter);
		expect(wrapped({}, {}, {})).toBe(true);

		base.mockRestore();
	});
});
