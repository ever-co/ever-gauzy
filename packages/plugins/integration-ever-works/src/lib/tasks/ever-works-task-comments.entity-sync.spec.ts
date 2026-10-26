/**
 * OQ4 / review F77: a mapping whose COMMENT sync setting is off (`integration_entity_setting` `sync: false`) keeps
 * syncing its tasks but not their comments: an Ever Works comment event is skipped, a Gauzy comment change is not
 * pushed, and the comment sweep leaves the mapping alone. With the setting on (or missing), comments go on as before.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'User',
				'IntegrationTenant',
				'IntegrationSetting',
				'IntegrationEntitySetting',
				'Comment',
				'Task',
				'TaskService',
				'TaskCreateCommand',
				'TaskUpdateCommand'
			].map((name) => [name, entity(name)])
		),
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: () => null,
			currentOrganizationId: () => null,
			runWithRequest: (_req: unknown, work: () => unknown) => work()
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { IntegrationEntity } from '@gauzy/contracts';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksTaskCommentsService } from './ever-works-task-comments.service';

function setup(entitySync: Partial<Record<IntegrationEntity, boolean>>) {
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		mapping: { id: 'm1', settings: [] },
		connection: { id: 'c1' },
		directions: { tasks: 'both' },
		entitySync,
		isEnabled: true
	};
	const links = {
		byEw: jest.fn(async () => null),
		byGauzy: jest.fn(async () => null),
		list: jest.fn(async () => [])
	};
	const store = { loadComment: jest.fn(async () => null), organizationOfTask: jest.fn(async () => 'o1') };
	const contexts = { forOrganization: jest.fn(async () => context), forConnection: jest.fn(async () => [context]) };
	const service = new EverWorksTaskCommentsService(
		contexts as never,
		{} as never,
		links as never,
		{} as never,
		store as never,
		{ write: jest.fn() } as never
	);
	return { service, links, store, context };
}

const commentEvent = {
	id: 'evt-1',
	seq: '1',
	type: 'task.comment.created',
	version: 1,
	occurredAt: new Date().toISOString(),
	tenantId: 'ewt',
	organizationId: 'ew-org-1',
	aggregate: { type: 'task', id: 'ew-task-1', version: 3 },
	actor: { type: 'user', id: 'ew-ann' },
	data: { id: 'ew-comment-1', body: 'Looks good' }
};
const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
const change = {
	id: 'ch',
	tenantId: 't1',
	organizationId: 'o1',
	entityType: EverWorksLinkType.COMMENT,
	gauzyId: 'comment-1',
	op: 'upsert',
	actorUserId: null
} as never;

describe('comments follow the COMMENT sync setting (OQ4, review F77)', () => {
	it('an Ever Works comment event is skipped while the setting is off, before anything is read', async () => {
		const { service, links, context } = setup({ [IntegrationEntity.COMMENT]: false });
		expect(await service.apply(context as never, commentEvent as never)).toMatchObject({
			status: 'skipped',
			message: expect.stringMatching(/comments are not synced/)
		});
		expect(links.byEw).not.toHaveBeenCalled();
	});

	it('with the setting on (or missing), the same event is handled as before (here: its task is not linked)', async () => {
		for (const entitySync of [{ [IntegrationEntity.COMMENT]: true }, {}]) {
			const { service, links, context } = setup(entitySync);
			expect(await service.apply(context as never, commentEvent as never)).toMatchObject({
				status: 'skipped',
				message: 'the task is not synced'
			});
			expect(links.byEw).toHaveBeenCalled();
		}
	});

	it('a Gauzy comment change is not pushed while the setting is off', async () => {
		const off = setup({ [IntegrationEntity.COMMENT]: false });
		expect(await off.service.push(change, pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringMatching(/comments are not synced/)
		});
		expect(off.store.loadComment).not.toHaveBeenCalled();
		expect(off.links.byGauzy).not.toHaveBeenCalled();

		const on = setup({});
		await on.service.push(change, pushContext).catch(() => undefined);
		expect(on.links.byGauzy).toHaveBeenCalled();
	});

	it('the comment sweep skips a mapping whose setting is off', async () => {
		const off = setup({ [IntegrationEntity.COMMENT]: false });
		await off.service.sweep({ id: 'c1' } as never);
		expect(off.links.list).not.toHaveBeenCalled();

		const on = setup({});
		await on.service.sweep({ id: 'c1' } as never);
		expect(on.links.list).toHaveBeenCalledWith('m1', EverWorksLinkType.COMMENT);
	});
});
