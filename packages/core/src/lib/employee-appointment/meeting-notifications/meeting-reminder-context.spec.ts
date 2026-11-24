import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { RequestContext } from '../../core/context/request-context';
import { runInMeetingReminderContext } from './meeting-reminder-context';

/**
 * A meeting reminder is filed outside any request: in the meeting's own tenant, and, under DB_ORM=mikro-orm, in a
 * MikroORM request context of its own (MikroORM refuses a write on its global EntityManager outside one).
 */
describe('runInMeetingReminderContext', () => {
	const originalClsService = RequestContext['clsService'];
	const originalOrm = process.env.DB_ORM;
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
	const orm = { em: { name: 'global entity manager' } };

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => RequestContext.setClsService(originalClsService));
	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

	it("files in the meeting's tenant and organization, as nobody", async () => {
		const seen = await runInMeetingReminderContext(scope, async () => ({
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId(),
			userId: RequestContext.currentUserId() ?? null
		}));

		expect(seen).toEqual({ tenantId: 'tenant-1', organizationId: 'org-1', userId: null });
	});

	it('opens a MikroORM request context on the global EntityManager under DB_ORM=mikro-orm', async () => {
		process.env.DB_ORM = 'mikro-orm';
		const create = jest
			.spyOn(MikroOrmRequestContext, 'create')
			.mockImplementation((_em: unknown, next: () => unknown) => next() as never);

		const answer = await runInMeetingReminderContext(scope, async () => RequestContext.currentTenantId(), orm as never);

		expect(create).toHaveBeenCalledWith(orm.em, expect.any(Function));
		expect(answer).toBe('tenant-1');
	});

	it('opens none under TypeORM, nor without the ORM at hand', async () => {
		const create = jest.spyOn(MikroOrmRequestContext, 'create');

		process.env.DB_ORM = 'typeorm';
		await runInMeetingReminderContext(scope, async () => undefined, orm as never);
		process.env.DB_ORM = 'mikro-orm';
		await runInMeetingReminderContext(scope, async () => undefined, null);

		expect(create).not.toHaveBeenCalled();
	});
});
