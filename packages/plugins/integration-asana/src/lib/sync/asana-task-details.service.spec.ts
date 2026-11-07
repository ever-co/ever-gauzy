import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { AsanaApiClient, AsanaApiError, AsanaAttachment, AsanaStory, AsanaTask } from '../client/asana-api.client';
import { AsanaDetailsContext, AsanaTaskDetailsService } from './asana-task-details.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const task = { gid: 't-1' } as AsanaTask;

function story(overrides: Partial<AsanaStory> = {}): AsanaStory {
	return { gid: 's-1', resource_subtype: 'comment_added', text: 'Looks good', created_at: '2026-11-07T10:00:00.000Z', created_by: { gid: 'u-1', name: 'Ada', email: 'ada@example.com' }, ...overrides };
}

function attachment(overrides: Partial<AsanaAttachment> = {}): AsanaAttachment {
	return { gid: 'a-1', name: 'spec.pdf', download_url: 'https://d/spec.pdf', permalink_url: 'https://app.asana.com/a/1', view_url: null, host: 'asana', created_at: '2026-11-07T10:00:00.000Z', ...overrides };
}

/** A repository double that remembers what was saved and answers the finds the service makes. */
function repository() {
	const rows: Array<Record<string, unknown>> = [];
	const findOne = jest.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null);
	const update = jest.fn(async () => undefined);
	const create = jest.fn((input: Record<string, unknown>) => ({ ...input }));
	let next = 1;
	const save = jest.fn(async (input: Record<string, unknown>) => {
		const row = { ...input, id: `${String(input['entity']).toLowerCase()}-row-${next++}` };
		rows.push(row);
		return row;
	});
	return { rows, findOne, update, create, save };
}

