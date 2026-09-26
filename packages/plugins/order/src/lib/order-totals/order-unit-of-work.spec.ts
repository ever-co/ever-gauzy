/**
 * `@gauzy/core` is doubled at the module boundary: its barrel boots the whole application graph, and
 * the one question this file asks of it — which ORM the installation is configured for — is a switch a
 * test has to be able to throw. MikroORM itself is **not** doubled: the context a unit runs in is
 * MikroORM's own `RequestContext`, and whether a repository call inside the unit resolves to a fork is
 * exactly what that class answers.
 */
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	getORMType: jest.fn(() => 'typeorm')
}));

import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { getORMType } from '@gauzy/core';
import { OrderUnitOfWork, chunk, inOwnUnitOfWork } from './order-unit-of-work';

/**
 * A MikroORM connection reduced to the one thing a unit of work asks of it: a global entity manager
 * that can be forked. Each fork is a distinct object, so a test can tell one unit's context from
 * another's.
 */
function mikroOrmDouble() {
	let forks = 0;
	const em = {
		name: 'default',
		fork: jest.fn((options: unknown) => ({ name: 'default', fork: ++forks, options }))
	};

	return { orm: { em } as never, em };
}

/**
 * The persistence context of a request-less pass.
 *
 * The order package's two scheduled passes run in `apps/worker`, fired with no request, and under
 * `DB_ORM=mikro-orm` every repository the CRUD services hold is bound to MikroORM's global entity
 * manager — which refuses context-specific work outside a request context. Both passes therefore did
 * nothing at all on MikroORM: their first read threw. What this suite pins is that a unit handed to the
 * context runs inside a fork of its own under MikroORM, a different fork per unit, and as itself under
 * TypeORM, where there is no context to open.
 */
describe('OrderUnitOfWork — a persistence context per unit of a request-less pass', () => {
	afterEach(() => {
		(getORMType as jest.Mock).mockReturnValue('typeorm');
	});

	it('runs each unit inside a MikroORM fork of its own under MikroORM', async () => {
		(getORMType as jest.Mock).mockReturnValue('mikro-orm');

		const { orm, em } = mikroOrmDouble();
		const unitOfWork = new OrderUnitOfWork(orm);

		// The control: outside a unit there is no context, which is the position the scheduler leaves a
		// pass in and the one MikroORM refuses to work from.
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();

		const first = await unitOfWork.run(async () => MikroOrmRequestContext.getEntityManager());
		const second = await unitOfWork.run(async () => MikroOrmRequestContext.getEntityManager());

		expect(unitOfWork.usesMikroOrm).toBe(true);
		expect(first).toMatchObject({ fork: 1 });
		expect(second).toMatchObject({ fork: 2 });
		// A fork the repositories bound to the global manager resolve to — which is what `useContext`
		// states — rather than one a caller would have to thread through by hand.
		expect(em.fork).toHaveBeenCalledWith(expect.objectContaining({ useContext: true }));
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('gives the unit after a failed one a fresh context rather than the failed one’s', async () => {
		(getORMType as jest.Mock).mockReturnValue('mikro-orm');

		const { orm } = mikroOrmDouble();
		const unitOfWork = new OrderUnitOfWork(orm);
		let failedIn: unknown;

		await expect(
			unitOfWork.run(async () => {
				failedIn = MikroOrmRequestContext.getEntityManager();

				throw new Error('ORDER_NOT_FOUND');
			})
		).rejects.toThrow('ORDER_NOT_FOUND');

		const next = await unitOfWork.run(async () => MikroOrmRequestContext.getEntityManager());

		expect(next).toBeDefined();
		expect(next).not.toBe(failedIn);
	});

	it('runs the unit as itself under TypeORM, opening no MikroORM context', async () => {
		const { orm, em } = mikroOrmDouble();
		const unitOfWork = new OrderUnitOfWork(orm);

		const context = await unitOfWork.run(async () => MikroOrmRequestContext.getEntityManager());

		expect(unitOfWork.usesMikroOrm).toBe(false);
		expect(context).toBeUndefined();
		expect(em.fork).not.toHaveBeenCalled();
	});

	it('answers TypeORM when MikroORM is configured but no connection was injected', async () => {
		(getORMType as jest.Mock).mockReturnValue('mikro-orm');

		const unitOfWork = new OrderUnitOfWork(undefined);

		expect(unitOfWork.usesMikroOrm).toBe(false);
		await expect(unitOfWork.run(async () => 'ran')).resolves.toBe('ran');
	});

	it('runs a unit as itself when the service was built without a context', async () => {
		await expect(inOwnUnitOfWork(undefined, async () => 'ran')).resolves.toBe('ran');
	});
});

/**
 * The slices an id set is read in.
 *
 * Every member of an `IN (...)` list is a bound parameter, and Postgres refuses a statement with more
 * than 65,535 of them — so a set whose size depends on how busy the installation was is read in slices.
 */
describe('chunk — the slices an id set is read in', () => {
	it('splits a list into consecutive slices of at most the stated size, in order', () => {
		expect(chunk(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
		expect(chunk(['a', 'b'], 5)).toEqual([['a', 'b']]);
		expect(chunk([], 3)).toEqual([]);
	});

	it('reads a size below one as one rather than looping for ever', () => {
		expect(chunk(['a', 'b'], 0)).toEqual([['a'], ['b']]);
	});
});
