import { Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, IntegrationEntity } from '@gauzy/contracts';
import { Comment, EmployeeService, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { JiraAttachment, JiraComment, JiraIssue } from '../client/jira-api.client';
import { JiraDetailsContext, JiraIssueDetailsService } from './jira-issue-details.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

/** A comment body as Jira sends it (ADF): one paragraph of text. */
const adf = (text: string) => ({ type: 'doc' as const, version: 1 as const, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

function comment(overrides: Partial<Omit<JiraComment, 'body'>> & { body?: string } = {}): JiraComment {
	const { body, ...rest } = overrides;
	return {
		id: 'cm-1',
		body: adf(body ?? 'Looks good'),
		created: '2026-11-07T10:00:00.000+0000',
		updated: '2026-11-07T10:00:00.000+0000',
		author: { accountId: 'acc-ada', displayName: 'Ada', emailAddress: 'ada@example.com' },
		...rest
	};
}

function attachment(overrides: Partial<JiraAttachment> = {}): JiraAttachment {
	return { id: 'at-1', filename: 'Design', content: 'https://site.atlassian.net/rest/api/3/attachment/content/1', ...overrides };
}

function issue(comments: JiraComment[] = [], attachments: JiraAttachment[] = []): JiraIssue {
	return { id: 'i-1', key: 'ENG-1', fields: { comment: { comments }, attachment: attachments } } as unknown as JiraIssue;
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
	const remove = jest.fn(async ({ id }: { id: unknown }) => {
		const index = rows.findIndex((row) => row['id'] === id);
		if (index >= 0) rows.splice(index, 1);
	});
	return { rows, findOne, update, create, save, delete: remove };
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
			// A miss, as the platform's lookup answers it.
			if (!map) throw new NotFoundException('The requested record was not found');
			return map;
		})
	} as unknown as IntegrationMapService;
	const employees = options.employees ?? [{ id: 'emp-ada', userId: 'user-ada', email: 'ada@example.com' }];
	const findAll = jest.fn(async ({ where }: { where: { user: { email: { value: string[] } } } }) => {
		const wanted = where.user.email.value as string[];
		return { items: employees.filter((employee) => wanted.includes(employee.email)) };
	});
	const context: JiraDetailsContext = { scope, integrationId: 'int-1', connectedByUserId: 'user-owner', authorsByEmail: new Map(), details: { comments: 0, links: 0, failed: 0 } };
	const service = new JiraIssueDetailsService(dataSource, { execute } as unknown as CommandBus, integrationMapService, { findAll } as unknown as EmployeeService);
	return { service, context, comments, links, execute, findAll, integrationMapService };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('JiraIssueDetailsService', () => {
	it('keeps a comment once (its ADF body as HTML), attributed to the employee with the author e-mail, and maps them', async () => {
		const { service, context, comments, execute, findAll } = details();
		await service.apply(context, issue([comment(), comment({ id: 'cm-2', body: 'Agreed <b>' })]), 'task-1');
		expect(comments.save).toHaveBeenCalledTimes(2);
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
		expect(comments.rows[1]).toMatchObject({ comment: '<p>Agreed &lt;b&gt;</p>' });
		const command = execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand;
		expect(command).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(command.input).toMatchObject({ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: comments.rows[0]['id'], integrationId: 'int-1', ...scope });
		expect(context.details).toEqual({ comments: 2, links: 0, failed: 0 });
		// The author is looked up once per e-mail per run.
		expect(findAll).toHaveBeenCalledTimes(1);
	});

	it('keeps a comment of nobody here as the connecting user\'s, marked System and named after its author', async () => {
		const { service, context, comments } = details();
		await service.apply(context, issue([comment({ author: { accountId: 'acc-grace', displayName: 'Grace Hopper', emailAddress: 'grace@elsewhere.example' } })]), 'task-1');
		expect(comments.rows[0]).toMatchObject({ comment: '<p><strong>Grace Hopper</strong> (Jira)</p><p>Looks good</p>', actorType: ActorTypeEnum.System, employeeId: undefined, createdByUserId: 'user-owner' });
	});

	it('keeps an updated comment attributed as it was kept: a System comment keeps its author line even when the author is matched now', async () => {
		const later = details({ maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'cm-1', gauzyId: 'comment-row-9' }] });
		later.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p><strong>Ada</strong> (Jira)</p><p>Looks good</p>', employeeId: undefined });
		await later.service.apply(later.context, issue([comment({ body: 'Looks great' })]), 'task-1');
		expect(later.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p><strong>Ada</strong> (Jira)</p><p>Looks great</p>' }));
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
		await service.apply(context, issue([], [attachment(), attachment({ id: 'at-2', filename: 'notes', content: 'https://p/notes' })]), 'task-1');
		expect(links.save).toHaveBeenCalledTimes(1);
		expect(links.rows[1]).toMatchObject({ entity: BaseEntityEnum.Task, entityId: 'task-1', title: 'Design', url: 'https://site.atlassian.net/rest/api/3/attachment/content/1', createdByUserId: 'user-owner' });
		expect((execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand).input).toMatchObject({ entity: IntegrationEntity.ATTACHMENT, sourceId: 'at-1' });
		expect(context.details).toEqual({ comments: 0, links: 1, failed: 0 });

		const retitled = details({ maps: [{ entity: IntegrationEntity.ATTACHMENT, sourceId: 'at-1', gauzyId: 'link-row-1' }] });
		retitled.links.rows.push({ id: 'link-row-1', tenantId: 'tenant-1', title: 'Design', url: 'https://site.atlassian.net/rest/api/3/attachment/content/1' });
		await retitled.service.apply(retitled.context, issue([], [attachment({ filename: 'Design v2' })]), 'task-1');
		expect(retitled.links.update).toHaveBeenCalledWith({ id: 'link-row-1' }, { title: 'Design v2', url: 'https://site.atlassian.net/rest/api/3/attachment/content/1' });
	});

	it('fails a detail whose map lookup failed (not a miss), keeping nothing twice', async () => {
		const { service, context, comments, integrationMapService } = details();
		(integrationMapService.findOneByWhereOptions as jest.Mock).mockRejectedValueOnce(new Error('connection lost'));
		await service.apply(context, issue([comment()]), 'task-1');
		expect(comments.save).not.toHaveBeenCalled();
		expect(context.details).toEqual({ comments: 0, links: 0, failed: 1 });
	});

	it('removes a comment or a link whose id map could not be written, and counts the failure (the next read keeps it once)', async () => {
		const { service, context, comments, links, execute } = details();
		execute.mockRejectedValueOnce(new Error('map write failed')).mockRejectedValueOnce(new Error('map write failed'));
		await service.apply(context, issue([comment()], [attachment()]), 'task-1');
		expect(comments.save).toHaveBeenCalledTimes(1);
		expect(comments.delete).toHaveBeenCalledTimes(1);
		expect(links.delete).toHaveBeenCalledTimes(1);
		expect(comments.rows).toHaveLength(0);
		expect(links.rows).toHaveLength(0);
		expect(context.details).toEqual({ comments: 0, links: 0, failed: 2 });
	});

	it('fails a comment whose author could not be looked up, rather than keeping it as a System comment for good', async () => {
		const { service, context, comments, findAll } = details();
		findAll.mockRejectedValueOnce(new Error('connection lost'));
		await service.apply(context, issue([comment()]), 'task-1');
		expect(comments.save).not.toHaveBeenCalled();
		expect(context.details).toEqual({ comments: 0, links: 0, failed: 1 });
		// Not cached as nobody: the next read looks the author up again.
		expect(context.authorsByEmail.has('ada@example.com')).toBe(false);
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
