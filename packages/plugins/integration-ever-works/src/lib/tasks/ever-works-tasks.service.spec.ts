/**
 * Tasks (G-P1-9): the pure mappers (Markdown ↔ HTML, titles, labels, set merges), and the task handler
 * both ways against in-memory Gauzy stand-ins and the mock Ever Works server (real client, contract routes).
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		BaseEntityEventSubscriber: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'EmployeeNotification',
				'User',
				'Integration',
				'IntegrationType',
				'IntegrationTenant',
				'IntegrationSetting',
				'IntegrationEntitySetting',
				'IssueType',
				'TaskView',
				'OrganizationProjectCreateCommand',
				'OrganizationProject',
				'OrganizationStrategicInitiative',
				'Comment',
				'Tag',
				'Task',
				'TaskStatus',
				'TaskPriority',
				'TaskService',
				'TaskCreateCommand',
				'TaskUpdateCommand'
			].map((name) => [name, entity(name)])
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null, runWithRequest: (_req: unknown, work: () => unknown) => work() }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { htmlToMarkdown, markdownToHtml, normaliseMarkdown } from './ever-works-markdown';
import {
	applySetChange,
	descriptionForEverWorks,
	edgesFromRows,
	LINKED_ISSUE,
	LinkedIssueRow,
	gauzyWins,
	labelsForEverWorks,
	stripTitleAppendix,
	titleForEverWorks,
	transitionBlockedMessage
} from './ever-works-task.mapper';
import { EverWorksRequestContextUnavailableError } from './ever-works-task.store';
import { EverWorksTasksService } from './ever-works-tasks.service';

describe('Markdown ↔ HTML', () => {
	it('renders what Ever Works writes, and safely', () => {
		expect(markdownToHtml('Serve `GET /events` with **keyset** paging.')).toBe('<p>Serve <code>GET /events</code> with <strong>keyset</strong> paging.</p>');
		expect(markdownToHtml('# Title\n\n- one\n- two\n  - nested')).toBe('<h1>Title</h1><ul><li>one</li><li><p>two</p><ul><li>nested</li></ul></li></ul>');
		expect(markdownToHtml('line one\nline two')).toBe('<p>line one<br>line two</p>');
		expect(markdownToHtml('<script>alert(1)</script> [x](javascript:alert(1))')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; [x](javascript:alert(1))</p>');
		expect(markdownToHtml('snake_case_name stays, _this_ is emphasis')).toBe('<p>snake_case_name stays, <em>this</em> is emphasis</p>');
		expect(markdownToHtml('```\nconst a = 1 < 2;\n```')).toBe('<pre><code>const a = 1 &lt; 2;</code></pre>');
		expect(markdownToHtml(null)).toBe('');
	});

	it('writes Gauzy editor HTML as Markdown, escaping what would read as markup', () => {
		const html =
			'<p>Hello <strong>world</strong>, <em>it</em> <a href="https://a.example" target="_blank">site</a></p><ul><li><p>one</p></li><li><p>two</p><ul><li><p>three</p></li></ul></li></ul><p># not a heading</p><p>2 * 3</p>';
		expect(htmlToMarkdown(html)).toBe('Hello **world**, *it* [site](https://a.example)\n\n- one\n- two\n  - three\n\n\\# not a heading\n\n2 \\* 3');
		expect(htmlToMarkdown('<p>x &lt; y &amp; <a href="javascript:alert(1)">no</a></p>')).toBe('x < y & no');
		expect(htmlToMarkdown('')).toBe('');
	});

	it('converts to itself again after one round trip (nothing flaps)', () => {
		for (const markdown of [
			'Plain text\nwith lines',
			'# Title\n\nSome **bold** and *it* text.\n\n1. a\n2. b\n\n> quote\n\n| a | b |\n| --- | --- |\n| 1 | 2 |',
			'Use `a_b` and [docs](https://docs.example/x)'
		]) {
			const once = htmlToMarkdown(markdownToHtml(markdown));
			expect(htmlToMarkdown(markdownToHtml(once))).toBe(once);
		}
		expect(normaliseMarkdown('a  \r\n\r\n\r\n\r\nb ')).toBe('a\n\nb');
	});
});

describe('task field rules', () => {
	it('cuts a long title to 200 and carries the full title in the description, which comes back without it', () => {
		const long = 'x'.repeat(250);
		const { title, truncated } = titleForEverWorks(long);
		expect(truncated).toBe(true);
		expect(title).toHaveLength(200);
		const description = descriptionForEverWorks('Body', long);
		expect(description).toBe(`Body\n\n> **Full title (from Gauzy):** ${long}`);
		expect(stripTitleAppendix(description)).toBe('Body');
		expect(titleForEverWorks('Short')).toEqual({ title: 'Short', truncated: false });
		expect(descriptionForEverWorks('Body', 'Short')).toBe('Body');
	});

	it('labels: trimmed, ≤ 80 characters, unique case-insensitively, at most 50', () => {
		expect(labelsForEverWorks([' Bug ', 'bug', 'y'.repeat(90), '', null])).toEqual(['Bug', 'y'.repeat(80)]);
		expect(labelsForEverWorks(Array.from({ length: 60 }, (_v, i) => `l${i}`))).toHaveLength(50);
	});

	it('applies one side’s set change onto the other side’s set, keeping what only the other side has', () => {
		expect(applySetChange(['a', 'b', 'x'], ['a', 'b'], ['b', 'c'])).toEqual(['b', 'x', 'c']);
		expect(applySetChange(['A'], ['a'], ['a'], (v) => v.toLowerCase())).toEqual(['A']);
	});

	it('last writer wins; a tie or a missing time goes to Ever Works', () => {
		expect(gauzyWins('2026-10-16T10:00:01Z', '2026-10-16T10:00:00Z')).toBe(true);
		expect(gauzyWins('2026-10-16T10:00:00Z', '2026-10-16T10:00:00Z')).toBe(false);
		expect(gauzyWins(null, '2026-10-16T10:00:00Z')).toBe(false);
		expect(gauzyWins('2026-10-16T10:00:00Z', null)).toBe(true);
	});

	it('reads blockers and relations from linked issues on either task of a pair', () => {
		const rows: LinkedIssueRow[] = [
			{ taskToId: 'x', taskFromId: 'y', action: LINKED_ISSUE.IS_BLOCKED_BY },
			{ taskToId: 'z', taskFromId: 'x', action: LINKED_ISSUE.BLOCKS },
			{ taskToId: 'x', taskFromId: 'r', action: LINKED_ISSUE.RELATES_TO },
			{ taskToId: 'd', taskFromId: 'x', action: LINKED_ISSUE.IS_DUPLICATED_BY },
			{ taskToId: 'x', taskFromId: 'c', action: 4 }
		];
		expect(edgesFromRows('x', rows)).toEqual({ blockedBy: ['y', 'z'], relations: ['duplicates:d', 'related:r'] });
		// z is the blocker in "z blocks x": nothing blocks z.
		expect(edgesFromRows('z', rows)).toEqual({ blockedBy: [], relations: [] });
	});

	it('says why Ever Works kept a status', () => {
		expect(transitionBlockedMessage('in_progress', 'done', { blockers: [{ slug: 'T-43' }], pendingApprovers: [{ id: 'u' }] })).toBe(
			'Ever Works kept the status "in_progress" instead of "done": blocked by T-43; 1 approval(s) pending.'
		);
	});
});

interface LinkRow {
	id: string;
	integrationTenantId: string;
	entityType: string;
	gauzyId: string;
	ewId: string;
	ewVersion: number | null;
	snapshot: string | null;
	ewOnly: string | null;
	state: string;
	lastError?: string | null;
}

type GauzyTask = Record<string, any>;

function setup(options: { directions?: Record<string, string>; settings?: Record<string, string> } = {}) {
	const mock = new MockEverWorksServer();
	const key = mock.addKey();
	const org = (mock.keys.get(key) as { organizations: Array<{ id: string; slug: string }> }).organizations[0] as { id: string; slug: string };
	const settings = { DEFAULT_PROJECT_ID: 'p-default', ...(options.settings ?? {}) };
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		connection: { id: 'c1', connectedByUserId: 'u-admin', ewTenantId: mock.tenant.id },
		everWorksOrganizationId: org.id,
		everWorksOrganizationSlug: org.slug,
		directions: { tasks: 'both', ...(options.directions ?? {}) },
		isEnabled: true,
		mapping: { id: 'm1', settings: Object.entries(settings).map(([settingsName, settingsValue]) => ({ settingsName, settingsValue })) }
	};
	const links: LinkRow[] = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.ewId === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.gauzyId === gauzyId) ?? null,
		list: async (m: string, type: string) => links.filter((l) => l.integrationTenantId === m && l.entityType === type),
		snapshot: (link: LinkRow | null) => (link?.snapshot ? JSON.parse(link.snapshot) : {}),
		record: async (input: Record<string, any>) => {
			const existing = links.find((l) => l.entityType === input['entityType'] && (l.ewId === input['ewId'] || l.gauzyId === input['gauzyId']));
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				ewVersion: input['ewVersion'] ?? null,
				snapshot: JSON.stringify(input['snapshot']),
				ewOnly: JSON.stringify(input['ewOnly']),
				state: EverWorksLinkState.OK
			};
			if (existing) Object.assign(existing, values);
			else links.push({ id: `l${links.length + 1}`, integrationTenantId: input['integrationTenantId'], entityType: input['entityType'], ...values });
		},
		unlink: async (link: LinkRow, reason: string) => Object.assign(link, { state: EverWorksLinkState.UNLINKED, lastError: reason })
	};
	const link = (type: EverWorksLinkType, gauzyId: string, ewId: string) =>
		links.push({ id: `x-${ewId}`, integrationTenantId: 'm1', entityType: type, gauzyId, ewId, ewVersion: null, snapshot: null, ewOnly: null, state: 'ok' });

	// ── Gauzy stand-ins ──
	const tasks = new Map<string, GauzyTask>();
	const tags = new Map<string, { id: string; name: string }>();
	const comments: Array<{ taskId: string; html: string; actorType: unknown }> = [];
	const subscriptions: Array<{ taskId: string; employeeId: string }> = [];
	const linkedIssues: LinkedIssueRow[] = [];
	const sameRow = (a: LinkedIssueRow, b: LinkedIssueRow) => a.taskToId === b.taskToId && a.taskFromId === b.taskFromId && a.action === b.action;
	const writes: Array<{ kind: 'create' | 'update' | 'delete'; id: string; input?: Record<string, any>; applying: boolean }> = [];
	const relate = (input: Record<string, any>, row: GauzyTask) => {
		for (const [field, value] of Object.entries(input)) {
			if (field === 'tags') row['tags'] = (value as Array<{ id: string }>).map(({ id }) => ({ id, name: [...tags.values()].find((t) => t.id === id)?.name }));
			else if (field === 'members' || field === 'teams') row[field] = (value as Array<{ id: string }>).map(({ id }) => ({ id }));
			else row[field] = value;
		}
		row['taskStatus'] = row['status'] ? { value: row['status'] } : null;
		row['taskPriority'] = row['priority'] ? { value: row['priority'] } : null;
		row['updatedAt'] = new Date();
	};
	const store = {
		asActor: async (_scope: unknown, _actor: unknown, work: () => Promise<unknown>) => work(),
		load: async (_tenantId: string, id: string) => (tasks.has(id) ? { ...(tasks.get(id) as GauzyTask) } : null),
		create: async (input: Record<string, any>) => {
			const id = `g-task-${tasks.size + 1}`;
			const row: GauzyTask = { id, tenantId: 't1', organizationId: 'o1', members: [], teams: [], tags: [], createdAt: new Date() };
			relate(input, row);
			tasks.set(id, row);
			writes.push({ kind: 'create', id, input, applying: EverWorksSyncContext.isApplying() });
			return id;
		},
		update: async (id: string, input: Record<string, any>) => {
			relate(input, tasks.get(id) as GauzyTask);
			writes.push({ kind: 'update', id, input, applying: EverWorksSyncContext.isApplying() });
		},
		softDelete: async (id: string) => {
			(tasks.get(id) as GauzyTask)['deletedAt'] = new Date();
			writes.push({ kind: 'delete', id, applying: EverWorksSyncContext.isApplying() });
		},
		statusFor: async (_scope: unknown, _status: string, slug: string) => ({ value: slug, id: null }),
		priorityFor: async (_scope: unknown, slug: string) => ({ value: slug, id: null }),
		ensureTags: async (_t: string, _o: string, names: string[]) =>
			names.map((name) => {
				const k = name.toLowerCase();
				if (!tags.has(k)) tags.set(k, { id: `tag-${k}`, name });
				return tags.get(k) as { id: string; name: string };
			}),
		addComment: async (_scope: unknown, taskId: string, html: string, actorType: unknown) => void comments.push({ taskId, html, actorType }),
		userOfEmployee: async (employeeId: string) => ({ userId: `user-of-${employeeId}`, name: 'Someone' }),
		employeeOfUser: async (_t: string, _o: string, userId: string) => (userId === 'u-alice' ? 'e-alice' : null),
		projectExists: async (_t: string, _o: string, projectId: string) => ['p-default', 'p-site'].includes(projectId),
		initiativeProjects: async () => [],
		isSelfOrAncestor: async (taskId: string, parentId: string) => taskId === parentId,
		watchersOf: async (_t: string, ids: string[]) =>
			new Map(ids.map((id) => [id, subscriptions.filter((row) => row.taskId === id).map((row) => row.employeeId).sort()])),
		addWatcher: async (_s: unknown, taskId: string, employeeId: string) => {
			if (!subscriptions.some((row) => row.taskId === taskId && row.employeeId === employeeId)) subscriptions.push({ taskId, employeeId });
		},
		removeWatcher: async (_t: string, taskId: string, employeeId: string) => {
			const at = subscriptions.findIndex((row) => row.taskId === taskId && row.employeeId === employeeId);
			if (at >= 0) subscriptions.splice(at, 1);
		},
		edgesOf: async (_t: string, ids: string[]) => new Map(ids.map((id) => [id, edgesFromRows(id, linkedIssues)])),
		ensureLinkedIssues: async (_s: unknown, rows: LinkedIssueRow[]) => {
			for (const row of rows) if (!linkedIssues.some((existing) => sameRow(existing, row))) linkedIssues.push({ ...row });
		},
		deleteLinkedIssues: async (_t: string, rows: LinkedIssueRow[]) => {
			for (const row of rows) {
				const at = linkedIssues.findIndex((existing) => sameRow(existing, row));
				if (at >= 0) linkedIssues.splice(at, 1);
			}
		}
	};
	const addGauzyTask = (row: GauzyTask) => {
		const full: GauzyTask = { tenantId: 't1', organizationId: 'o1', members: [], teams: [], tags: [], status: 'open', priority: 'medium', createdAt: new Date(), ...row };
		full['taskStatus'] = full['status'] ? { value: full['status'] } : null;
		full['taskPriority'] = full['priority'] ? { value: full['priority'] } : null;
		tasks.set(full['id'], full);
		return full;
	};
	const queue = { enqueued: [] as Array<Record<string, unknown>>, enqueue: async (trigger: Record<string, unknown>) => void queue.enqueued.push(trigger) };
	const logged: Array<Record<string, unknown>> = [];
	const log = { write: async (entry: Record<string, unknown>) => void logged.push(entry) };
	const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context, forConnection: async () => [context] };
	const client = new EverWorksClient({
		apiBaseUrl: 'http://mock.test/api',
		apiKey: key,
		transport: mock.transport(),
		connectionId: 'c1',
		scopeSlug: org.slug,
		allowInsecureBaseUrlForTests: true,
		retry: { maxAttempts: 1 }
	});
	const connections = { client: () => client };
	const mappings = { ensureProjectForSync: async () => 'p-default' };
	const service = new EverWorksTasksService(contexts as never, connections as never, linkService as never, queue as never, store as never, mappings as never, log as never);
	const applyContext = { connection: context.connection, event: {}, organizationId: 'o1' };
	/** Runs an Ever Works event through the handler as the inbound applier does (inside the sync context). */
	const deliver = (event: { type: string; data: Record<string, unknown>; aggregate: { id: string; version: number }; actor?: Record<string, unknown>; occurredAt?: string }) =>
		EverWorksSyncContext.run({ connectionId: 'c1' }, () =>
			service.apply(
				{
					id: `evt-${Math.random()}`,
					seq: '1',
					version: 1,
					occurredAt: event.occurredAt ?? new Date().toISOString(),
					tenantId: mock.tenant.id,
					organizationId: org.id,
					aggregate: { type: 'task', ...event.aggregate },
					actor: event.actor ?? { type: 'user', id: 'ew-bob' },
					type: event.type,
					data: event.data
				} as never,
				applyContext as never
			)
		);
	const push = (gauzyId: string, op: 'upsert' | 'delete' = 'upsert', actorUserId: string | null = null) =>
		service.push({ tenantId: 't1', organizationId: 'o1', integrationTenantId: 'm1', entityType: EverWorksLinkType.TASK, gauzyId, op, actorUserId, attempts: 0 } as never, {
			connection: context.connection,
			mapping: { id: 'm1' }
		} as never);
	return { mock, org, context, links, link, tasks, tags, comments, writes, addGauzyTask, queue, logged, service, deliver, push, subscriptions, linkedIssues };
}

