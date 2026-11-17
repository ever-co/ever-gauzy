/**
 * The context an Inbox email is sent in: a request context of the recipient's tenant, and, under DB_ORM=mikro-orm, a
 * MikroORM request context of its own, on a fresh fork each time. The send reads the tenant's mail settings through
 * MikroORM there, which refuses its global EntityManager outside a request context: a sweep is never one, so every
 * email failed and was given up.
 *
 * `@gauzy/core` boots the whole application graph from its barrel: its request context is doubled by an
 * AsyncLocalStorage, as nestjs-cls keeps it, and its context opener by MikroORM's own request context, as the
 * platform's opens it.
 */
jest.mock('@gauzy/core', () => {
	const { AsyncLocalStorage } = jest.requireActual('node:async_hooks');
	const store = new AsyncLocalStorage();
	return {
		RequestContext: {
			runWithRequest: (request: { user: unknown }, fn: () => unknown) => store.run(request, fn),
			currentTenantId: () =>
				(store.getStore() as { user?: { tenantId?: string } } | undefined)?.user?.tenantId ?? null,
			setClsService: () => undefined
		},
		runInMikroOrmContext: (orm: { em: unknown } | null | undefined, work: () => Promise<unknown>) =>
			orm && process.env['DB_ORM'] === 'mikro-orm'
				? jest.requireActual('@mikro-orm/core').RequestContext.create(orm.em, work)
				: work()
	};
});

import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { deliveryUserOf, runInDeliveryContext } from './inbox-delivery-context';

describe('runInDeliveryContext', () => {
	const originalOrm = process.env['DB_ORM'];
	const user = deliveryUserOf({ tenantId: 'ten' as ID, organizationId: 'org' as ID }, 'u1' as ID);

	afterEach(() => {
		if (originalOrm === undefined) delete process.env['DB_ORM'];
		else process.env['DB_ORM'] = originalOrm;
	});

	/** What a send meets under DB_ORM=mikro-orm: refused outside a MikroORM request context. */
	const send = async () => {
		const em = MikroOrmRequestContext.getEntityManager();
		if (!em)
			throw new Error('Using global EntityManager instance methods for context specific actions is disallowed.');
		return { em, tenantId: RequestContext.currentTenantId() };
	};

	it("under DB_ORM=mikro-orm, sends in the recipient's tenant and in a MikroORM request context of its own", async () => {
		process.env['DB_ORM'] = 'mikro-orm';
		let forks = 0;
		const orm = { em: { name: 'default', fork: jest.fn(() => ({ name: 'default', fork: ++forks })) } };

		const first = await runInDeliveryContext(user, send, orm as never);
		const second = await runInDeliveryContext(user, send, orm as never);

		expect(first).toEqual({ em: { name: 'default', fork: 1 }, tenantId: 'ten' });
		expect(second).toEqual({ em: { name: 'default', fork: 2 }, tenantId: 'ten' });
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('opens none under TypeORM, nor without the ORM at hand', async () => {
		const orm = { em: { name: 'default', fork: jest.fn() } };
		const seen = async () => ({
			em: MikroOrmRequestContext.getEntityManager(),
			tenantId: RequestContext.currentTenantId()
		});

		process.env['DB_ORM'] = 'typeorm';
		expect(await runInDeliveryContext(user, seen, orm as never)).toEqual({ em: undefined, tenantId: 'ten' });
		process.env['DB_ORM'] = 'mikro-orm';
		expect(await runInDeliveryContext(user, seen)).toEqual({ em: undefined, tenantId: 'ten' });
		expect(orm.em.fork).not.toHaveBeenCalled();
	});
});
