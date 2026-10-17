/**
 * G-P2-3 Ideas ↔ Idea tasks against in-memory Gauzy stand-ins and the mock Ever Works API (real
 * client): an idea becomes an Idea task in the Ideas project, changes follow, private and deleted
 * ideas stop syncing; a Gauzy idea task becomes an Ever Works idea, edits are patched, cancelling
 * dismisses it, other status moves are not pushed, a type change unlinks it.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	const command = (name: string) =>
		({
			[name]: class {
				readonly args: unknown[];
				constructor(...args: unknown[]) {
					this.args = args;
				}
			}
		})[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		TaskCreateCommand: command('TaskCreateCommand'),
		TaskUpdateCommand: command('TaskUpdateCommand'),
		OrganizationProjectCreateCommand: command('OrganizationProjectCreateCommand'),
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'User',
				'IntegrationTenant',
				'IntegrationSetting',
				'OrganizationProject',
				'Task',
				'TaskStatus',
				'Tag',
				'Comment',
				'ResourceLink'
			].map((name) => [name, entity(name)])
		),
		// A request context the sync opens (`runWithRequest`), or none at all (`noContext`: the worker).
		RequestContext: (() => {
			const state: { noContext: boolean; current: { user?: { id?: string; tenantId?: string } } | null } = {
				noContext: false,
				current: null
			};
			return {
				state,
				currentTenantId: () => state.current?.user?.tenantId ?? null,
				currentUserId: () => state.current?.user?.id ?? null,
				currentOrganizationId: () => null,
				runWithRequest: async (
					req: { user?: { id?: string; tenantId?: string } },
					fn: () => Promise<unknown>
				) => {
					if (state.noContext) return fn();
					const previous = state.current;
					state.current = req;
					try {
						return await fn();
					} finally {
						state.current = previous;
					}
				}
			};
		})()
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import {
	Comment,
	IntegrationSetting,
	OrganizationProject,
	OrganizationProjectCreateCommand,
	RequestContext,
	ResourceLink,
	Tag,
	Task,
	TaskCreateCommand,
	TaskStatus,
	TaskUpdateCommand
} from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksIdeas } from '../testing/mock-ever-works.ideas';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksIdeasService } from './ever-works-ideas.service';

type Row = Record<string, any>;

function setup(options: { ideas?: string } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg] });
	const ideas = new MockEverWorksIdeas(mock);
	const client = new EverWorksClient({
		apiBaseUrl: 'https://api.example.test/api',
		apiKey: key,
		transport: mock.transport(),
		connectionId: 'c1',
		scopeSlug: 'acme',
		retry: { maxAttempts: 1 },
		sleep: async () => undefined
	});
	const settings: Row[] = [{ id: 's1', settingsName: 'IDEA_ISSUE_TYPE_ID', settingsValue: 'type-idea' }];
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		mapping: { id: 'm1', settings },
		connection: { id: 'c1', connectedByUserId: 'u-admin' },
		everWorksOrganizationSlug: 'acme',
		directions: { ideas: options.ideas ?? 'both' },
		isEnabled: true
	};
	const links: Row[] = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['ewId'] === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['gauzyId'] === gauzyId) ??
			null,
		list: async (m: string, type: string) =>
			links.filter((l) => l['integrationTenantId'] === m && l['entityType'] === type),
		snapshot: (link: Row | null) => (link?.['snapshot'] ? JSON.parse(link['snapshot']) : {}),
		record: async (input: Row) => {
			const existing = links.find(
				(l) =>
					l['entityType'] === input['entityType'] &&
					(l['ewId'] === input['ewId'] || l['gauzyId'] === input['gauzyId'])
			);
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				ewVersion: input['ewVersion'] ?? null,
				snapshot: JSON.stringify(input['snapshot']),
				ewOnly: JSON.stringify(input['ewOnly']),
				lastDirection: input['direction'],
				state: 'ok'
			};
			if (existing) {
				Object.assign(existing, values);
				return existing;
			}
			const row = {
				id: `l${links.length + 1}`,
				integrationTenantId: input['integrationTenantId'],
				entityType: input['entityType'],
				...values
			};
			links.push(row);
			return row;
		},
		unlink: async (link: Row) => void (link['state'] = EverWorksLinkState.UNLINKED)
	};
	const addLink = (entityType: EverWorksLinkType, gauzyId: string, ewId: string) =>
		links.push({
			id: `x-${ewId}`,
			integrationTenantId: 'm1',
			entityType,
			gauzyId,
			ewId,
			ewVersion: null,
			snapshot: null,
			ewOnly: null,
			state: 'ok'
		});
	const tasks: Row[] = [];
	const projects: Row[] = [];
	const comments: Row[] = [];
	const resourceLinks: Row[] = [];
	const tags: Row[] = [];
	const statuses: Row[] = [
		{ id: 'st-open', value: 'open', isTodo: true },
		{ id: 'st-progress', value: 'in-progress', isInProgress: true },
		{ id: 'st-blocked', value: 'blocked', isInProgress: true },
		{ id: 'st-done', value: 'done', isDone: true },
		{ id: 'st-cancelled', value: 'cancelled' }
	];
	const relationOf = (field: 'teams' | 'tags', taskId: string) => {
		const task = tasks.find((t) => t['id'] === taskId) as Row;
		task[field] = task[field] ?? [];
		return {
			loadMany: async () => [...task[field]],
			add: async (id: string) => void task[field].push({ id }),
			addAndRemove: async (add: string[], remove: string[]) => {
				task[field] = [
					...task[field].filter((row: Row) => !remove.includes(row['id'])),
					...add.map((id) => ({ id }))
				];
			}
		};
	};
	const repositories = new Map<unknown, Row>([
		[
			Task,
			{
				findOne: async ({ where }: { where: Row }) => {
					const task = tasks.find((t) => t['id'] === where['id']);
					return task
						? { ...task, taskStatus: statuses.find((s) => s['id'] === task['taskStatusId']) ?? null }
						: null;
				},
				update: async (where: Row, values: Row) =>
					void Object.assign(tasks.find((t) => t['id'] === where['id']) ?? {}, values)
			}
		],
		// The global status rows (no tenant) answer; project and organization scopes have none of their own here.
		[TaskStatus, { find: async ({ where }: { where: Row }) => (where['tenantId'] === 't1' ? [] : statuses) }],
		[
			OrganizationProject,
			{
				findOne: async ({ where }: { where: Row }) =>
					projects.find(
						(p) =>
							(!where['id'] || p['id'] === where['id']) && (!where['name'] || p['name'] === where['name'])
					) ?? null
			}
		],
		[
			Tag,
			{
				findOne: async ({ where }: { where: Row }) => tags.find((t) => t['name'] === where['name']) ?? null,
				insert: async (row: Row) => void tags.push(row)
			}
		],
		[
			Comment,
			{
				findOne: async ({ where }: { where: Row }) => comments.find((c) => c['id'] === where['id']) ?? null,
				insert: async (row: Row) => void comments.push(row)
			}
		],
		[
			ResourceLink,
			{
				findOne: async ({ where }: { where: Row }) =>
					resourceLinks.find((r) => r['id'] === where['id']) ?? null,
				insert: async (row: Row) => void resourceLinks.push(row)
			}
		],
		[
			IntegrationSetting,
			{
				findOne: async ({ where }: { where: Row }) =>
					settings.find((s) => s['settingsName'] === where['settingsName']) ?? null,
				update: async (where: Row, values: Row) =>
					void Object.assign(settings.find((s) => s['id'] === where['id']) ?? {}, values),
				insert: async (row: Row) => void settings.push(row)
			}
		]
	]);
	const dataSource = {
		getRepository: (target: unknown) => repositories.get(target) ?? { findOne: async () => null },
		createQueryBuilder: () => ({
			relation: (_entity: unknown, field: 'teams' | 'tags') => ({
				of: (taskId: string) => relationOf(field, taskId)
			})
		})
	};
	const commandBus = {
		execute: jest.fn(async (command: { args: unknown[] }) => {
			if (command instanceof TaskCreateCommand) {
				const input = command.args[0] as Row;
				const row = { id: `task-${tasks.length + 1}`, ...input };
				tasks.push(row);
				return row;
			}
			if (command instanceof TaskUpdateCommand) {
				const [id, input] = command.args as [string, Row];
				const row = tasks.find((t) => t['id'] === id) as Row;
				Object.assign(row, input);
				return row;
			}
			if (command instanceof OrganizationProjectCreateCommand) {
				const row = { id: `p-${projects.length + 1}`, ...(command.args[0] as Row) };
				projects.push(row);
				return row;
			}
			throw new Error('unexpected command');
		})
	};
	const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context };
	const log = { write: jest.fn(async () => undefined) };
	const service = new EverWorksIdeasService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		commandBus as never,
		log as never,
		{ register: jest.fn() } as never,
		{ register: jest.fn() } as never
	);
	return {
		service,
		mock,
		ideas,
		ewOrg,
		links,
		linkService,
		addLink,
		tasks,
		projects,
		comments,
		resourceLinks,
		tags,
		settings,
		commandBus,
		log,
		context
	};
}

const envelope = (type: string, data: Row, version = 1, actor: Row = { type: 'user', id: 'ew-ann' }) => ({
	id: `evt-${type}-${version}`,
	seq: String(version),
	type,
	version: 1,
	occurredAt: new Date().toISOString(),
	tenantId: 'ewt',
	organizationId: 'ew-org-1',
	aggregate: { type: 'idea', id: data['id'] ?? 'ew-idea-1', version },
	actor,
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;
const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
const change = (gauzyId: string, op: 'upsert' | 'delete' = 'upsert') =>
	({ id: 'ch', tenantId: 't1', organizationId: 'o1', gauzyId, op, actorUserId: null }) as never;
const idea = {
	id: 'ew-idea-1',
	title: 'Customer portal',
	description: 'Self-service\n\nfor invoices',
	status: 'pending',
	source: 'mission',
	teamIds: [],
	visibility: 'organization',
	webUrl: 'https://app.example.test/ideas/ew-idea-1'
};

describe('EverWorksIdeasService — EW → G', () => {
	it('an idea becomes an Idea task in the Ideas project (created when needed), tagged with its source', async () => {
		const { service, tasks, projects, settings, links, resourceLinks, tags } = setup();
		expect(await service.apply(envelope('idea.created', idea) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(projects).toHaveLength(1);
		expect(projects[0]['name']).toBe('Ever Works — Ideas');
		expect(settings.find((s) => s['settingsName'] === 'IDEAS_PROJECT_ID')?.['settingsValue']).toBe(
			projects[0]['id']
		);
		const [task] = tasks;
		expect(task).toMatchObject({
			title: 'Customer portal',
			issueType: 'Idea',
			taskTypeId: 'type-idea',
			projectId: projects[0]['id'],
			status: 'open'
		});
		expect(task['description']).toBe('<p>Self-service</p><p>for invoices</p>');
		expect(task['tags']).toEqual([{ id: tags[0]['id'] }]);
		expect(tags[0]['name']).toBe('source:mission');
		expect(resourceLinks[0]).toMatchObject({ entityId: task['id'], url: idea.webUrl });
		expect(links.find((l) => l['entityType'] === EverWorksLinkType.IDEA_TASK)).toMatchObject({
			gauzyId: task['id'],
			ewId: 'ew-idea-1',
			lastDirection: 'inbound'
		});
	});

	it('only what changed in Ever Works is written; a failure is posted as a comment; an older event is skipped', async () => {
		const { service, tasks, comments, commandBus } = setup();
		await service.apply(envelope('idea.created', idea, 1) as never, applyContext);
		tasks[0]['title'] = 'Renamed in Gauzy';
		commandBus.execute.mockClear();
		await service.apply(
			envelope(
				'idea.status_changed',
				{ ...idea, status: 'failed', failureMessage: 'Build ran out of budget' },
				2
			) as never,
			applyContext
		);
		expect(tasks[0]).toMatchObject({ title: 'Renamed in Gauzy', status: 'blocked', taskStatusId: 'st-blocked' });
		expect(comments[0]['comment']).toContain('Build ran out of budget');
		expect(
			await service.apply(envelope('idea.updated', { ...idea, title: 'Old' }, 2) as never, applyContext)
		).toMatchObject({ status: 'skipped' });
	});

	it('a private idea stops syncing and a deleted one archives its task; neither is deleted', async () => {
		const { service, tasks, links } = setup();
		await service.apply(envelope('idea.created', idea, 1) as never, applyContext);
		await service.apply(
			envelope('idea.visibility_changed', { id: 'ew-idea-1', visibility: 'private' }, 2) as never,
			applyContext
		);
		expect(links[0]['state']).toBe(EverWorksLinkState.UNLINKED);
		expect(tasks).toHaveLength(1);
		const other = setup();
		await other.service.apply(envelope('idea.created', idea, 1) as never, applyContext);
		await other.service.apply(envelope('idea.deleted', { ...idea, deleted: true }, 2) as never, applyContext);
		expect(other.tasks[0]['isArchived']).toBe(true);
		expect(other.links[0]['state']).toBe(EverWorksLinkState.UNLINKED);
	});

	it('a retry after a failure half-way (the task written, its link not) finds that task instead of a second one', async () => {
		const { service, tasks, links, resourceLinks, comments, linkService, commandBus } = setup();
		const failed = { ...idea, status: 'failed', failureMessage: 'Build ran out of budget' };
		jest.spyOn(linkService, 'record').mockRejectedValueOnce(new Error('connection lost'));
		await expect(service.apply(envelope('idea.created', failed) as never, applyContext)).rejects.toThrow(
			'connection lost'
		);
		expect(tasks).toHaveLength(1);
		expect(links).toHaveLength(0);
		// The idea changed in Ever Works before the retry: the retry writes its current fields over the task.
		const renamed = { ...failed, title: 'Customer portal v2', description: 'Self-service' };
		expect(await service.apply(envelope('idea.created', renamed) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(tasks).toHaveLength(1);
		expect(tasks[0]).toMatchObject({ title: 'Customer portal v2', description: '<p>Self-service</p>' });
		expect(resourceLinks).toHaveLength(1);
		expect(comments).toHaveLength(1);
		expect(commandBus.execute.mock.calls.filter(([command]) => command instanceof TaskCreateCommand)).toHaveLength(
			1
		);
		expect(links.find((l) => l['entityType'] === EverWorksLinkType.IDEA_TASK)).toMatchObject({
			gauzyId: tasks[0]['id'],
			ewId: 'ew-idea-1'
		});
		// The id is derived from the mapping and the idea: the same on every retry, in any process.
		const again = setup();
		await again.service.apply(envelope('idea.created', renamed) as never, applyContext);
		expect(again.tasks[0]['id']).toBe(tasks[0]['id']);
	});

	it('an idea made from a Gauzy task links back to that task instead of creating a twin', async () => {
		const { service, tasks } = setup();
		tasks.push({ id: 'task-g', title: 'Portal', issueType: 'Idea', organizationId: 'o1', tenantId: 't1' });
		await service.apply(
			envelope('idea.created', {
				...idea,
				externalLinks: [{ source: 'gauzy', installationId: 'c1', externalId: 'task-g' }]
			}) as never,
			applyContext
		);
		expect(tasks).toHaveLength(1);
	});

	it('a process without a request context (the worker) writes nothing and defers the idea to an API process', async () => {
		const { service, tasks, projects } = setup();
		const state = (RequestContext as unknown as { state: { noContext: boolean } }).state;
		state.noContext = true;
		try {
			expect(await service.apply(envelope('idea.created', idea) as never, applyContext)).toMatchObject({
				status: 'deferred'
			});
		} finally {
			state.noContext = false;
		}
		expect(tasks).toHaveLength(0);
		expect(projects).toHaveLength(0);
	});

	it('ideas switched to Gauzy → Ever Works only are not applied', async () => {
		const { service, tasks } = setup({ ideas: 'gauzy_to_ew' });
		expect(await service.apply(envelope('idea.created', idea) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		expect(tasks).toHaveLength(0);
	});
});

describe('EverWorksIdeasService — G → EW', () => {
	const ideaTask = (extra: Row = {}) => ({
		id: 'task-g',
		title: 'Portal',
		description: '<p>Customer portal</p>',
		issueType: 'Idea',
		taskTypeId: 'type-idea',
		status: 'open',
		teams: [],
		...extra
	});

	it('an Idea task becomes an Ever Works idea (external, pending), linked back; a second push sends nothing', async () => {
		const { service, mock, ideas, tasks, links } = setup();
		tasks.push(ideaTask());
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({ status: 'pushed' });
		const post = mock.requests.find((r) => r.method === 'POST' && r.path === '/ideas');
		expect(post?.body).toMatchObject({
			title: 'Portal',
			description: 'Customer portal',
			visibility: 'organization',
			externalRef: { source: 'gauzy', externalId: 'task-g' }
		});
		const link = links.find((l) => l['entityType'] === EverWorksLinkType.IDEA_TASK);
		expect(ideas.ideas.get(link?.['ewId'])).toMatchObject({ source: 'external', status: 'pending' });
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({
			status: 'skipped',
			message: 'nothing changed'
		});
	});

	it('edits are patched; cancelling dismisses and reopening restores; done is not pushed (accept stays in Ever Works)', async () => {
		const { service, mock, ideas, tasks, links } = setup();
		tasks.push(ideaTask());
		await service.push(change('task-g'), pushContext);
		const ewId = links[0]['ewId'];
		tasks[0]['title'] = 'Portal v2';
		await service.push(change('task-g'), pushContext);
		expect(ideas.ideas.get(ewId)?.['title']).toBe('Portal v2');
		tasks[0]['status'] = 'cancelled';
		await service.push(change('task-g'), pushContext);
		expect(ideas.ideas.get(ewId)?.['status']).toBe('dismissed');
		tasks[0]['status'] = 'open';
		await service.push(change('task-g'), pushContext);
		expect(ideas.ideas.get(ewId)?.['status']).toBe('pending');
		const before = mock.requests.length;
		tasks[0]['status'] = 'done';
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({ status: 'skipped' });
		expect(mock.requests.length).toBe(before);
	});

	it('a 412 keeps the newer Gauzy edit: Ever Works’ older title is not written over it, and the retry pushes it', async () => {
		const { service, ideas, tasks, links } = setup();
		tasks.push(ideaTask());
		await service.push(change('task-g'), pushContext);
		const row = ideas.ideas.get(links[0]['ewId']) as Row;
		// Ever Works changed the title (its event not applied yet); then a Gauzy user changed it too.
		Object.assign(row, { title: 'Portal (EW)', version: Number(row['version']) + 1 });
		tasks[0]['title'] = 'Portal (Gauzy)';
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({ status: 'pushed' });
		expect(tasks[0]['title']).toBe('Portal (Gauzy)');
		expect(row['title']).toBe('Portal (Gauzy)');
	});

	it('Ever Works teams Gauzy cannot map are kept when Gauzy edits the idea', async () => {
		const { service, ideas, tasks, links, mock } = setup();
		tasks.push(ideaTask());
		await service.push(change('task-g'), pushContext);
		const ewId = links[0]['ewId'];
		// Ever Works put the idea on a team Gauzy has no pair for (its event recorded it as unmapped).
		const row = ideas.ideas.get(ewId) as Row;
		Object.assign(row, { teamIds: ['ew-unpaired'], visibility: 'team', version: Number(row['version']) + 1 });
		await service.apply(envelope('idea.updated', { ...row }, Number(row['version'])) as never, applyContext);
		tasks[0]['title'] = 'Portal v3';
		await service.push(change('task-g'), pushContext);
		const patch = [...mock.requests].reverse().find((r) => r.method === 'PATCH');
		expect(patch?.body).toEqual({ title: 'Portal v3' });
		expect(row['teamIds']).toEqual(['ew-unpaired']);
	});

	it('a task on a team not paired yet waits (teams first); a paired team scopes the idea', async () => {
		const { service, addLink, tasks, mock } = setup();
		tasks.push(ideaTask({ teams: [{ id: 'g-team-1' }] }));
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({ status: 'deferred' });
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		await service.push(change('task-g'), pushContext);
		expect(mock.requests.find((r) => r.method === 'POST' && r.path === '/ideas')?.body).toMatchObject({
			teamIds: ['ew-team-1'],
			visibility: 'team'
		});
	});

	it('a task whose type changes away from Idea is unlinked with a warning; both records are kept', async () => {
		const { service, ideas, tasks, links, log } = setup();
		tasks.push(ideaTask());
		await service.push(change('task-g'), pushContext);
		tasks[0]['issueType'] = 'Bug';
		tasks[0]['taskTypeId'] = 'type-bug';
		expect(await service.push(change('task-g'), pushContext)).toMatchObject({ status: 'skipped' });
		expect(links[0]['state']).toBe(EverWorksLinkState.UNLINKED);
		expect(log.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'unlinked' }));
		expect(ideas.ideas.size).toBe(1);
	});

	it('Ever Works refusing a dismiss (the idea moved on) writes its status back to the task and logs a conflict', async () => {
		const { service, ideas, tasks, links, log } = setup();
		tasks.push(ideaTask({ projectId: 'p-1' }));
		await service.push(change('task-g'), pushContext);
		const ewId = links[0]['ewId'];
		const row = ideas.ideas.get(ewId) as Row;
		row['status'] = 'building';
		tasks[0]['status'] = 'cancelled';
		await service.push(change('task-g'), pushContext);
		expect(row['status']).toBe('building');
		expect(tasks[0]['status']).toBe('in-progress');
		expect(log.write).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'dismiss_refused', status: 'conflict' })
		);
	});
});