describe('EW → G tasks', () => {
	it('creates the Gauzy task in the default project with its fields, scope, members and tags, and links back', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team', 'ew-team');
		t.link(EverWorksLinkType.AGENT, 'e-agent', 'ew-agent');
		const task = t.mock.addTask(t.org.id, {
			title: 'Ship it',
			description: 'Do **this**.',
			status: 'in_review',
			priority: 'p1',
			labels: ['Backend'],
			teamIds: ['ew-team', 'ew-team-unknown'],
			assignees: [{ type: 'agent', id: 'ew-agent' }, { type: 'user', id: 'ew-nobody' }],
			visibility: 'team'
		});
		const outcome = await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		expect(outcome).toEqual({ status: 'applied' });
		const created = t.tasks.get('g-task-1') as GauzyTask;
		expect(created).toMatchObject({ title: 'Ship it', description: '<p>Do <strong>this</strong>.</p>', status: 'in-review', priority: 'high', projectId: 'p-default' });
		expect(created['teams']).toEqual([{ id: 'g-team' }]);
		expect(created['members']).toEqual([{ id: 'e-agent' }]);
		expect(created['tags']).toEqual([{ id: 'tag-backend', name: 'Backend' }]);
		// Written as the sync (loop guard level 1): nothing of it is captured as a Gauzy change.
		expect(t.writes.every((write) => write.applying)).toBe(true);
		const link = t.links.find((l) => l.entityType === EverWorksLinkType.TASK) as LinkRow;
		expect(link).toMatchObject({ gauzyId: 'g-task-1', ewId: task['id'], ewVersion: 1 });
		expect(JSON.parse(link.ewOnly as string)).toMatchObject({ unmappedTeams: ['ew-team-unknown'], unmappedAssignees: ['user:ew-nobody'] });
		// Ever Works shows the Gauzy task (PUT /links).
		expect(t.mock.links).toEqual([expect.objectContaining({ entityType: 'task', entityId: task['id'], source: 'gauzy', externalId: 'g-task-1' })]);
	});

	it('lands in the project of the linked work (plan 01 §7.2)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.PROJECT_WORK, 'p-site', 'ew-work');
		const task = t.mock.addTask(t.org.id, { title: 'In a work', workId: 'ew-work' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		expect((t.tasks.get('g-task-1') as GauzyTask)['projectId']).toBe('p-site');
	});

	it('never syncs a private task, a recurring template, or (by default) a triage task', async () => {
		const t = setup();
		for (const extra of [{ visibility: 'private' }, { isRecurringTemplate: true }, { hiddenFromBoard: true }]) {
			const task = t.mock.addTask(t.org.id, extra);
			expect((await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } })).status).toBe('skipped');
		}
		expect(t.tasks.size).toBe(0);
	});

	it('writes only what Ever Works changed; p2 ↔ p3 (both "medium") writes nothing', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Priority', priority: 'p2' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		t.writes.length = 0;
		await t.deliver({ type: 'task.updated', data: { ...task, priority: 'p3' }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(t.writes).toEqual([]);
		// A Gauzy edit not pushed yet is not overwritten by an unrelated Ever Works change.
		(t.tasks.get('g-task-1') as GauzyTask)['title'] = 'Renamed in Gauzy';
		await t.deliver({ type: 'task.updated', data: { ...task, priority: 'p3', labels: ['new'] }, aggregate: { id: task['id'] as string, version: 3 } });
		expect(t.tasks.get('g-task-1')).toMatchObject({ title: 'Renamed in Gauzy', tags: [{ id: 'tag-new', name: 'new' }] });
		// An event at or below the link's version is skipped.
		expect(await t.deliver({ type: 'task.updated', data: task, aggregate: { id: task['id'] as string, version: 3 } })).toEqual({ status: 'skipped', message: 'already applied (version)' });
	});

	it('both sides changed the title: the later writer wins and the conflict is logged', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Original' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		Object.assign(t.tasks.get('g-task-1') as GauzyTask, { title: 'Gauzy title', updatedAt: new Date('2026-10-16T12:00:00Z') });
		await t.deliver({ type: 'task.updated', data: { ...task, title: 'EW title' }, aggregate: { id: task['id'] as string, version: 2 }, occurredAt: '2026-10-16T11:00:00Z' });
		expect((t.tasks.get('g-task-1') as GauzyTask)['title']).toBe('Gauzy title');
		expect(t.logged).toEqual([expect.objectContaining({ action: 'conflict:title', status: 'conflict' })]);
		// Gauzy's value goes out.
		expect(t.queue.enqueued).toEqual([expect.objectContaining({ gauzyId: 'g-task-1', entityType: EverWorksLinkType.TASK })]);
	});

	it('a task that turns private stops syncing; one deleted in Ever Works is soft-deleted in Gauzy', async () => {
		const t = setup();
		const a = t.mock.addTask(t.org.id, { title: 'A' });
		const b = t.mock.addTask(t.org.id, { title: 'B' });
		await t.deliver({ type: 'task.created', data: a, aggregate: { id: a['id'] as string, version: 1 } });
		await t.deliver({ type: 'task.created', data: b, aggregate: { id: b['id'] as string, version: 1 } });
		await t.deliver({ type: 'task.visibility_changed', data: { id: a['id'], visibility: 'private' }, aggregate: { id: a['id'] as string, version: 2 } });
		expect(t.links.find((l) => l.ewId === a['id'])?.state).toBe(EverWorksLinkState.UNLINKED);
		expect(t.tasks.get('g-task-1')).toBeDefined();
		await t.deliver({ type: 'task.deleted', data: { ...b, deleted: true }, aggregate: { id: b['id'] as string, version: 2 } });
		expect((t.tasks.get('g-task-2') as GauzyTask)['deletedAt']).toBeInstanceOf(Date);
		expect(t.links.find((l) => l.ewId === b['id'])?.state).toBe(EverWorksLinkState.UNLINKED);
	});

	it('a child event reads the task again and applies it whole', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		const task = t.mock.addTask(t.org.id, { title: 'Edges' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		Object.assign(task, { assignees: [{ type: 'user', id: 'ew-bob' }], version: 2 });
		await t.deliver({ type: 'task.assignee.added', data: { taskId: task['id'], type: 'user', id: 'ew-bob' }, aggregate: { id: task['id'] as string, version: 2 } });
		expect((t.tasks.get('g-task-1') as GauzyTask)['members']).toEqual([{ id: 'e-bob' }]);
	});

	it('a process without a request context defers instead of writing', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'No context' });
		(t.service as unknown as { store: { asActor: () => Promise<never> } }).store.asActor = async () => {
			throw new EverWorksRequestContextUnavailableError();
		};
		expect(await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } })).toMatchObject({ status: 'deferred' });
	});
});

