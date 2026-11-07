import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, IntegrationEntity } from '@gauzy/contracts';
import { Comment, IntegrationMapService, IntegrationMapSyncEntityCommand, ResourceLink } from '@gauzy/core';
import { TrelloApiClient, TrelloApiError, TrelloAttachment, TrelloCard, TrelloCommentAction } from '../client/trello-api.client';
import { TrelloCardDetailsService, TrelloDetailsContext } from './trello-card-details.service';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
const card = { id: 'c-1' } as TrelloCard;

function comment(overrides: Partial<TrelloCommentAction> = {}): TrelloCommentAction {
	return { id: 'act-1', type: 'commentCard', date: '2026-11-07T10:00:00.000Z', data: { text: 'Looks good' }, memberCreator: { id: 'm-ada', username: 'ada', fullName: 'Ada' }, ...overrides };
}

function attachment(overrides: Partial<TrelloAttachment> = {}): TrelloAttachment {
	return { id: 'a-1', name: 'spec.pdf', url: 'https://trello.com/1/cards/c-1/attachments/a-1/download/spec.pdf', date: '2026-11-07T10:00:00.000Z', isUpload: true, ...overrides };
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

function details(options: { comments?: TrelloCommentAction[]; attachments?: TrelloAttachment[]; maps?: Array<{ entity: string; sourceId: string; gauzyId: string }> } = {}) {
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
	const client = { comments: jest.fn(async () => options.comments ?? []), attachments: jest.fn(async () => options.attachments ?? []) } as unknown as TrelloApiClient;
	const context: TrelloDetailsContext = {
		scope,
		integrationId: 'int-1',
		connectedByUserId: 'user-owner',
		read: (make) => make(client),
		details: { comments: 0, links: 0, failed: 0 }
	};
	const service = new TrelloCardDetailsService(dataSource, { execute } as unknown as CommandBus, integrationMapService);
	return { service, context, comments, links, execute, client };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('TrelloCardDetailsService', () => {
	it('keeps a comment once — the connecting user\'s, marked System, named after its member — and maps it', async () => {
		const { service, context, comments, execute } = details({ comments: [comment()] });
		await service.apply(context, card, await service.collect(context, card), 'task-1');
		expect(comments.save).toHaveBeenCalledTimes(1);
		expect(comments.rows[0]).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			comment: '<p><strong>Ada</strong> (Trello)</p><p>Looks good</p>',
			actorType: ActorTypeEnum.System,
			createdByUserId: 'user-owner',
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
		expect(comments.rows[0]['employeeId']).toBeUndefined();
		const command = execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand;
		expect(command).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(command.input).toMatchObject({ entity: IntegrationEntity.COMMENT, sourceId: 'act-1', gauzyId: comments.rows[0]['id'], integrationId: 'int-1', ...scope });
		expect(context.details).toEqual({ comments: 1, links: 0, failed: 0 });
	});

	it('follows an edit of a mapped comment and leaves the same words alone', async () => {
		const edited = details({ comments: [comment({ data: { text: 'Looks great' } })], maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'act-1', gauzyId: 'comment-row-9' }] });
		edited.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p><strong>Ada</strong> (Trello)</p><p>Looks good</p>' });
		await edited.service.apply(edited.context, card, await edited.service.collect(edited.context, card), 'task-1');
		expect(edited.comments.save).not.toHaveBeenCalled();
		expect(edited.comments.update).toHaveBeenCalledWith({ id: 'comment-row-9' }, expect.objectContaining({ comment: '<p><strong>Ada</strong> (Trello)</p><p>Looks great</p>' }));

		const same = details({ comments: [comment()], maps: [{ entity: IntegrationEntity.COMMENT, sourceId: 'act-1', gauzyId: 'comment-row-9' }] });
		same.comments.rows.push({ id: 'comment-row-9', tenantId: 'tenant-1', comment: '<p><strong>Ada</strong> (Trello)</p><p>Looks good</p>' });
		await same.service.apply(same.context, card, await same.service.collect(same.context, card), 'task-1');
		expect(same.comments.update).not.toHaveBeenCalled();
	});

	it('keeps an attachment as a mapped link of the task, reuses a link a person added with the same address, and follows a rename', async () => {
		const { service, context, links, execute } = details({ attachments: [attachment(), attachment({ id: 'a-2', name: 'notes', url: 'https://p/notes', isUpload: false })] });
		links.rows.push({ id: 'link-person', tenantId: 'tenant-1', entity: BaseEntityEnum.Task, entityId: 'task-1', url: 'https://p/notes' });
		await service.apply(context, card, await service.collect(context, card), 'task-1');
		expect(links.save).toHaveBeenCalledTimes(1);
		expect(links.rows[1]).toMatchObject({ entity: BaseEntityEnum.Task, entityId: 'task-1', title: 'spec.pdf', url: 'https://trello.com/1/cards/c-1/attachments/a-1/download/spec.pdf', createdByUserId: 'user-owner' });
		expect((execute.mock.calls[0][0] as IntegrationMapSyncEntityCommand).input).toMatchObject({ entity: IntegrationEntity.ATTACHMENT, sourceId: 'a-1' });
		expect(context.details).toEqual({ comments: 0, links: 1, failed: 0 });

		const renamed = details({ attachments: [attachment({ name: 'spec-v2.pdf' })], maps: [{ entity: IntegrationEntity.ATTACHMENT, sourceId: 'a-1', gauzyId: 'link-row-1' }] });
		renamed.links.rows.push({ id: 'link-row-1', tenantId: 'tenant-1', title: 'spec.pdf', url: 'https://trello.com/1/cards/c-1/attachments/a-1/download/spec.pdf' });
		await renamed.service.apply(renamed.context, card, await renamed.service.collect(renamed.context, card), 'task-1');
		expect(renamed.links.update).toHaveBeenCalledWith({ id: 'link-row-1' }, { title: 'spec-v2.pdf', url: 'https://trello.com/1/cards/c-1/attachments/a-1/download/spec.pdf' });
	});

	it('counts a read or a write that failed as a failure of the run, not a refusal of one resource, and stops on a refused token', async () => {
		const failing = details({ comments: [comment()] });
		(failing.client.attachments as jest.Mock).mockRejectedValue(new TrelloApiError('down', 503));
		failing.comments.save.mockRejectedValueOnce(new Error('connection lost'));
		await failing.service.apply(failing.context, card, await failing.service.collect(failing.context, card), 'task-1');
		expect(failing.context.details).toEqual({ comments: 0, links: 0, failed: 2 });

		const refusedResource = details();
		(refusedResource.client.comments as jest.Mock).mockRejectedValue(new TrelloApiError('nope', 404));
		await refusedResource.service.collect(refusedResource.context, card);
		expect(refusedResource.client.attachments).toHaveBeenCalledTimes(1);
		expect(refusedResource.context.details.failed).toBe(0);

		const refused = details();
		(refused.client.comments as jest.Mock).mockRejectedValue(new TrelloApiError('refused', 401));
		await expect(refused.service.collect(refused.context, card)).rejects.toBeInstanceOf(TrelloApiError);
		expect(refused.client.attachments).not.toHaveBeenCalled();
	});
});