function details(options: { stories?: AsanaStory[]; attachments?: AsanaAttachment[]; employees?: Array<{ id: string; userId: string | null; email: string }>; maps?: Array<{ entity: string; sourceId: string; gauzyId: string }> } = {}) {
	const comments = repository();
	const links = repository();
	const dataSource = { getRepository: (entity: unknown) => (entity === Comment ? comments : entity === ResourceLink ? links : null) } as unknown as DataSource;
	const execute = jest.fn(async (_command: unknown) => ({}));
	const maps = options.maps ?? [];
	const integrationMapService = {
		findOneByWhereOptions: jest.fn(async (where: { entity: string; sourceId: string }) => {
			const map = maps.find((candidate) => candidate.entity === where.entity && candidate.sourceId === where.sourceId);
			if (!map) throw new Error('not found');
			return map;
		})
	} as unknown as IntegrationMapService;
	const employees = options.employees ?? [{ id: 'emp-ada', userId: 'user-ada', email: 'ada@example.com' }];
	const findAll = jest.fn(async ({ where }: { where: { user: { email: { value: string[] } } } }) => {
		const wanted = where.user.email.value as string[];
		return { items: employees.filter((employee) => wanted.includes(employee.email)) };
	});
	const client = { stories: jest.fn(async () => options.stories ?? []), attachments: jest.fn(async () => options.attachments ?? []) } as unknown as AsanaApiClient;
	const context: AsanaDetailsContext = {
		scope,
		integrationId: 'int-1',
		connectedByUserId: 'user-owner',
		read: (make) => make(client),
		authorsByEmail: new Map(),
		details: { comments: 0, links: 0, failed: 0 }
	};
	const service = new AsanaTaskDetailsService(dataSource, { execute } as unknown as CommandBus, integrationMapService, { findAll } as unknown as EmployeeService);
	return { service, context, comments, links, execute, findAll, client };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AsanaTaskDetailsService', () => {
	it('keeps a comment once, attributed to the employee with the author e-mail, and maps it', async () => {
		const { service, context, comments, execute, findAll } = details({ stories: [story()] });
		await service.apply(context, task, await service.collect(context, task), 'task-1');
		expect(comments.save).toHaveBeenCalledTimes(1);
		expect(comments.rows[0]).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			comment: '<p>Looks good</p>',
			actorType: ActorTypeEnum.User,
			employeeId: 'emp-ada',
			createdByUserId: 'user-ada',
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
		const command = execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand;
		expect(command).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(command.input).toMatchObject({ entity: IntegrationEntity.COMMENT, sourceId: 's-1', gauzyId: comments.rows[0]['id'], integrationId: 'int-1', ...scope });
		expect(context.details).toEqual({ comments: 1, links: 0, failed: 0 });
		// The author is looked up once per e-mail per run.
		await service.apply(context, task, await service.collect(context, task), 'task-1');
		expect(findAll).toHaveBeenCalledTimes(1);
	});

	it('keeps a comment of nobody here as the connecting user\'s, marked System and named after its author', async () => {
		const { service, context, comments } = details({ stories: [story({ created_by: { gid: 'u-2', name: 'Grace', email: 'grace@elsewhere.example' } })] });
		await service.apply(context, task, await service.collect(context, task), 'task-1');
		expect(comments.rows[0]).toMatchObject({ comment: '<p><strong>Grace</strong> (Asana)</p><p>Looks good</p>', actorType: ActorTypeEnum.System, employeeId: undefined, createdByUserId: 'user-owner' });
	});

	it('keeps an updated comment attributed as it was kept: a System comment keeps its author line even when the author is matched now', async () => {
		const later = details({ stories: [story({ text: 'Looks great' })], maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 's-1', gauzyId: 'comment-row-9' }] });
		later.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p><strong>Ada</strong> (Asana)</p><p>Looks good</p>', employeeId: undefined });
		await later.service.apply(later.context, task, await later.service.collect(later.context, task), 'task-1');
		expect(later.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p><strong>Ada</strong> (Asana)</p><p>Looks great</p>' }));
	});

	it('follows an edit of a mapped comment and leaves the same words alone', async () => {
		const edited = details({ stories: [story({ text: 'Looks great' })], maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 's-1', gauzyId: 'comment-row-9' }] });
		edited.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p>Looks good</p>', employeeId: 'emp-ada' });
		await edited.service.apply(edited.context, task, await edited.service.collect(edited.context, task), 'task-1');
		expect(edited.comments.save).not.toHaveBeenCalled();
		expect(edited.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p>Looks great</p>' }));
		expect(edited.context.details.comments).toBe(0);

		const same = details({ stories: [story()], maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 's-1', gauzyId: 'comment-row-9' }] });
		same.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p>Looks good</p>', employeeId: 'emp-ada' });
		await same.service.apply(same.context, task, await same.service.collect(same.context, task), 'task-1');
		expect(same.comments.update).not.toHaveBeenCalled();
	});

	it('keeps an attachment as a mapped link of the task, reuses a link a person added with the same address, and follows a rename', async () => {
		const { service, context, links, execute } = details({ attachments: [attachment(), attachment({ gid: 'a-2', name: 'notes', permalink_url: 'https://p/notes' })] });
		links.rows.push({ id: 'link-person', tenantId: 'tenant-1', entity: BaseEntityEnum.Task, entityId: 'task-1', url: 'https://p/notes' });
		await service.apply(context, task, await service.collect(context, task), 'task-1');
		expect(links.save).toHaveBeenCalledTimes(1);
		expect(links.rows[1]).toMatchObject({ entity: BaseEntityEnum.Task, entityId: 'task-1', title: 'spec.pdf', url: 'https://app.asana.com/a/1', createdByUserId: 'user-owner' });
		expect((execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand).input).toMatchObject({ entity: IntegrationEntity.ATTACHMENT, sourceId: 'a-1' });
		expect(context.details).toEqual({ comments: 0, links: 1, failed: 0 });

		const renamed = details({ attachments: [attachment({ name: 'spec-v2.pdf' })], maps: [{ entity: IntegrationEntity.ATTACHMENT, sourceId: 'a-1', gauzyId: 'link-row-1' }] });
		renamed.links.rows.push({ id: 'link-row-1', tenantId: 'tenant-1', title: 'spec.pdf', url: 'https://app.asana.com/a/1' });
		await renamed.service.apply(renamed.context, task, await renamed.service.collect(renamed.context, task), 'task-1');
		expect(renamed.links.update).toHaveBeenCalledWith({ id: 'link-row-1' }, { title: 'spec-v2.pdf', url: 'https://app.asana.com/a/1' });
	});

	it('counts a read or a write that failed as a failure of the run, not a refusal of one resource, and stops on a refused token', async () => {
		const failing = details({ stories: [story()] });
		(failing.client.attachments as jest.Mock).mockRejectedValue(new AsanaApiError('down', 503));
		failing.comments.save.mockRejectedValueOnce(new Error('connection lost'));
		await failing.service.apply(failing.context, task, await failing.service.collect(failing.context, task), 'task-1');
		expect(failing.context.details).toEqual({ comments: 0, links: 0, failed: 2 });

		const refusedResource = details();
		(refusedResource.client.stories as jest.Mock).mockRejectedValue(new AsanaApiError('nope', 404));
		await refusedResource.service.collect(refusedResource.context, task);
		expect(refusedResource.client.attachments).toHaveBeenCalledTimes(1);
		expect(refusedResource.context.details.failed).toBe(0);

		const refused = details();
		(refused.client.stories as jest.Mock).mockRejectedValue(new AsanaApiError('refused', 401));
		await expect(refused.service.collect(refused.context, task)).rejects.toBeInstanceOf(AsanaApiError);
		expect(refused.client.attachments).not.toHaveBeenCalled();
	});
});
