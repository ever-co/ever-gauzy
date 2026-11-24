import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { RequestContext } from '../../core/context/request-context';
import { IMikroOrmOutsideRequest, mikroOrmOutsideRequest } from '../../core/testing/mikro-orm-outside-request';
import { runInTimerReminderContext } from './timer-reminder-context';

/**
 * A timer or task due reminder is filed outside any request: in the record's own tenant, and, under DB_ORM=mikro-orm,
 * in a MikroORM request context of its own, on a fresh fork each time (MikroORM refuses a write on its global
 * EntityManager outside one). The MikroORM instance is a real one, over SQLite, that refuses as the API's does.
 */
describe('runInTimerReminderContext', () => {
	const originalClsService = RequestContext['clsService'];
	const originalOrm = process.env.DB_ORM;
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
	let mikroOrm: IMikroOrmOutsideRequest;

	beforeAll(async () => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		mikroOrm = await mikroOrmOutsideRequest();
	});
	afterAll(async () => {
		RequestContext.setClsService(originalClsService);
		await mikroOrm.close();
	});
	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

	it("files in the record's tenant and organization, as nobody", async () => {
		const seen = await runInTimerReminderContext(
			scope,
			async () => ({
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId(),
				userId: RequestContext.currentUserId() ?? null
			}),
			'Task due reminder'
		);

		expect(seen).toEqual({ tenantId: 'tenant-1', organizationId: 'org-1', userId: null });
	});

	it('under DB_ORM=mikro-orm, writes through MikroORM in a request context of its own, a fresh one each time', async () => {
		process.env.DB_ORM = 'mikro-orm';
		// What a reminder filed outside any request met: MikroORM refuses its global EntityManager
		await expect(mikroOrm.write()).rejects.toThrow(/global EntityManager/);
		const before = await mikroOrm.rows();

		const first = await runInTimerReminderContext(scope, () => mikroOrm.write(), undefined, mikroOrm.orm);
		const second = await runInTimerReminderContext(scope, () => mikroOrm.write(), undefined, mikroOrm.orm);

		expect(await mikroOrm.rows()).toBe(before + 2);
		expect(first).not.toBe(mikroOrm.orm.em);
		expect(second).not.toBe(mikroOrm.orm.em);
		expect(second).not.toBe(first);
	});

	it("under DB_ORM=mikro-orm, still files in the record's tenant inside the MikroORM context", async () => {
		process.env.DB_ORM = 'mikro-orm';

		const tenantId = await runInTimerReminderContext(
			scope,
			async () => {
				await mikroOrm.write();
				return RequestContext.currentTenantId();
			},
			undefined,
			mikroOrm.orm
		);

		expect(tenantId).toBe('tenant-1');
	});

	it('opens none under TypeORM, nor without the ORM at hand', async () => {
		const create = jest.spyOn(MikroOrmRequestContext, 'create');

		process.env.DB_ORM = 'typeorm';
		await runInTimerReminderContext(scope, async () => undefined, undefined, mikroOrm.orm);
		delete process.env.DB_ORM;
		await runInTimerReminderContext(scope, async () => undefined, undefined, mikroOrm.orm);
		process.env.DB_ORM = 'mikro-orm';
		await runInTimerReminderContext(scope, async () => undefined, undefined, null);

		expect(create).not.toHaveBeenCalled();
	});
});