describe('G → EW tasks', () => {
	it('creates the Ever Works task with an externalRef, its scope and a transition past todo', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team', 'ew-team');
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'From Gauzy', description: '<p>Hello <em>there</em></p>', status: 'in-progress', priority: 'urgent', teams: [{ id: 'g-team' }], members: [{ id: 'e-alice' }], tags: [{ name: 'Ops' }] });
		expect(await t.push('g1', 'upsert', 'u-alice')).toEqual({ status: 'pushed', message: 'created in Ever Works' });
		const [created] = [...t.mock.tasks.values()];
		expect(created).toMatchObject({
			title: 'From Gauzy',
			description: 'Hello *there*',
			status: 'in_progress',
			priority: 'p0',
			labels: ['Ops'],
			teamIds: ['ew-team'],
			visibility: 'team',
			assignees: [{ type: 'user', id: 'ew-alice' }]
		});
		const post = t.mock.requests.find((r) => r.method === 'POST' && r.path === '/tasks');
		expect(post?.headers['idempotency-key']).toMatch(/^[0-9a-f]{64}$/);
		expect(post?.headers['x-act-as-user']).toBe('ew-alice');
		expect(post?.body).toMatchObject({ status: 'todo', externalRef: { source: 'gauzy', installationId: 'c1', externalId: 'g1' } });
		expect(t.links.find((l) => l.gauzyId === 'g1')).toMatchObject({ ewId: created?.['id'], ewVersion: created?.['version'] });
		// Pushing again with nothing changed sends nothing (loop guard level 2).
		const before = t.mock.requests.length;
		expect(await t.push('g1')).toEqual({ status: 'skipped', message: 'nothing changed' });
		expect(t.mock.requests.length).toBe(before);
	});

	it('waits for an unlinked team instead of going out organization-wide', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Scoped', teams: [{ id: 'g-team-unlinked' }] });
		expect(await t.push('g1')).toMatchObject({ status: 'deferred', message: 'the team g-team-unlinked is not linked to Ever Works yet' });
		expect(t.mock.tasks.size).toBe(0);
	});

	it('patches only what Gauzy changed, with If-Match, and moves the status through /transition', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Before' });
		await t.push('g1');
		Object.assign(t.tasks.get('g1') as GauzyTask, { title: 'After', status: 'done', taskStatus: { value: 'done' } });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		const patch = t.mock.requests.filter((r) => r.method === 'PATCH');
		expect(patch).toHaveLength(1);
		expect(patch[0]?.body).toEqual({ title: 'After' });
		expect(patch[0]?.headers['if-match']).toMatch(/^"\d+"$/);
		expect(t.mock.requests.some((r) => r.method === 'POST' && r.path.endsWith('/transition') && (r.body as Record<string, unknown>)['to'] === 'done')).toBe(true);
		expect([...t.mock.tasks.values()][0]).toMatchObject({ title: 'After', status: 'done' });
	});

	it('409 transition_blocked: Gauzy takes Ever Works’ status back and says why', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Gated' });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		t.mock.transitionGates.set(ew?.['id'] as string, { blocked: ['done'], blockers: [{ slug: 'T-9' }] });
		Object.assign(t.tasks.get('g1') as GauzyTask, { status: 'done', taskStatus: { value: 'done' } });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect((t.tasks.get('g1') as GauzyTask)['status']).toBe('open');
		expect(t.comments).toEqual([expect.objectContaining({ taskId: 'g1', html: expect.stringContaining('blocked by T-9') })]);
		// The revert is written as the sync: it is not pushed back.
		expect(t.writes.filter((w) => w.kind === 'update').every((w) => w.applying)).toBe(true);
		expect(t.logged).toEqual([expect.objectContaining({ action: 'conflict:resolved-by-ew' })]);
	});

	it('412: Ever Works’ newer state is merged first, then the Gauzy change is sent', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Base', description: '<p>one</p>' });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		// Ever Works edits the description meanwhile (version moves on); Gauzy edits the title.
		Object.assign(ew as Record<string, unknown>, { description: 'two', version: Number(ew?.['version']) + 1, updatedAt: '2026-10-16T09:00:00Z' });
		Object.assign(t.tasks.get('g1') as GauzyTask, { title: 'Renamed', updatedAt: new Date('2026-10-16T10:00:00Z') });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(t.mock.requests.filter((r) => r.method === 'PATCH').map((r) => r.headers['if-match'])).toHaveLength(2);
		expect(t.tasks.get('g1')).toMatchObject({ title: 'Renamed', description: '<p>two</p>' });
		expect(ew).toMatchObject({ title: 'Renamed', description: 'two' });
	});

	it('a Gauzy delete cancels the Ever Works task with a comment and stops syncing', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Doomed' });
		await t.push('g1');
		(t.tasks.get('g1') as GauzyTask)['deletedAt'] = new Date();
		expect(await t.push('g1', 'delete')).toEqual({ status: 'pushed', message: 'cancelled in Ever Works (delete policy)' });
		const [ew] = [...t.mock.tasks.values()];
		expect(ew?.['status']).toBe('cancelled');
		expect([...t.mock.comments.values()]).toEqual([expect.objectContaining({ authorType: 'integration', body: expect.stringContaining('deleted in Ever Gauzy') })]);
		expect(t.links.find((l) => l.gauzyId === 'g1')?.state).toBe(EverWorksLinkState.UNLINKED);
	});

	it('ideas and (with the setting off) tasks of unlinked projects are not pushed', async () => {
		const t = setup({ settings: { SYNC_UNLINKED_PROJECT_TASKS: 'false' } });
		t.addGauzyTask({ id: 'g1', title: 'An idea', issueType: 'Idea' });
		t.addGauzyTask({ id: 'g2', title: 'Unlinked', projectId: 'p-other' });
		expect((await t.push('g1')).status).toBe('skipped');
		expect((await t.push('g2')).status).toBe('skipped');
		expect(t.mock.tasks.size).toBe(0);
	});

	it('a long title goes out cut, with the full title in the description', async () => {
		const t = setup();
		const long = 'L'.repeat(230);
		t.addGauzyTask({ id: 'g1', title: long, description: '<p>Body</p>' });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		expect((ew?.['title'] as string).length).toBe(200);
		expect(ew?.['description']).toBe(`Body\n\n> **Full title (from Gauzy):** ${long}`);
	});
});

