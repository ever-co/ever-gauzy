import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { LinearAttachment, LinearComment, LinearIssue } from '../client/linear-api.client';
import { LinearDetailsContext, LinearIssueDetailsService } from './linear-issue-details.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

function comment(overrides: Partial<LinearComment> = {}): LinearComment {
	return { id: 'cm-1', body: 'Looks good', createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:00:00.000Z', user: { id: 'u-1', name: 'ada', displayName: 'Ada', email: 'ada@example.com' }, parent: null, ...overrides };
}

function attachment(overrides: Partial<LinearAttachment> = {}): LinearAttachment {
	return { id: 'at-1', title: 'Design', url: 'https://www.figma.com/file/1', ...overrides };
}

function issue(comments: LinearComment[] = [], attachments: LinearAttachment[] = []): LinearIssue {
	return { id: 'i-1', identifier: 'ENG-1', comments: { nodes: comments }, attachments: { nodes: attachments } } as unknown as LinearIssue;
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

function details(options: { employees?: Array<{ id: string; userId: string | null; email: string }>; maps?: Array<{ entity: string; sourceId: string; gauzyId: string }> } = {}) {
	const comments = repository();
	const links = repository();
	const dataSource = { getRepository: (entity: unknown) => (entity === Comment ? comments : entity === ResourceLink ? links : null) } as unknown as DataSource;
	const execute = jest.fn(async (command: unknown) => {
		// The map of what was just kept is known to later lookups (a reply finds its parent).
		const input = (command as IntegrationMapSyncEntityCommand).input;
		maps.push({ entity: String(input.entity), sourceId: String(input.sourceId), gauzyId: String(input.gauzyId) });
		return {};
	});
	const maps = [...(options.maps ?? [])];
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
	const context: LinearDetailsContext = { scope, integrationId: 'int-1', connectedByUserId: 'user-owner', authorsByEmail: new Map(), details: { comments: 0, links: 0, failed: 0 } };
	const service = new LinearIssueDetailsService(dataSource, { execute } as unknown as CommandBus, integrationMapService, { findAll } as unknown as EmployeeService);
	return { service, context, comments, links, execute, findAll };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('LinearIssueDetailsService', () => {
	it('keeps a comment once, attributed to the employee with the author e-mail, a reply under its parent, and maps them', async () => {
		const { service, context, comments, execute, findAll } = details();
		await service.apply(context, issue([comment(), comment({ id: 'cm-2', body: 'Agreed', parent: { id: 'cm-1' } })]), 'task-1');
		expect(comments.save).toHaveBeenCalledTimes(2);
		expect(comments.rows[0]).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			comment: '<p>Looks good</p>',
			actorType: ActorTypeEnum.User,
			employeeId: 'emp-ada',
			createdByUserId: 'user-ada',
			parentId: undefined,
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
		expect(comments.rows[1]).toMatchObject({ comment: '<p>Agreed</p>', parentId: comments.rows[0]['id'] });
		const command = execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand;
		expect(command).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(command.input).toMatchObject({ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: comments.rows[0]['id'], integrationId: 'int-1', ...scope });
		expect(context.details).toEqual({ comments: 2, links: 0, failed: 0 });
		// The author is looked up once per e-mail per run.
		expect(findAll).toHaveBeenCalledTimes(1);
	});

	it('keeps a comment of nobody here as the connecting user\'s, marked System and named after its author', async () => {
		const { service, context, comments } = details();
		await service.apply(context, issue([comment({ user: { id: 'u-2', name: 'grace', displayName: 'Grace Hopper', email: 'grace@elsewhere.example' } })]), 'task-1');
		expect(comments.rows[0]).toMatchObject({ comment: '<p><strong>Grace Hopper</strong> (Linear)</p><p>Looks good</p>', actorType: ActorTypeEnum.System, employeeId: undefined, createdByUserId: 'user-owner' });
	});

	it('keeps an updated comment attributed as it was kept: a System comment keeps its author line even when the author is matched now', async () => {
		const later = details({ maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: 'comment-row-9' }] });
		later.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p><strong>Ada</strong> (Linear)</p><p>Looks good</p>', employeeId: undefined });
		await later.service.apply(later.context, issue([comment({ body: 'Looks great' })]), 'task-1');
		expect(later.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p><strong>Ada</strong> (Linear)</p><p>Looks great</p>' }));
	});

	it('follows an edit of a mapped comment and leaves the same words alone', async () => {
		const edited = details({ maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: 'comment-row-9' }] });
		edited.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p>Looks good</p>', employeeId: 'emp-ada' });
		await edited.service.apply(edited.context, issue([comment({ body: 'Looks great' })]), 'task-1');
		expect(edited.comments.save).not.toHaveBeenCalled();
		expect(edited.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p>Looks great</p>' }));

		const same = details({ maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: 'comment-row-9' }] });
		same.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p>Looks good</p>', employeeId: 'emp-ada' });
		await same.service.apply(same.context, issue([comment()]), 'task-1');
		expect(same.comments.update).not.toHaveBeenCalled();
	});

	it('keeps an attachment as a mapped link of the task, reuses a link a person added with the same address, and follows a retitle', async () => {
		const { service, context, links, execute } = details();
		links.rows.push({ id: 'link-person', tenantId: 'tenant-1', entity: BaseEntityEnum.Task, entityId: 'task-1', url: 'https://p/notes' });
		await service.apply(context, issue([], [attachment(), attachment({ id: 'at-2', title: 'notes', url: 'https://p/notes' })]), 'task-1');
		expect(links.save).toHaveBeenCalledTimes(1);
		expect(links.rows[1]).toMatchObject({ entity: BaseEntityEnum.Task, entityId: 'task-1', title: 'Design', url: 'https://www.figma.com/file/1', createdByUserId: 'user-owner' });
		expect((execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand).input).toMatchObject({ entity: IntegrationEntity.ATTACHMENT, sourceId: 'at-1' });
		expect(context.details).toEqual({ comments: 0, links: 1, failed: 0 });

		const retitled = details({ maps: [{ entity: IntegrationEntity.ATTACHMENT, sourceId: 'at-1', gauzyId: 'link-row-1' }] });
		retitled.links.rows.push({ id: 'link-row-1', tenantId: 'tenant-1', title: 'Design', url: 'https://www.figma.com/file/1' });
		await retitled.service.apply(retitled.context, issue([], [attachment({ title: 'Design v2' })]), 'task-1');
		expect(retitled.links.update).toHaveBeenCalledWith({ id: 'link-row-1' }, { title: 'Design v2', url: 'https://www.figma.com/file/1' });
	});

	it('counts a comment that could not be kept as a failure of the run and goes on with the rest', async () => {
		const { service, context, comments } = details();
		comments.save.mockRejectedValueOnce(new Error('connection lost'));
		await service.apply(context, issue([comment(), comment({ id: 'cm-2', body: 'Second' })]), 'task-1');
		expect(comments.rows).toHaveLength(1);
		expect(comments.rows[0]).toMatchObject({ comment: '<p>Second</p>' });
		expect(context.details).toEqual({ comments: 1, links: 0, failed: 1 });
	});
});