describe('task watchers and linked issues (G-P1-9, 2/3)', () => {
	it('EW watchers become manual subscriptions; EW blockers and relations become pairs on both Gauzy tasks', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		const blocker = t.mock.addTask(t.org.id, { title: 'Blocker' });
		const related = t.mock.addTask(t.org.id, { title: 'Related' });
		await t.deliver({ type: 'task.created', data: blocker, aggregate: { id: blocker['id'] as string, version: 1 } });
		await t.deliver({ type: 'task.created', data: related, aggregate: { id: related['id'] as string, version: 1 } });
		const task = t.mock.addTask(t.org.id, {
			title: 'Blocked',
			watchers: ['ew-bob', 'ew-unknown'],
			blockedBy: [blocker['id']],
			relations: [{ taskId: related['id'], kind: 'follow-up' }]
		});
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		// g-task-1 = Blocker, g-task-2 = Related, g-task-3 = Blocked.
		expect(t.subscriptions).toEqual([{ taskId: 'g-task-3', employeeId: 'e-bob' }]);
		expect(t.linkedIssues).toEqual(
			expect.arrayContaining([
				{ taskToId: 'g-task-3', taskFromId: 'g-task-1', action: LINKED_ISSUE.IS_BLOCKED_BY },
				{ taskToId: 'g-task-1', taskFromId: 'g-task-3', action: LINKED_ISSUE.BLOCKS },
				{ taskToId: 'g-task-3', taskFromId: 'g-task-2', action: LINKED_ISSUE.RELATES_TO },
				{ taskToId: 'g-task-2', taskFromId: 'g-task-3', action: LINKED_ISSUE.RELATES_TO }
			])
		);
		const ewOnly = JSON.parse(t.links.find((l) => l.gauzyId === 'g-task-3')?.ewOnly as string);
		expect(ewOnly.unmappedWatchers).toEqual(['ew-unknown']);
		// The pair row on "Related" mirrors Ever Works: it is in that task's snapshot, so pushing it sends nothing.
		const before = t.mock.requests.length;
		expect(await t.push('g-task-2')).toEqual({ status: 'skipped', message: 'nothing changed' });
		expect(t.mock.requests.length).toBe(before);
		// Removing the blocker in Ever Works removes both rows of the pair.
		await t.deliver({ type: 'task.updated', data: { ...task, blockedBy: [] }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(t.linkedIssues.some((row) => row.action === LINKED_ISSUE.IS_BLOCKED_BY || row.action === LINKED_ISSUE.BLOCKS)).toBe(false);
	});

	it('pushes Gauzy watcher and blocker changes as Ever Works sets', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g-blocker', title: 'Blocker' });
		t.addGauzyTask({ id: 'g1', title: 'Work' });
		await t.push('g-blocker');
		await t.push('g1');
		const ewBlocker = [...t.mock.tasks.values()].find((row) => row['title'] === 'Blocker') as Record<string, unknown>;
		const ewTask = [...t.mock.tasks.values()].find((row) => row['title'] === 'Work') as Record<string, unknown>;
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		// One row, written the Ever Teams way: "the blocker blocks g1".
		t.linkedIssues.push({ taskToId: 'g-blocker', taskFromId: 'g1', action: LINKED_ISSUE.BLOCKS });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(ewTask).toMatchObject({ watchers: ['ew-alice'], blockedBy: [ewBlocker['id']] });
		const puts = t.mock.requests.filter((r) => r.method === 'PUT').map((r) => r.path.split('/').pop());
		expect(puts).toEqual(['watchers', 'blocks']);
	});

	it('an edge to a task not in Ever Works yet queues that task and goes out once it is linked', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g-other', title: 'Other' });
		t.addGauzyTask({ id: 'g1', title: 'Work' });
		t.linkedIssues.push({ taskToId: 'g1', taskFromId: 'g-other', action: LINKED_ISSUE.RELATES_TO });
		await t.push('g1');
		expect(t.queue.enqueued).toEqual([expect.objectContaining({ gauzyId: 'g-other' })]);
		expect(JSON.parse(t.links.find((l) => l.gauzyId === 'g1')?.ewOnly as string).pendingEdges).toEqual(['related:g-other']);
		await t.push('g-other');
		// The sweep sees the pending edge can go out now and queues the task; its push sends the relation.
		t.queue.enqueued.length = 0;
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued).toEqual([expect.objectContaining({ gauzyId: 'g1' })]);
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		const ewOther = [...t.mock.tasks.values()].find((row) => row['title'] === 'Other') as Record<string, unknown>;
		expect([...t.mock.tasks.values()].find((row) => row['title'] === 'Work')).toMatchObject({ relations: [{ taskId: ewOther['id'], kind: 'related' }] });
	});

	it('the sweep queues a task whose watchers changed without a captured event (a bulk delete)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Watched' });
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		await t.push('g1');
		t.queue.enqueued.length = 0;
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued).toEqual([]);
		t.subscriptions.length = 0;
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued).toEqual([expect.objectContaining({ gauzyId: 'g1' })]);
	});
});
