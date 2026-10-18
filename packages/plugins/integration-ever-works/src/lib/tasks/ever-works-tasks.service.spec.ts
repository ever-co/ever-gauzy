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
		ExportRedacted: decorator,
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
	estimateMinutesFor,
	estimateSecondsFor,
	isoOrNull,
	LINKED_ISSUE,
	LinkedIssueRow,
	gauzyWins,
	isCutTitleCopy,
	labelsForEverWorks,
	stripTitleAppendix,
	titleForEverWorks,
	transitionBlockedMessage
} from './ever-works-task.mapper';
import { commentBodyForEverWorks, EverWorksTaskCommentsService } from './ever-works-task-comments.service';
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

	it('stays linear on crafted input (unmatched emphasis, backticks and brackets; ReDoS)', () => {
		for (const unit of ['*a ', '_a ', '`a ', '[a ', '**a ', '~~a ']) {
			const started = Date.now();
			markdownToHtml(unit.repeat(6500));
			markdownToHtml(`${unit.repeat(300)}\n`.repeat(60));
			expect(Date.now() - started).toBeLessThan(2000);
		}
		// A line longer than the inline limit is written as plain text.
		expect(markdownToHtml(`**${'x'.repeat(25_000)}**`)).toBe(`<p>**${'x'.repeat(25_000)}**</p>`);
	});

	it('writes Gauzy editor HTML as Markdown, escaping what would read as markup', () => {
		const html =
			'<p>Hello <strong>world</strong>, <em>it</em> <a href="https://a.example" target="_blank">site</a></p><ul><li><p>one</p></li><li><p>two</p><ul><li><p>three</p></li></ul></li></ul><p># not a heading</p><p>2 * 3</p>';
		expect(htmlToMarkdown(html)).toBe('Hello **world**, *it* [site](https://a.example)\n\n- one\n- two\n  - three\n\n\\# not a heading\n\n2 \\* 3');
		expect(htmlToMarkdown('<p>x &lt; y &amp; <a href="javascript:alert(1)">no</a></p>')).toBe('x < y & no');
		expect(htmlToMarkdown('')).toBe('');
	});

	it('parses raw Gauzy HTML in linear time: unclosed tags and comments (ReDoS, review F20)', () => {
		// Comments are stored unsanitized; '<a <a <a …' with no '>' made the tokenizer quadratic (60 KB ≈ 6 s).
		for (const unit of ['<a ', '<a x="1" <a ', '<!--', '<a href=x ']) {
			const started = Date.now();
			const markdown = htmlToMarkdown(unit.repeat(20_000));
			expect(Date.now() - started).toBeLessThan(2000);
			expect(typeof markdown).toBe('string');
		}
		// Unclosed tags are text; a '<' inside a quoted value is still a value; an unclosed comment runs to the end.
		expect(htmlToMarkdown('<p>1 <a 2 <b>bold</b></p>')).toBe('1 \\<a 2 **bold**');
		expect(htmlToMarkdown('<p><a href="https://a.example" title="a <b> c">site</a></p>')).toBe('[site](https://a.example)');
		expect(htmlToMarkdown('<p>kept</p><!-- hidden <p>gone</p>')).toBe('kept');
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

	it('knows a title Ever Works still has as the cut copy of the full title in its description (#11108 review)', () => {
		const long = `${'x'.repeat(150)}  two  spaces ${'y'.repeat(100)}`;
		const description = descriptionForEverWorks('Body', long);
		expect(isCutTitleCopy(titleForEverWorks(long).title, description)).toBe(true);
		expect(isCutTitleCopy('Renamed', description)).toBe(false);
		expect(isCutTitleCopy(titleForEverWorks('z'.repeat(250)).title, description)).toBe(false);
		expect(isCutTitleCopy(titleForEverWorks(long).title, 'Body')).toBe(false);
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
	ewUpdatedAt?: string | Date | null;
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
			// Like the real link service: only the fields given are written.
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				...(input['ewVersion'] !== undefined ? { ewVersion: input['ewVersion'] ?? null } : {}),
				...(input['snapshot'] !== undefined ? { snapshot: JSON.stringify(input['snapshot']) } : {}),
				...(input['ewOnly'] !== undefined ? { ewOnly: JSON.stringify(input['ewOnly']) } : {}),
				...(input['ewUpdatedAt'] !== undefined ? { ewUpdatedAt: input['ewUpdatedAt'] } : {}),
				state: EverWorksLinkState.OK
			};
			if (existing) Object.assign(existing, values);
			else links.push({ id: `l${links.length + 1}`, integrationTenantId: input['integrationTenantId'], entityType: input['entityType'], ewVersion: null, snapshot: null, ewOnly: null, ...values });
		},
		unlink: async (link: LinkRow, reason: string) => Object.assign(link, { state: EverWorksLinkState.UNLINKED, lastError: reason }),
		markOrphaned: async (link: LinkRow, reason: string) => {
			if (link.state === EverWorksLinkState.OK) Object.assign(link, { state: EverWorksLinkState.ORPHANED, lastError: reason });
		}
	};
	const link = (type: EverWorksLinkType, gauzyId: string, ewId: string) =>
		links.push({ id: `x-${ewId}`, integrationTenantId: 'm1', entityType: type, gauzyId, ewId, ewVersion: null, snapshot: null, ewOnly: null, state: 'ok' });

	// ── Gauzy stand-ins ──
	const tasks = new Map<string, GauzyTask>();
	const tags = new Map<string, { id: string; name: string }>();
	const comments: Array<{
		id: string;
		taskId: string;
		html: string;
		actorType: unknown;
		employeeId: string | null;
		deletedAt?: Date | null;
		createdByUserId?: string | null;
		updatedByUserId?: string | null;
		deletedByUserId?: string | null;
	}> = [];
	const resourceLinks: Array<{ id: string; taskId: string; title: string; url: string }> = [];
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
		organizationOfTask: async (_tenantId: string, id: string) => (tasks.get(id)?.['organizationId'] as string | undefined) ?? null,
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
		addComment: async (_scope: unknown, taskId: string, html: string, actorType: unknown, employeeId: string | null = null) => {
			const id = `g-comment-${comments.length + 1}`;
			comments.push({ id, taskId, html, actorType, employeeId });
			return id;
		},
		loadComment: async (_t: string, id: string) => {
			const row = comments.find((comment) => comment.id === id);
			return row
				? {
						id: row.id,
						comment: row.html,
						entity: 'Task',
						entityId: row.taskId,
						organizationId: 'o1',
						employeeId: row.employeeId,
						deletedAt: row.deletedAt ?? null,
						createdByUserId: row.createdByUserId ?? null,
						updatedByUserId: row.updatedByUserId ?? null,
						deletedByUserId: row.deletedByUserId ?? null
					}
				: null;
		},
		updateComment: async (id: string, html: string) => void Object.assign(comments.find((comment) => comment.id === id) as object, { html }),
		softDeleteComment: async (id: string) => void Object.assign(comments.find((comment) => comment.id === id) as object, { deletedAt: new Date() }),
		removeResourceLink: async (_t: string, id: string) => {
			const at = resourceLinks.findIndex((row) => row.id === id);
			if (at >= 0) resourceLinks.splice(at, 1);
		},
		upsertResourceLink: async (_s: unknown, taskId: string, title: string, url: string, known: { id: string; owned: boolean } | null) => {
			const row = known ? resourceLinks.find((link) => link.id === known.id) : undefined;
			if (row && known) {
				if (known.owned) Object.assign(row, { title, url });
				if (known.owned || row.url === url) return known;
			}
			const same = resourceLinks.find((link) => link.taskId === taskId && link.url === url);
			if (same) return { id: same.id, owned: false };
			const id = `g-link-${resourceLinks.length + 1}`;
			resourceLinks.push({ id, taskId, title, url });
			return { id, owned: true };
		},
		userOfEmployee: async (employeeId: string) => ({ userId: `user-of-${employeeId}`, name: 'Someone' }),
		employeeOfUser: async (_t: string, _o: string, userId: string) => ({ 'u-alice': 'e-alice', 'u-bob': 'e-bob' })[userId] ?? null,
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
		presentTaskIds: async (_t: string, ids: string[]) => new Set(ids.filter((id) => tasks.has(id) && !(tasks.get(id) as GauzyTask)['deletedAt'])),
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
	// Like the real queue, `enqueue` says whether the change was queued (the orphan sweep marks a link only then).
	const queue = {
		enqueued: [] as Array<Record<string, unknown>>,
		enqueue: async (trigger: Record<string, unknown>): Promise<boolean> => {
			queue.enqueued.push(trigger);
			return true;
		}
	};
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
	const comments$ = new EverWorksTaskCommentsService(contexts as never, connections as never, linkService as never, queue as never, store as never, log as never);
	const service = new EverWorksTasksService(contexts as never, connections as never, linkService as never, queue as never, store as never, mappings as never, log as never, comments$);
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
	const pushComment = (gauzyId: string, op: 'upsert' | 'delete' = 'upsert', actorUserId: string | null = null, extra: Record<string, unknown> = {}) =>
		comments$.push({ tenantId: 't1', organizationId: 'o1', integrationTenantId: 'm1', entityType: EverWorksLinkType.COMMENT, gauzyId, op, actorUserId, attempts: 0, ...extra } as never, {
			connection: context.connection,
			mapping: { id: 'm1' }
		} as never);
	return {
		mock,
		org,
		context,
		links,
		link,
		tasks,
		tags,
		comments,
		resourceLinks,
		writes,
		addGauzyTask,
		queue,
		logged,
		service,
		deliver,
		push,
		pushComment,
		commentsService: comments$,
		subscriptions,
		linkedIssues
	};
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

	it('an Ever Works label change keeps the task\u2019s team-scoped tags instead of organization copies (review F83)', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Tagged', labels: ['Bug'] });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		// The task's "Bug" is a team-scoped Gauzy tag (the resolver of new names never picks one).
		(t.tasks.get('g-task-1') as GauzyTask)['tags'] = [{ id: 'team-bug', name: 'Bug' }];
		await t.deliver({ type: 'task.updated', data: { ...task, labels: ['Bug', 'UI'] }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(((t.tasks.get('g-task-1') as GauzyTask)['tags'] as Array<{ id: string }>).map((tag) => tag.id).sort()).toEqual(['tag-ui', 'team-bug']);
	});

	it('a task Gauzy created whose link was lost is linked back without taking Ever Works\u2019 lossy copy; the push sends the Gauzy values (review F81)', async () => {
		const t = setup();
		const title = 'T'.repeat(250);
		t.addGauzyTask({ id: 'g1', title, status: 'in-progress' });
		// The create reached Ever Works (a cut title, still todo: the transition never ran) but its answer was lost.
		const ew = t.mock.addTask(t.org.id, { title: `${'T'.repeat(199)}\u2026`, status: 'todo' });
		const own = [{ source: 'gauzy', installationId: 'c1', externalId: 'g1', externalUrl: null }];
		expect(await t.deliver({ type: 'task.created', data: { ...ew, externalLinks: own }, aggregate: { id: ew['id'] as string, version: 1 } })).toMatchObject({
			status: 'applied'
		});
		expect(t.tasks.get('g1')).toMatchObject({ title, status: 'in-progress' });
		expect(t.writes.filter((write) => write.id === 'g1')).toEqual([]);
		expect(t.links.find((l) => l.gauzyId === 'g1')).toMatchObject({ ewId: ew['id'] });
		expect(t.queue.enqueued).toContainEqual(expect.objectContaining({ entityType: EverWorksLinkType.TASK, gauzyId: 'g1', op: 'upsert' }));
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(ew['status']).toBe('in_progress');
		expect(t.mock.tasks.size).toBe(1);
	});

	it('tasks synced one way from Ever Works: a task adopted back takes Ever Works’ change at once, and keeps its full title (#11096 review)', async () => {
		const t = setup({ directions: { tasks: 'ew_to_gauzy' } });
		const title = 'T'.repeat(250);
		t.addGauzyTask({ id: 'g1', title, description: '<p>Old</p>', status: 'in-progress', priority: 'medium' });
		// Gauzy created it (cut title, full title in the description) and lost the answer; Ever Works edited it since.
		const ew = t.mock.addTask(t.org.id, {
			title: `${'T'.repeat(199)}…`,
			description: descriptionForEverWorks('Edited in Ever Works', title),
			status: 'done',
			priority: 'p1',
			labels: ['Ops']
		});
		const own = [{ source: 'gauzy', installationId: 'c1', externalId: 'g1', externalUrl: null }];
		const event = { type: 'task.updated', data: { ...ew, externalLinks: own }, aggregate: { id: ew['id'] as string, version: 4 } };
		const outcome = await t.deliver(event);
		expect(t.tasks.get('g1')).toMatchObject({ title, description: '<p>Edited in Ever Works</p>', status: 'done', priority: 'high', tags: [{ id: 'tag-ops', name: 'Ops' }] });
		expect(outcome).toEqual({ status: 'applied' });
		expect(t.links.find((l) => l.gauzyId === 'g1')).toMatchObject({ ewId: ew['id'], ewVersion: 4 });
		// Nothing is left to a push this direction never sends; the same delivery again has nothing left to apply.
		expect(t.queue.enqueued).toEqual([]);
		expect(await t.deliver(event)).toEqual({ status: 'skipped', message: 'already applied (version)' });
		expect(t.tasks.size).toBe(1);
	});

	it('tasks synced one way from Ever Works: a task adopted back takes Ever Works’ sets and dates as they are, not only what they add (#11108 review)', async () => {
		const t = setup({ directions: { tasks: 'ew_to_gauzy' } });
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		t.addGauzyTask({ id: 'g1', title: 'Sets', tags: [{ id: 'tag-old', name: 'Old' }], members: [{ id: 'e-alice' }], dueDate: new Date('2026-11-01T00:00:00Z') });
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		const ew = t.mock.addTask(t.org.id, { title: 'Sets', labels: ['New'], assignees: [{ type: 'user', id: 'ew-bob' }], watchers: ['ew-bob'], dueAt: null });
		const own = [{ source: 'gauzy', installationId: 'c1', externalId: 'g1', externalUrl: null }];
		expect(await t.deliver({ type: 'task.updated', data: { ...ew, externalLinks: own }, aggregate: { id: ew['id'] as string, version: 3 } })).toEqual({ status: 'applied' });
		expect(t.tasks.get('g1')).toMatchObject({ tags: [{ id: 'tag-new', name: 'New' }], members: [{ id: 'e-bob' }], dueDate: null });
		expect(t.subscriptions.filter((row) => row.taskId === 'g1').map((row) => row.employeeId)).toEqual(['e-bob']);
	});

	it('tasks synced one way from Ever Works: a long title renamed in Gauzy before the adoption stays; a rename in Ever Works is taken (#11108 review)', async () => {
		const t = setup({ directions: { tasks: 'ew_to_gauzy' } });
		const sent = 'A'.repeat(250);
		const renamed = 'B'.repeat(250);
		t.addGauzyTask({ id: 'g1', title: renamed });
		t.addGauzyTask({ id: 'g2', title: renamed });
		// Both went out with the long title `sent` (cut, the full one in the description); Gauzy renamed them since.
		const description = descriptionForEverWorks('Body', sent);
		const kept = t.mock.addTask(t.org.id, { title: titleForEverWorks(sent).title, description });
		const edited = t.mock.addTask(t.org.id, { title: 'Renamed in Ever Works', description });
		for (const [ew, gauzyId] of [[kept, 'g1'], [edited, 'g2']] as const) {
			const own = [{ source: 'gauzy', installationId: 'c1', externalId: gauzyId, externalUrl: null }];
			expect(await t.deliver({ type: 'task.updated', data: { ...ew, externalLinks: own }, aggregate: { id: ew['id'] as string, version: 2 } })).toEqual({ status: 'applied' });
		}
		expect((t.tasks.get('g1') as GauzyTask)['title']).toBe(renamed);
		expect((t.tasks.get('g2') as GauzyTask)['title']).toBe('Renamed in Ever Works');
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

	it('pushes a status or priority change written as the string only, past the stale option rows (local e2e)', async () => {
		// The sync writes a synced task's taskStatusId / taskPriorityId; the web app, REST clients and Ever Teams'
		// status menu then change only `status` / `priority` (Ever Teams sends the OLD taskStatusId along). Read row
		// first, the change was "nothing changed" and never reached Ever Works.
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Synced', status: 'backlog', taskStatus: { value: 'backlog' }, priority: 'high', taskPriority: { value: 'high' } });
		await t.push('g1');
		Object.assign(t.tasks.get('g1') as GauzyTask, { status: 'in-progress', priority: 'low' });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect([...t.mock.tasks.values()][0]).toMatchObject({ status: 'in_progress', priority: 'p4' });
		expect(t.mock.requests.some((r) => r.method === 'POST' && r.path.endsWith('/transition') && (r.body as Record<string, unknown>)['to'] === 'in_progress')).toBe(true);
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

	it('a Gauzy delete also removes the Gauzy link from the Ever Works task, this installation only (I3c)', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Doomed' });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		const ewId = ew?.['id'] as string;
		t.mock.links.push({ organizationId: t.org.id, entityType: 'task', entityId: ewId, source: 'gauzy', installationId: 'c-other', externalId: 'g-elsewhere', externalUrl: null });
		expect(t.mock.links.filter((link) => link.entityId === ewId)).toHaveLength(2);
		(t.tasks.get('g1') as GauzyTask)['deletedAt'] = new Date();
		expect(await t.push('g1', 'delete')).toEqual({ status: 'pushed', message: 'cancelled in Ever Works (delete policy)' });
		expect(t.mock.links.filter((link) => link.entityId === ewId)).toEqual([expect.objectContaining({ installationId: 'c-other' })]);
		expect(t.mock.requests.filter((r) => r.method === 'DELETE')).toEqual([expect.objectContaining({ path: `/links/task/${ewId}`, query: { installationId: 'c1' } })]);
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

	it('two new Ever Works tasks that relate to each other are imported once each', async () => {
		const t = setup();
		const a = t.mock.addTask(t.org.id, { title: 'A' });
		const b = t.mock.addTask(t.org.id, { title: 'B', relations: [{ taskId: a['id'], kind: 'related' }] });
		a['relations'] = [{ taskId: b['id'], kind: 'related' }];
		await t.deliver({ type: 'task.created', data: a, aggregate: { id: a['id'] as string, version: 1 } });
		expect(t.tasks.size).toBe(2);
		expect(t.links.filter((l) => l.entityType === EverWorksLinkType.TASK)).toHaveLength(2);
		expect(t.linkedIssues).toEqual(
			expect.arrayContaining([
				{ taskToId: 'g-task-1', taskFromId: 'g-task-2', action: LINKED_ISSUE.RELATES_TO },
				{ taskToId: 'g-task-2', taskFromId: 'g-task-1', action: LINKED_ISSUE.RELATES_TO }
			])
		);
	});

	it('a task whose edge could not be followed is finished by the retried event', async () => {
		const t = setup();
		const other = t.mock.addTask(t.org.id, { title: 'Other' });
		const task = t.mock.addTask(t.org.id, { title: 'Blocked', blockedBy: [other['id']] });
		t.mock.fail({ method: 'GET', path: `/tasks/${other['id'] as string}`, status: 503 });
		await expect(t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } })).rejects.toThrow();
		expect(await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } })).toEqual({ status: 'applied' });
		expect(t.tasks.size).toBe(2);
		expect(t.linkedIssues).toEqual(expect.arrayContaining([expect.objectContaining({ taskToId: 'g-task-1', action: LINKED_ISSUE.IS_BLOCKED_BY })]));
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

	it('orphan sweep: a linked task gone from Gauzy without a captured delete is marked orphaned and its delete queued', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g-kept', title: 'Kept' });
		t.addGauzyTask({ id: 'g-gone', title: 'Gone' });
		t.addGauzyTask({ id: 'g-soft', title: 'Soft' });
		for (const id of ['g-kept', 'g-gone', 'g-soft']) await t.push(id);
		t.queue.enqueued.length = 0;
		t.tasks.delete('g-gone'); // a raw or bulk delete: no TaskEvent
		(t.tasks.get('g-soft') as GauzyTask)['deletedAt'] = new Date(); // a soft delete whose event was lost
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued).toEqual([
			expect.objectContaining({ gauzyId: 'g-gone', op: 'delete' }),
			expect.objectContaining({ gauzyId: 'g-soft', op: 'delete' })
		]);
		expect(t.links.find((l) => l.gauzyId === 'g-gone')?.state).toBe(EverWorksLinkState.ORPHANED);
		expect(t.links.find((l) => l.gauzyId === 'g-kept')?.state).toBe(EverWorksLinkState.OK);
		// The delete push applies the delete policy: Ever Works cancels the task, the link stops syncing.
		expect(await t.push('g-gone', 'delete')).toEqual({ status: 'pushed', message: 'cancelled in Ever Works (delete policy)' });
		const ewGone = [...t.mock.tasks.values()].find((row) => row['title'] === 'Gone') as Record<string, unknown>;
		expect(ewGone['status']).toBe('cancelled');
		expect(t.links.find((l) => l.gauzyId === 'g-gone')?.state).toBe(EverWorksLinkState.UNLINKED);
		// Swept again: nothing new (the orphan is no longer a synced link; the soft one is still queued).
		t.queue.enqueued.length = 0;
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued).toEqual([]);
	});
});

describe('task sync review fixes (#10804)', () => {
	it('a Gauzy set edit not pushed yet survives an Ever Works edit of the same set, and goes out', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Labels', tags: [{ name: 'A' }] });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		// Gauzy adds B (its push is still queued); Ever Works adds C meanwhile.
		(t.tasks.get('g1') as GauzyTask)['tags'] = [{ name: 'A' }, { name: 'B' }];
		Object.assign(ew as Record<string, unknown>, { labels: ['A', 'C'], version: Number(ew?.['version']) + 1 });
		await t.deliver({ type: 'task.updated', data: { ...(ew as Record<string, unknown>) }, aggregate: { id: ew?.['id'] as string, version: Number(ew?.['version']) } });
		expect(((t.tasks.get('g1') as GauzyTask)['tags'] as Array<{ name: string }>).map((tag) => tag.name).sort()).toEqual(['A', 'B', 'C']);
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect([...(ew?.['labels'] as string[])].sort()).toEqual(['A', 'B', 'C']);
	});

	it('a task shared again after it turned private resumes on the same Gauzy task', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Hidden for a while' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		await t.deliver({ type: 'task.visibility_changed', data: { id: task['id'], visibility: 'private' }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(t.links.find((l) => l.ewId === task['id'])?.state).toBe(EverWorksLinkState.UNLINKED);
		Object.assign(task, { title: 'Shared again', visibility: 'organization', version: 3 });
		expect((await t.deliver({ type: 'task.visibility_changed', data: { id: task['id'], visibility: 'organization' }, aggregate: { id: task['id'] as string, version: 3 } })).status).toBe('applied');
		expect(t.links.find((l) => l.ewId === task['id'])?.state).toBe(EverWorksLinkState.OK);
		expect(t.tasks.size).toBe(1);
		expect((t.tasks.get('g-task-1') as GauzyTask)['title']).toBe('Shared again');
	});

	it('writes the status row id with the status, null included (a stale row never stays attached)', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Status', status: 'todo' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		(t.tasks.get('g-task-1') as GauzyTask)['taskStatusId'] = 'ts-old';
		await t.deliver({ type: 'task.transitioned', data: { ...task, status: 'done' }, aggregate: { id: task['id'] as string, version: 2 } });
		const update = t.writes.filter((write) => write.kind === 'update').pop();
		expect(update?.input).toMatchObject({ status: 'done', taskStatusId: null });
	});

	it('keeps the losing Ever Works description as a comment when the later Gauzy edit wins', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Desc', description: 'one' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		Object.assign(t.tasks.get('g-task-1') as GauzyTask, { description: '<p>gauzy</p>', updatedAt: new Date('2026-10-16T12:00:00Z') });
		await t.deliver({ type: 'task.updated', data: { ...task, description: 'ever works' }, aggregate: { id: task['id'] as string, version: 2 }, occurredAt: '2026-10-16T11:00:00Z' });
		expect((t.tasks.get('g-task-1') as GauzyTask)['description']).toBe('<p>gauzy</p>');
		expect(t.comments).toEqual([expect.objectContaining({ taskId: 'g-task-1', html: expect.stringContaining('<p>ever works</p>') })]);
	});

	it('a refusal after the create still links the Ever Works task: the next push patches it, never creates it again (review F82)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Work', status: 'in-progress' });
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		// The task is created and moved on, then Ever Works refuses its watchers.
		t.mock.fail({ method: 'PUT', path: /\/watchers$/, status: 400, body: { error: { code: 'validation_failed', message: 'Refused.' } } });
		await expect(t.push('g1')).rejects.toThrow();
		const created = [...t.mock.tasks.values()][0] as Record<string, unknown>;
		expect(t.links.find((l) => l.gauzyId === 'g1')).toMatchObject({ ewId: created['id'] });
		t.mock.expireIdempotencyKeys(); // a later edit, after Ever Works forgot the create's key
		// An Ever Works edit arrives before that push: it is applied, and the watchers still to send stay to send (#11079 review).
		Object.assign(created, { title: 'Work, renamed in Ever Works', version: Number(created['version']) + 1 });
		await t.deliver({ type: 'task.updated', data: { ...created }, aggregate: { id: created['id'] as string, version: Number(created['version']) } });
		expect(t.tasks.get('g1')).toMatchObject({ title: 'Work, renamed in Ever Works' });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(t.mock.tasks.size).toBe(1);
		expect(created).toMatchObject({ status: 'in_progress', watchers: ['ew-alice'] });
	});

	it('the watchers still to send stay to send across two Ever Works edits before the retry (#11096 review)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Work', status: 'in-progress' });
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		t.mock.fail({ method: 'PUT', path: /\/watchers$/, status: 400, body: { error: { code: 'validation_failed', message: 'Refused.' } } });
		await expect(t.push('g1')).rejects.toThrow();
		const created = [...t.mock.tasks.values()][0] as Record<string, unknown>;
		t.mock.expireIdempotencyKeys();
		// The first edit gives the link a Gauzy side (the title it applied); the second must not take the watchers as sent.
		Object.assign(created, { title: 'Work, renamed in Ever Works', version: Number(created['version']) + 1 });
		await t.deliver({ type: 'task.updated', data: { ...created }, aggregate: { id: created['id'] as string, version: Number(created['version']) } });
		Object.assign(created, { priority: 'p1', version: Number(created['version']) + 1 });
		await t.deliver({ type: 'task.updated', data: { ...created }, aggregate: { id: created['id'] as string, version: Number(created['version']) } });
		expect(t.tasks.get('g1')).toMatchObject({ title: 'Work, renamed in Ever Works' });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(t.mock.tasks.size).toBe(1);
		expect(created).toMatchObject({ title: 'Work, renamed in Ever Works', priority: 'p1', status: 'in_progress', watchers: ['ew-alice'] });
	});

	it('an Ever Works watcher change before the retry leaves the Gauzy watchers still to send (#11096 review)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		t.addGauzyTask({ id: 'g1', title: 'Watched' });
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		t.mock.fail({ method: 'PUT', path: /\/watchers$/, status: 400, body: { error: { code: 'validation_failed', message: 'Refused.' } } });
		await expect(t.push('g1')).rejects.toThrow();
		const created = [...t.mock.tasks.values()][0] as Record<string, unknown>;
		t.mock.expireIdempotencyKeys();
		// Ever Works adds Bob: Gauzy takes him, and Alice (never sent) is not recorded as sent with him.
		Object.assign(created, { watchers: ['ew-bob'], version: Number(created['version']) + 1 });
		await t.deliver({ type: 'task.watcher.added', data: { taskId: created['id'], userId: 'ew-bob' }, aggregate: { id: created['id'] as string, version: Number(created['version']) } });
		expect(t.subscriptions.map((row) => row.employeeId).sort()).toEqual(['e-alice', 'e-bob']);
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect([...(created['watchers'] as string[])].sort()).toEqual(['ew-alice', 'ew-bob']);
	});

	it('a create recovered after a lost answer gets the Gauzy values edited since', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Edited since' });
		// The first attempt reached Ever Works with the old title; its answer was lost.
		const ew = t.mock.addTask(t.org.id, { title: 'Old title', status: 'todo' });
		t.mock.links.push({ organizationId: t.org.id, entityType: 'task', entityId: ew['id'] as string, source: 'gauzy', installationId: 'c1', externalId: 'g1', externalUrl: null });
		const outcome = await t.service.push(
			{ tenantId: 't1', organizationId: 'o1', integrationTenantId: 'm1', entityType: EverWorksLinkType.TASK, gauzyId: 'g1', op: 'upsert', actorUserId: null, attempts: 1 } as never,
			{ connection: t.context.connection, mapping: { id: 'm1' } } as never
		);
		expect(outcome).toEqual({ status: 'pushed' });
		expect(t.mock.tasks.size).toBe(1);
		expect(ew['title']).toBe('Edited since');
		expect(t.links.find((l) => l.gauzyId === 'g1')?.ewId).toBe(ew['id']);
	});
});

describe('task watchers: a Gauzy edit not pushed yet (#10804 review, applied to part 2)', () => {
	it('survives an Ever Works watcher change and goes out', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		t.addGauzyTask({ id: 'g1', title: 'Watched' });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		// Gauzy adds Alice (its push is still queued); Ever Works adds Bob meanwhile.
		t.subscriptions.push({ taskId: 'g1', employeeId: 'e-alice' });
		Object.assign(ew as Record<string, unknown>, { watchers: ['ew-bob'], version: Number(ew?.['version']) + 1 });
		await t.deliver({ type: 'task.watcher.added', data: { taskId: ew?.['id'], userId: 'ew-bob' }, aggregate: { id: ew?.['id'] as string, version: Number(ew?.['version']) } });
		expect(t.subscriptions.map((row) => row.employeeId).sort()).toEqual(['e-alice', 'e-bob']);
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect([...(ew?.['watchers'] as string[])].sort()).toEqual(['ew-alice', 'ew-bob']);
	});
});

describe('task comments and links (G-P1-9, 3/3)', () => {
	const comment = (taskId: string, extra: Record<string, unknown> = {}) => ({
		id: `ew-comment-${Math.random().toString(16).slice(2)}`,
		taskId,
		organizationId: 'org',
		authorType: 'agent',
		authorId: 'ew-agent',
		externalAuthor: null,
		body: 'Opened **PR #12**.',
		mentions: [],
		editedAt: null,
		createdAt: '2026-10-16T10:00:00Z',
		updatedAt: '2026-10-16T10:00:00Z',
		externalLinks: [],
		...extra
	});

	it('an agent’s chat message becomes a Gauzy comment by its agent employee; edits and deletes follow', async () => {
		const t = setup();
		t.link(EverWorksLinkType.AGENT, 'e-agent', 'ew-agent');
		const task = t.mock.addTask(t.org.id, { title: 'Chatty' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const message = comment(task['id'] as string);
		// The comment event carries the task's version, which the task link already has: it is applied anyway.
		expect(await t.deliver({ type: 'task.comment.created', data: message, aggregate: { id: task['id'] as string, version: 1 } })).toEqual({ status: 'applied' });
		expect(t.comments).toEqual([expect.objectContaining({ taskId: 'g-task-1', html: '<p>Opened <strong>PR #12</strong>.</p>', actorType: 'Agent', employeeId: 'e-agent' })]);
		// The same event again (a replay) adds nothing.
		await t.deliver({ type: 'task.comment.created', data: message, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.comments).toHaveLength(1);
		await t.deliver({ type: 'task.comment.updated', data: { ...message, body: 'Merged.' }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(t.comments[0]?.html).toBe('<p>Merged.</p>');
		await t.deliver({ type: 'task.comment.deleted', data: { ...message, deleted: true }, aggregate: { id: task['id'] as string, version: 3 } });
		expect(t.comments[0]?.deletedAt).toBeInstanceOf(Date);
	});

	it('an author Gauzy cannot attribute is named in the comment', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Chatty' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		await t.deliver({ type: 'task.comment.created', data: comment(task['id'] as string, { authorType: 'user', authorId: 'ew-nobody', externalAuthor: { name: 'Dana' } }), aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.comments[0]).toMatchObject({ html: '<p><strong>Dana</strong> (Ever Works):</p><p>Opened <strong>PR #12</strong>.</p>', employeeId: null });
	});

	it('an edit of the Gauzy copy of a comment Gauzy attributed is sent without the attribution line (review F84)', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Chatty' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		// Alice is not paired yet when she writes in Ever Works: Gauzy names her in front of the text.
		const ew = comment(task['id'] as string, { authorType: 'user', authorId: 'ew-alice', body: 'hello' });
		t.mock.comments.set(ew.id, ew);
		await t.deliver({ type: 'task.comment.created', data: ew, aggregate: { id: task['id'] as string, version: 1 } });
		const copy = t.comments[0] as { id: string; html: string };
		expect(copy.html).toBe('<p><strong>An Ever Works member</strong> (Ever Works):</p><p>hello</p>');
		// Paired later, she fixes a typo in the Gauzy copy: Ever Works gets her text, not Gauzy's attribution line.
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		copy.html = '<p><strong>An Ever Works member</strong> (Ever Works):</p><p>hello!</p>';
		expect(await t.pushComment(copy.id, 'upsert', 'u-alice')).toEqual({ status: 'pushed' });
		expect(t.mock.comments.get(ew.id)).toMatchObject({ body: 'hello!' });
	});

	it('the attribution line stays in Gauzy for a name with Markdown in it too (#11079 review)', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Chatty' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const ew = comment(task['id'] as string, { authorType: 'user', authorId: 'ew-alice', externalAuthor: { name: 'Ops*Bot' }, body: 'hello' });
		t.mock.comments.set(ew.id, ew);
		await t.deliver({ type: 'task.comment.created', data: ew, aggregate: { id: task['id'] as string, version: 1 } });
		const copy = t.comments[0] as { id: string; html: string };
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		copy.html = copy.html.replace('hello', 'hello!');
		expect(await t.pushComment(copy.id, 'upsert', 'u-alice')).toEqual({ status: 'pushed' });
		expect(t.mock.comments.get(ew.id)).toMatchObject({ body: 'hello!' });
	});

	it('a Gauzy comment is posted as its author with an externalRef, cut to 16384; an edit is patched', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Discuss' });
		await t.push('g1');
		t.comments.push({ id: 'gc1', taskId: 'g1', html: '<p>Looks <em>good</em></p>', actorType: 'User', employeeId: 'e-alice', createdByUserId: 'u-alice' });
		expect(await t.pushComment('gc1')).toEqual({ status: 'pushed', message: 'posted to the Ever Works task chat' });
		const post = t.mock.requests.find((r) => r.method === 'POST' && r.path.endsWith('/comments'));
		expect(post?.headers['x-act-as-user']).toBe('ew-alice');
		expect(post?.body).toMatchObject({ body: 'Looks *good*', externalRef: { source: 'gauzy', installationId: 'c1', externalId: 'gc1' } });
		(t.comments.find((c) => c.id === 'gc1') as { html: string }).html = '<p>Looks great</p>';
		expect(await t.pushComment('gc1', 'upsert', 'u-alice')).toEqual({ status: 'pushed' });
		expect([...t.mock.comments.values()][0]).toMatchObject({ body: 'Looks great' });
		expect(commentBodyForEverWorks(`<p>${'x'.repeat(20000)}</p>`).length).toBe(16384);
	});

	it('a Gauzy comment of a task not in Ever Works yet waits for the task, which is queued', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Not yet' });
		t.comments.push({ id: 'gc1', taskId: 'g1', html: '<p>Hi</p>', actorType: 'User', employeeId: null });
		expect(await t.pushComment('gc1')).toMatchObject({ status: 'deferred' });
		expect(t.queue.enqueued).toEqual([expect.objectContaining({ entityType: EverWorksLinkType.TASK, gauzyId: 'g1' })]);
	});

	it('a comment of a task that never syncs is skipped, not retried every minute (review F22)', async () => {
		const t = setup({ settings: { SYNC_UNLINKED_PROJECT_TASKS: 'false' } });
		t.addGauzyTask({ id: 'g-idea', title: 'An idea', issueType: 'Idea', projectId: 'p-default' });
		t.addGauzyTask({ id: 'g-loose', title: 'Unlinked project', projectId: 'p-loose' });
		t.comments.push({ id: 'gc-idea', taskId: 'g-idea', html: '<p>Hi</p>', actorType: 'User', employeeId: null });
		t.comments.push({ id: 'gc-loose', taskId: 'g-loose', html: '<p>Hi</p>', actorType: 'User', employeeId: null });
		expect(await t.pushComment('gc-idea')).toMatchObject({ status: 'skipped', message: expect.stringContaining('ideas sync as Ever Works ideas') });
		expect(await t.pushComment('gc-loose')).toMatchObject({ status: 'skipped', message: expect.stringContaining('not linked to a work') });
		expect(t.queue.enqueued).toEqual([]);
	});

	it('a comment waiting for its task queues the task once, and gives up after a day (review F22)', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Waiting on its team', teams: [{ id: 'g-team-unlinked' }] });
		t.comments.push({ id: 'gc1', taskId: 'g1', html: '<p>Hi</p>', actorType: 'User', employeeId: null });
		const first = await t.pushComment('gc1');
		expect(first).toMatchObject({ status: 'deferred' });
		expect(t.queue.enqueued).toHaveLength(1);
		// Its retries (the change settled with the same wait) do not queue the task again.
		expect(await t.pushComment('gc1', 'upsert', null, { lastError: (first as { message: string }).message })).toMatchObject({ status: 'deferred' });
		expect(t.queue.enqueued).toHaveLength(1);
		// A change waiting longer than a day stops.
		expect(await t.pushComment('gc1', 'upsert', null, { lastError: (first as { message: string }).message, createdAt: new Date(Date.now() - 25 * 3_600_000) })).toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('24 hours')
		});
		expect(t.queue.enqueued).toHaveLength(1);
	});

	it('links the Gauzy task to its Ever Works page and to its pull request once there is one', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Linked', slug: 'T-7' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.resourceLinks).toEqual([expect.objectContaining({ taskId: 'g-task-1', title: 'Ever Works task T-7', url: task['webUrl'] })]);
		const runtime = { prUrl: 'https://github.com/acme/site/pull/12', prState: 'open', ciState: 'pending', latestRunStatus: 'running' };
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime }, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.resourceLinks).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Pull request', url: runtime.prUrl })]));
		// A new PR URL updates the same link.
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: { ...runtime, prUrl: 'https://github.com/acme/site/pull/13' } }, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.resourceLinks.filter((row) => row.title === 'Pull request').map((row) => row.url)).toEqual(['https://github.com/acme/site/pull/13']);
	});
});

describe('inbound writes re-check the Gauzy task organization (review F23)', () => {
	it('writes nothing of Ever Works onto a synced task moved to another organization', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Org A plan', slug: 'T-9' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const row = t.tasks.get('g-task-1') as GauzyTask;
		// PUT /tasks/:id moves it to organization B of the same tenant.
		row['organizationId'] = 'o2';
		t.writes.length = 0;
		const moved = { status: 'skipped', message: 'the Gauzy task belongs to another organization now' };
		expect(await t.deliver({ type: 'task.updated', data: { ...task, title: 'Org A secret' }, aggregate: { id: task['id'] as string, version: 2 } })).toEqual(moved);
		const message = { id: 'ew-comment-1', taskId: task['id'], authorType: 'user', authorId: 'ew-nobody', body: 'Org A only', createdAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T10:00:00Z', externalLinks: [] };
		expect(await t.deliver({ type: 'task.comment.created', data: message, aggregate: { id: task['id'] as string, version: 2 } })).toEqual(moved);
		const runtime = { prUrl: 'https://github.com/acme/site/pull/12', prState: 'open', ciState: 'pending', latestRunStatus: 'running' };
		expect(await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime }, aggregate: { id: task['id'] as string, version: 2 } })).toEqual(moved);
		// A child of it in Ever Works is not parented under the organization-B task.
		const child = t.mock.addTask(t.org.id, { title: 'Child', parentTaskId: task['id'] });
		await t.deliver({ type: 'task.created', data: child, aggregate: { id: child['id'] as string, version: 1 } });
		expect((t.tasks.get('g-task-2') as GauzyTask)?.['parentId']).toBeUndefined();
		// Nor does a Gauzy comment on the moved task go to the Ever Works task of organization A.
		t.comments.push({ id: 'gc-moved', taskId: 'g-task-1', html: '<p>Org B note</p>', actorType: 'User', employeeId: null });
		expect(await t.pushComment('gc-moved')).toEqual(moved);
		t.comments.length = 0;
		// An Ever Works delete ends the pairing but leaves the organization-B task alone.
		expect(await t.deliver({ type: 'task.deleted', data: { id: task['id'] }, aggregate: { id: task['id'] as string, version: 3 } })).toEqual({
			status: 'skipped',
			message: 'deleted in Ever Works; the Gauzy task belongs to another organization now and is kept'
		});
		expect(row['title']).toBe('Org A plan');
		expect(row['deletedAt']).toBeUndefined();
		expect(t.comments).toEqual([]);
		expect(t.resourceLinks.filter((link) => link.taskId === 'g-task-1').map((link) => link.title)).toEqual(['Ever Works task T-9']);
		expect(t.writes.filter((write) => write.id === 'g-task-1')).toEqual([]);
		expect(t.links.find((link) => link.gauzyId === 'g-task-1')?.state).toBe(EverWorksLinkState.UNLINKED);
	});
});

describe('task dates and estimate (G-P2-6)', () => {
	it('Ever Works minutes are Gauzy seconds, and back (rounded to whole minutes)', () => {
		expect(estimateMinutesFor(90)).toBe(2);
		expect(estimateMinutesFor(null)).toBeNull();
		expect(estimateMinutesFor(10 ** 9)).toBe(525600);
		expect(estimateSecondsFor(45)).toBe(2700);
		expect(estimateSecondsFor(null)).toBeNull();
		expect(isoOrNull('2026-10-20T09:00:00+02:00')).toBe('2026-10-20T07:00:00.000Z');
		expect(isoOrNull('not a date')).toBeNull();
	});

	it('EW → G: due and start dates and the estimate', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Planned', dueAt: '2026-10-20T17:00:00.000Z', startAt: '2026-10-18T08:00:00.000Z', estimateMinutes: 90 });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const created = t.tasks.get('g-task-1') as GauzyTask;
		expect(new Date(created['dueDate']).toISOString()).toBe('2026-10-20T17:00:00.000Z');
		expect(new Date(created['startDate']).toISOString()).toBe('2026-10-18T08:00:00.000Z');
		expect(created['estimate']).toBe(5400);
		// Cleared in Ever Works → cleared in Gauzy.
		await t.deliver({ type: 'task.updated', data: { ...task, dueAt: null }, aggregate: { id: task['id'] as string, version: 2 } });
		expect((t.tasks.get('g-task-1') as GauzyTask)['dueDate']).toBeNull();
	});

	it('G → EW: sent on create and when changed; a lossy estimate does not flap', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Planned', dueDate: new Date('2026-10-20T17:00:00.000Z'), estimate: 90 });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		expect(ew).toMatchObject({ dueAt: '2026-10-20T17:00:00.000Z', estimateMinutes: 2 });
		// Ever Works echoes 2 minutes = 120 s; nothing goes back while Gauzy still says 90 s.
		const before = t.mock.requests.length;
		expect(await t.push('g1')).toEqual({ status: 'skipped', message: 'nothing changed' });
		expect(t.mock.requests.length).toBe(before);
		(t.tasks.get('g1') as GauzyTask)['dueDate'] = new Date('2026-10-22T17:00:00.000Z');
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(t.mock.requests.filter((r) => r.method === 'PATCH').pop()?.body).toEqual({ dueAt: '2026-10-22T17:00:00.000Z' });
	});

	it('a start after the due date is not sent (Ever Works refuses it) and is logged', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Odd dates', dueDate: new Date('2026-10-20T00:00:00.000Z'), startDate: new Date('2026-10-25T00:00:00.000Z') });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		expect(ew).toMatchObject({ dueAt: '2026-10-20T00:00:00.000Z', startAt: null });
		expect(t.logged).toEqual([expect.objectContaining({ action: 'start_after_due' })]);
	});
});

describe('task comments review fixes (#10813)', () => {
	const ewComment = (taskId: string, extra: Record<string, unknown> = {}) => ({
		id: `ew-comment-${Math.random().toString(16).slice(2)}`,
		taskId,
		organizationId: 'org',
		authorType: 'user',
		authorId: 'ew-alice',
		externalAuthor: null,
		body: 'Hello',
		mentions: [],
		editedAt: null,
		createdAt: '2026-10-16T10:00:00Z',
		updatedAt: '2026-10-16T10:00:00Z',
		externalLinks: [],
		...extra
	});

	async function pushed(t: ReturnType<typeof setup>, html: string) {
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Discuss' });
		await t.push('g1');
		t.comments.push({ id: 'gc1', taskId: 'g1', html, actorType: 'User', employeeId: 'e-alice', createdByUserId: 'u-alice' });
		await t.pushComment('gc1');
		const [ewTask] = [...t.mock.tasks.values()];
		const [ew] = [...t.mock.comments.values()];
		return { ewTask: ewTask as Record<string, unknown>, ew: ew as Record<string, unknown> };
	}

	it('a long Gauzy comment, cut in Ever Works, still takes the author’s later Ever Works edits', async () => {
		const t = setup();
		const long = 'x'.repeat(20000);
		const { ewTask, ew } = await pushed(t, `<p>${long}</p>`);
		expect((ew['body'] as string).length).toBe(16384);
		await t.deliver({ type: 'task.comment.updated', data: { ...ew, body: 'Shorter now.' }, aggregate: { id: ewTask['id'] as string, version: 9 } });
		expect(t.comments.find((c) => c.id === 'gc1')?.html).toBe('<p>Shorter now.</p>');
	});

	it('a refused Gauzy edit stays in Gauzy when the author edits in Ever Works later, and is not sent again', async () => {
		const t = setup();
		const { ewTask, ew } = await pushed(t, '<p>First</p>');
		(t.comments.find((c) => c.id === 'gc1') as { html: string }).html = '<p>Edited in Gauzy</p>';
		t.mock.fail({ method: 'PATCH', path: /\/comments\//, status: 422, body: { error: { code: 'domain_rule', message: 'The edit window has passed.' } } });
		expect((await t.pushComment('gc1')).status).toBe('skipped');
		expect(t.logged).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'comment_edit_refused' })]));
		await t.deliver({ type: 'task.comment.updated', data: { ...ew, body: 'Edited in Ever Works' }, aggregate: { id: ewTask['id'] as string, version: 9 } });
		expect(t.comments.find((c) => c.id === 'gc1')?.html).toBe('<p>Edited in Gauzy</p>');
		const patches = t.mock.requests.filter((r) => r.method === 'PATCH').length;
		expect((await t.pushComment('gc1')).status).toBe('skipped');
		expect(t.mock.requests.filter((r) => r.method === 'PATCH').length).toBe(patches);
	});

	it('a Gauzy delete is sent as the comment’s Ever Works author', async () => {
		const t = setup();
		await pushed(t, '<p>Bye</p>');
		(t.comments.find((c) => c.id === 'gc1') as { deletedAt?: Date }).deletedAt = new Date();
		expect(await t.pushComment('gc1', 'delete', 'u-alice')).toEqual({ status: 'pushed', message: 'deleted in Ever Works' });
		expect(t.mock.requests.find((r) => r.method === 'DELETE')?.headers['x-act-as-user']).toBe('ew-alice');
		expect(t.mock.comments.size).toBe(0);
	});

	it('edits and deletes go as the Ever Works author only when that person made them in Gauzy (review F21)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		const task = t.mock.addTask(t.org.id, { title: 'Chat' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		// Alice's Ever Works message, copied into Gauzy.
		const message = ewComment(task['id'] as string, { body: 'Original' });
		t.mock.comments.set(message.id, { ...message });
		await t.deliver({ type: 'task.comment.created', data: message, aggregate: { id: task['id'] as string, version: 1 } });
		const copy = t.comments[0] as (typeof t.comments)[number];
		const ewSide = () => t.mock.comments.get(message.id) as Record<string, unknown>;
		const lastAs = (method: string) => [...t.mock.requests].reverse().find((r) => r.method === method)?.headers['x-act-as-user'] ?? null;
		// Bob (a manager who may edit any comment) edits the copy: it goes as the integration, and Ever Works keeps Alice's text.
		copy.html = '<p>Rewritten by Bob</p>';
		copy.updatedByUserId = 'u-bob';
		expect((await t.pushComment(copy.id, 'upsert', 'u-bob')).status).toBe('skipped');
		expect(lastAs('PATCH')).toBeNull();
		expect(ewSide()['body']).toBe('Original');
		expect(t.logged).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'comment_edit_refused' })]));
		// A change the sweep found (no captured actor) goes as the comment's last editor, Bob: refused the same way.
		copy.html = '<p>Rewritten again</p>';
		expect((await t.pushComment(copy.id)).status).toBe('skipped');
		expect(lastAs('PATCH')).toBeNull();
		// Bob deletes it: refused too, the Ever Works message stays.
		copy.deletedAt = new Date();
		copy.deletedByUserId = 'u-bob';
		expect(await t.pushComment(copy.id, 'delete', 'u-bob')).toEqual({ status: 'skipped', message: 'deleted in Gauzy; Ever Works refused the delete, so its copy stays (logged)' });
		expect(lastAs('DELETE')).toBeNull();
		expect(ewSide()['body']).toBe('Original');
	});

	it("a retried change of the author never carries someone else's later edit or delete as the author (review F21, #11021 review)", async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.link(EverWorksLinkType.MEMBER, 'e-bob', 'ew-bob');
		t.addGauzyTask({ id: 'g1', title: 'Discuss' });
		await t.push('g1');
		t.comments.push({ id: 'gc1', taskId: 'g1', html: '<p>Mine</p>', actorType: 'User', employeeId: 'e-alice', createdByUserId: 'u-alice' });
		await t.pushComment('gc1', 'upsert', 'u-alice');
		const lastAs = (method: string) => [...t.mock.requests].reverse().find((r) => r.method === method)?.headers['x-act-as-user'] ?? null;
		const row = t.comments[0] as (typeof t.comments)[number];
		// Alice's edit is queued (actor Alice); before its retry runs, Bob edits the comment: the row now has Bob's text.
		row.html = '<p>Bob was here</p>';
		row.updatedByUserId = 'u-bob';
		expect((await t.pushComment('gc1', 'upsert', 'u-alice')).status).toBe('skipped');
		expect(lastAs('PATCH')).toBeNull();
		expect([...t.mock.comments.values()][0]).toMatchObject({ body: 'Mine' });
		// The same for a delete Bob made while Alice's change waited.
		row.deletedAt = new Date();
		row.deletedByUserId = 'u-bob';
		expect((await t.pushComment('gc1', 'delete', 'u-alice')).status).toBe('skipped');
		expect(lastAs('DELETE')).toBeNull();
		expect(t.mock.comments.size).toBe(1);
	});

	it("a new Gauzy comment is posted as the person who wrote it, not as the comment's stated employee (review F21)", async () => {
		const t = setup();
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g1', title: 'Discuss' });
		await t.push('g1');
		// A caller with no employee of their own posted with Alice's employeeId.
		t.comments.push({ id: 'gc-spoof', taskId: 'g1', html: '<p>Not Alice</p>', actorType: 'User', employeeId: 'e-alice', createdByUserId: 'u-carol' });
		expect(await t.pushComment('gc-spoof', 'upsert', 'u-carol')).toEqual({ status: 'pushed', message: 'posted to the Ever Works task chat' });
		const post = t.mock.requests.find((r) => r.method === 'POST' && r.path.endsWith('/comments'));
		expect(post?.headers['x-act-as-user'] ?? null).toBeNull();
		expect(post?.body).toMatchObject({ externalAuthor: expect.objectContaining({ source: 'gauzy' }) });
	});

	it('the sweep queues a linked comment that was edited or deleted without a captured event', async () => {
		const t = setup();
		await pushed(t, '<p>Swept</p>');
		t.queue.enqueued.length = 0;
		await t.service.sweep(t.context.connection as never);
		const comments = t.commentsService;
		await comments.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((q) => q['entityType'] === EverWorksLinkType.COMMENT)).toEqual([]);
		(t.comments.find((c) => c.id === 'gc1') as { html: string }).html = '<p>Changed by a partial save</p>';
		await comments.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((q) => q['entityType'] === EverWorksLinkType.COMMENT)).toEqual([expect.objectContaining({ entityType: EverWorksLinkType.COMMENT, gauzyId: 'gc1', op: 'upsert' })]);
	});

	it('a lost-answer link back only pairs a comment of the same task', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g-other', title: 'Other' });
		t.comments.push({ id: 'gc-other', taskId: 'g-other', html: '<p>Elsewhere</p>', actorType: 'User', employeeId: null });
		const task = t.mock.addTask(t.org.id, { title: 'Chat' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const stale = ewComment(task['id'] as string, { externalLinks: [{ source: 'gauzy', installationId: 'c1', externalId: 'gc-other' }] });
		await t.deliver({ type: 'task.comment.created', data: stale, aggregate: { id: task['id'] as string, version: 1 } });
		// A new comment on the right task, not a pairing with the other task's comment.
		const gauzyTaskId = t.links.find((l) => l.entityType === EverWorksLinkType.TASK && l.ewId === task['id'])?.gauzyId;
		expect(t.comments.filter((c) => c.taskId === gauzyTaskId)).toHaveLength(1);
		expect(t.links.find((l) => l.entityType === EverWorksLinkType.COMMENT)?.gauzyId).not.toBe('gc-other');
	});

	it('removes the "Pull request" link when Ever Works drops the PR', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'PR', runtime: { prUrl: 'https://github.com/acme/site/pull/1', prState: 'open', ciState: null, latestRunStatus: null } });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.resourceLinks.some((row) => row.title === 'Pull request')).toBe(true);
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: { prUrl: null, prState: null, ciState: null, latestRunStatus: null } }, aggregate: { id: task['id'] as string, version: 1 } });
		expect(t.resourceLinks.some((row) => row.title === 'Pull request')).toBe(false);
	});
});

describe('task dates review fixes (#10814)', () => {
	it('a start held back because it was after the due date goes out once the due date moves later', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Odd dates', dueDate: new Date('2026-10-20T00:00:00.000Z'), startDate: new Date('2026-10-25T00:00:00.000Z') });
		await t.push('g1');
		const [ew] = [...t.mock.tasks.values()];
		expect(ew).toMatchObject({ startAt: null });
		(t.tasks.get('g1') as GauzyTask)['dueDate'] = new Date('2026-10-30T00:00:00.000Z');
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(ew).toMatchObject({ dueAt: '2026-10-30T00:00:00.000Z', startAt: '2026-10-25T00:00:00.000Z' });
	});

	it('a due date moved before Ever Works’ start is held back, and the rest of the change still goes out', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g1', title: 'Dates', dueDate: new Date('2026-10-20T00:00:00.000Z'), startDate: new Date('2026-10-18T00:00:00.000Z') });
		await t.push('g1');
		Object.assign(t.tasks.get('g1') as GauzyTask, { title: 'Renamed', dueDate: new Date('2026-10-17T00:00:00.000Z') });
		expect(await t.push('g1')).toEqual({ status: 'pushed' });
		expect(t.mock.requests.filter((r) => r.method === 'PATCH').pop()?.body).toEqual({ title: 'Renamed' });
		const [ew] = [...t.mock.tasks.values()];
		expect(ew).toMatchObject({ title: 'Renamed', dueAt: '2026-10-20T00:00:00.000Z' });
	});

	it('on a link from before EW-P2-3, a Gauzy date Ever Works does not have is kept and then sent', async () => {
		const t = setup();
		const task = t.mock.addTask(t.org.id, { title: 'Old link' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const link = t.links.find((l) => l.ewId === task['id']) as LinkRow;
		// The snapshot of a link made before the planning fields existed.
		const snapshot = JSON.parse(link.snapshot as string);
		for (const field of ['dueAt', 'startAt', 'estimateMinutes']) delete snapshot.e[field];
		for (const field of ['dueDate', 'startDate', 'estimate']) delete snapshot.g[field];
		link.snapshot = JSON.stringify(snapshot);
		(t.tasks.get('g-task-1') as GauzyTask)['dueDate'] = new Date('2026-11-01T00:00:00.000Z');
		Object.assign(task, { title: 'Old link, edited', version: 2 });
		await t.deliver({ type: 'task.updated', data: { ...task }, aggregate: { id: task['id'] as string, version: 2 } });
		expect(new Date((t.tasks.get('g-task-1') as GauzyTask)['dueDate']).toISOString()).toBe('2026-11-01T00:00:00.000Z');
		expect(await t.push('g-task-1')).toEqual({ status: 'pushed' });
		expect(task['dueAt']).toBe('2026-11-01T00:00:00.000Z');
	});
});

describe('task comments and links review round 2 (#10813)', () => {
	it('a link a person added with the PR URL is reused and stays when Ever Works drops the PR', async () => {
		const t = setup();
		const prUrl = 'https://github.com/acme/site/pull/5';
		const task = t.mock.addTask(t.org.id, { title: 'Mine' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		t.resourceLinks.push({ id: 'user-link', taskId: 'g-task-1', title: 'My PR', url: prUrl });
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: { prUrl, prState: 'open', ciState: null, latestRunStatus: null } }, aggregate: { id: task['id'] as string, version: 1 }, occurredAt: '2026-10-16T10:00:00Z' });
		expect(t.resourceLinks.filter((row) => row.url === prUrl)).toEqual([{ id: 'user-link', taskId: 'g-task-1', title: 'My PR', url: prUrl }]);
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: { prUrl: null, prState: null, ciState: null, latestRunStatus: null } }, aggregate: { id: task['id'] as string, version: 1 }, occurredAt: '2026-10-16T11:00:00Z' });
		expect(t.resourceLinks.some((row) => row.id === 'user-link')).toBe(true);
	});

	it('an older run state or comment state (a late delivery) does not overwrite a newer one', async () => {
		const t = setup();
		t.link(EverWorksLinkType.AGENT, 'e-agent', 'ew-agent');
		const task = t.mock.addTask(t.org.id, { title: 'Late' });
		await t.deliver({ type: 'task.created', data: task, aggregate: { id: task['id'] as string, version: 1 } });
		const runtime = (prUrl: string) => ({ prUrl, prState: 'open', ciState: null, latestRunStatus: null });
		await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: runtime('https://github.com/acme/site/pull/2') }, aggregate: { id: task['id'] as string, version: 1 }, occurredAt: '2026-10-16T12:00:00Z' });
		expect((await t.deliver({ type: 'task.runtime_updated', data: { ...task, runtime: runtime('https://github.com/acme/site/pull/1') }, aggregate: { id: task['id'] as string, version: 1 }, occurredAt: '2026-10-16T11:00:00Z' })).status).toBe('skipped');
		expect(t.resourceLinks.filter((row) => row.title === 'Pull request').map((row) => row.url)).toEqual(['https://github.com/acme/site/pull/2']);
		const base = { id: 'ew-c1', taskId: task['id'], authorType: 'agent', authorId: 'ew-agent', externalAuthor: null, mentions: [], editedAt: null, createdAt: '2026-10-16T10:00:00Z', externalLinks: [] };
		await t.deliver({ type: 'task.comment.created', data: { ...base, body: 'v2', updatedAt: '2026-10-16T12:00:00Z' }, aggregate: { id: task['id'] as string, version: 1 } });
		expect((await t.deliver({ type: 'task.comment.updated', data: { ...base, body: 'v1', updatedAt: '2026-10-16T11:00:00Z' }, aggregate: { id: task['id'] as string, version: 1 } })).status).toBe('skipped');
		expect(t.comments[0]?.html).toBe('<p>v2</p>');
	});
});

describe('a parent Ever Works refuses (another team or work; local e2e)', () => {
	const ewOf = (t: ReturnType<typeof setup>, gauzyId: string) => t.mock.tasks.get(t.links.find((l) => l.entityType === EverWorksLinkType.TASK && l.gauzyId === gauzyId)?.ewId as string);
	const heldOf = (t: ReturnType<typeof setup>, gauzyId: string) =>
		JSON.parse(t.links.find((l) => l.entityType === EverWorksLinkType.TASK && l.gauzyId === gauzyId)?.ewOnly ?? '{}')['heldParent'] ?? null;

	it('a sub-task of a parent on another team is created without the parent, logged, and not refused again', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team-a', 'ew-team-a');
		t.link(EverWorksLinkType.TEAM, 'g-team-b', 'ew-team-b');
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-b' }], priority: 'urgent' });
		await t.push('g-parent');
		// Before: Ever Works' 400 dead-lettered the whole create.
		expect(await t.push('g-child')).toEqual({ status: 'pushed', message: 'created in Ever Works' });
		expect(ewOf(t, 'g-child')).toMatchObject({ title: 'Child', teamIds: ['ew-team-b'], priority: 'p0', parentTaskId: null });
		expect(t.logged).toEqual([expect.objectContaining({ action: 'parent_scope_refused', gauzyId: 'g-child', status: 'conflict' })]);
		expect(heldOf(t, 'g-child')).toMatchObject({ parentId: 'g-parent' });
		// The same parent is not sent again while nothing moved: no request, no second refusal.
		const before = t.mock.requests.length;
		expect(await t.push('g-child')).toEqual({ status: 'skipped', message: 'nothing changed' });
		Object.assign(t.tasks.get('g-child') as GauzyTask, { title: 'Child renamed' });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(t.mock.requests.slice(before).filter((r) => r.method === 'PATCH').map((r) => r.body)).toEqual([{ title: 'Child renamed' }]);
		expect(t.logged).toHaveLength(1);
		// Moved onto the parent's team in Gauzy: the parent goes out with the move.
		Object.assign(t.tasks.get('g-child') as GauzyTask, { teams: [{ id: 'g-team-a' }] });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-a'], parentTaskId: ewOf(t, 'g-parent')?.['id'] });
		expect(heldOf(t, 'g-child')).toBeNull();
	});

	it('a synced sub-task moved to another team keeps syncing: the rest goes out, the parent is left out', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team-a', 'ew-team-a');
		t.link(EverWorksLinkType.TEAM, 'g-team-b', 'ew-team-b');
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		await t.push('g-child');
		expect(ewOf(t, 'g-child')?.['parentTaskId']).toBe(ewOf(t, 'g-parent')?.['id']);
		Object.assign(t.tasks.get('g-child') as GauzyTask, { title: 'Moved', teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ title: 'Moved', teamIds: ['ew-team-b'], parentTaskId: null });
		expect(t.logged).toEqual([expect.objectContaining({ action: 'parent_scope_refused', gauzyId: 'g-child' })]);
		// Gauzy keeps its parent: nothing is written back.
		expect((t.tasks.get('g-child') as GauzyTask)['parentId']).toBe('g-parent');
		expect(heldOf(t, 'g-child')).toMatchObject({ parentId: 'g-parent' });
	});

	it('the parent moving onto the task’s team: the sweep queues the task, and the parent goes out (#11048 review)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team-a', 'ew-team-a');
		t.link(EverWorksLinkType.TEAM, 'g-team-b', 'ew-team-b');
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-b' }] });
		await t.push('g-parent');
		await t.push('g-child');
		expect(heldOf(t, 'g-child')).toMatchObject({ parentId: 'g-parent' });
		// Nothing moved: the sweep leaves the held task alone.
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((row) => row['gauzyId'] === 'g-child')).toEqual([]);
		// Only the parent moves (onto the child's team).
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-parent')).toEqual({ status: 'pushed' });
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((row) => row['gauzyId'] === 'g-child')).toEqual([expect.objectContaining({ op: 'upsert' })]);
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-b'], parentTaskId: ewOf(t, 'g-parent')?.['id'] });
		expect(heldOf(t, 'g-child')).toBeNull();
	});

	it('the task put in its parent’s mission in Ever Works: the parent is sent again with the next Gauzy change (#11048 review)', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent' });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent' });
		await t.push('g-parent');
		// The parent is in a mission in Ever Works (a mission is Ever Works-only): the child does not fit.
		Object.assign(ewOf(t, 'g-parent') as Record<string, unknown>, { missionId: 'ew-mission-1' });
		const parent = ewOf(t, 'g-parent') as Record<string, unknown>;
		await t.deliver({ type: 'task.updated', data: { ...parent, version: Number(parent['version']) + 1 }, aggregate: { id: parent['id'] as string, version: Number(parent['version']) + 1 } });
		expect(await t.push('g-child')).toEqual({ status: 'pushed', message: 'created in Ever Works' });
		expect(ewOf(t, 'g-child')?.['parentTaskId']).toBeNull();
		// Someone puts the child in the same mission in Ever Works; the next Gauzy edit sends the parent too.
		const child = ewOf(t, 'g-child') as Record<string, unknown>;
		child['missionId'] = 'ew-mission-1';
		child['version'] = Number(child['version']) + 1;
		await t.deliver({ type: 'task.updated', data: { ...child }, aggregate: { id: child['id'] as string, version: Number(child['version']) } });
		Object.assign(t.tasks.get('g-child') as GauzyTask, { title: 'Child edited' });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ title: 'Child edited', parentTaskId: parent['id'] });
		expect(heldOf(t, 'g-child')).toBeNull();
	});

	it('a 412 on a later write of the same push never reads the detach as an Ever Works edit (#11048 review)', async () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team-a', 'ew-team-a');
		t.link(EverWorksLinkType.TEAM, 'g-team-b', 'ew-team-b');
		t.link(EverWorksLinkType.MEMBER, 'e-alice', 'ew-alice');
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		await t.push('g-child');
		// The child moves to another team and gets an assignee; the assignee write answers 412 once.
		Object.assign(t.tasks.get('g-child') as GauzyTask, { teams: [{ id: 'g-team-b' }], members: [{ id: 'e-alice' }] });
		t.mock.fail({ method: 'PUT', path: /\/assignees$/, status: 412, body: { error: { code: 'version_mismatch', message: 'The task changed.' } } });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect((t.tasks.get('g-child') as GauzyTask)['parentId']).toBe('g-parent');
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-b'], parentTaskId: null, assignees: [{ type: 'user', id: 'ew-alice' }] });
		expect(heldOf(t, 'g-child')).toMatchObject({ parentId: 'g-parent' });
	});

	it('another refusal of a sub-task still stops the change (no retry without the parent)', async () => {
		const t = setup();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent' });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent' });
		await t.push('g-parent');
		t.mock.fail({ method: 'POST', path: '/tasks', status: 400, body: { error: { code: 'validation_failed', message: 'title is not valid.' } } });
		await expect(t.push('g-child')).rejects.toMatchObject({ status: 400, code: 'validation_failed' });
		expect(t.mock.requests.filter((r) => r.method === 'POST' && r.path === '/tasks')).toHaveLength(2);
		expect(t.logged).toEqual([]);
	});
});

/**
 * Ever Works refuses to change the owners of a task that has sub-tasks ("re-file or detach them before changing its
 * owners"): a Gauzy parent moved to another team dead-lettered its whole change (local e2e, follow-up of #11048).
 * D11 (the team decides, for every later change) needs the parent's move in Ever Works, and each sub-task keeps its
 * own Gauzy team, so the synced sub-tasks are detached there — the #11048 state of a sub-task whose Gauzy parent is
 * on another team — and the move goes out. Sub-tasks Gauzy does not sync are never touched: then the move is held.
 */
describe('a parent with sub-tasks moved to another team or project (I3c)', () => {
	const ewOf = (t: ReturnType<typeof setup>, gauzyId: string) => t.mock.tasks.get(t.links.find((l) => l.entityType === EverWorksLinkType.TASK && l.gauzyId === gauzyId)?.ewId as string);
	const heldOf = (t: ReturnType<typeof setup>, gauzyId: string) =>
		JSON.parse(t.links.find((l) => l.entityType === EverWorksLinkType.TASK && l.gauzyId === gauzyId)?.ewOnly ?? '{}')['heldParent'] ?? null;
	const withTeams = () => {
		const t = setup();
		t.link(EverWorksLinkType.TEAM, 'g-team-a', 'ew-team-a');
		t.link(EverWorksLinkType.TEAM, 'g-team-b', 'ew-team-b');
		return t;
	};

	it('moves in Ever Works: its synced sub-task is detached there, keeps its team and Gauzy parent, and gets the parent back once it follows', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		await t.push('g-child');
		expect(ewOf(t, 'g-child')?.['parentTaskId']).toBe(ewOf(t, 'g-parent')?.['id']);
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { title: 'Parent moved', teams: [{ id: 'g-team-b' }] });
		// Before: Ever Works' 400 ("has 1 sub-task(s); re-file or detach them") dead-lettered the whole change.
		expect(await t.push('g-parent')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-parent')).toMatchObject({ title: 'Parent moved', teamIds: ['ew-team-b'] });
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-a'], parentTaskId: null });
		expect((t.tasks.get('g-child') as GauzyTask)['parentId']).toBe('g-parent');
		expect(t.logged).toEqual([expect.objectContaining({ action: 'subtasks_detached', gauzyId: 'g-parent', status: 'conflict' })]);
		expect(heldOf(t, 'g-child')).toMatchObject({ parentId: 'g-parent' });
		// The detach's own event is not read as an Ever Works edit that clears Gauzy's parent.
		const child = ewOf(t, 'g-child') as Record<string, unknown>;
		await t.deliver({ type: 'task.updated', data: { ...child }, aggregate: { id: child['id'] as string, version: Number(child['version']) } });
		expect((t.tasks.get('g-child') as GauzyTask)['parentId']).toBe('g-parent');
		// The sweep sends the parent again: refused (the parent is on another team now), held and logged as in #11048.
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((row) => row['gauzyId'] === 'g-child')).toEqual([expect.objectContaining({ op: 'upsert' })]);
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-a'], parentTaskId: null });
		expect(t.logged.map((row) => row['action'])).toEqual(['subtasks_detached', 'parent_scope_refused']);
		t.queue.enqueued.length = 0;
		await t.service.sweep(t.context.connection as never);
		expect(t.queue.enqueued.filter((row) => row['gauzyId'] === 'g-child')).toEqual([]);
		// The sub-task follows its parent in Gauzy: the parent goes out with the move.
		Object.assign(t.tasks.get('g-child') as GauzyTask, { teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-child')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-child')).toMatchObject({ teamIds: ['ew-team-b'], parentTaskId: ewOf(t, 'g-parent')?.['id'] });
		expect(heldOf(t, 'g-child')).toBeNull();
	});

	it('a task in the middle of a tree moves too: left out of its parent, its sub-task detached', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-top', title: 'Top', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-mid', title: 'Mid', parentId: 'g-top', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-leaf', title: 'Leaf', parentId: 'g-mid', teams: [{ id: 'g-team-a' }] });
		for (const id of ['g-top', 'g-mid', 'g-leaf']) await t.push(id);
		Object.assign(t.tasks.get('g-mid') as GauzyTask, { teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-mid')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-mid')).toMatchObject({ teamIds: ['ew-team-b'], parentTaskId: null });
		expect(ewOf(t, 'g-leaf')).toMatchObject({ teamIds: ['ew-team-a'], parentTaskId: null });
		expect(t.logged.map((row) => row['action']).sort()).toEqual(['parent_scope_refused', 'subtasks_detached']);
		expect(heldOf(t, 'g-mid')).toMatchObject({ parentId: 'g-top' });
		expect(heldOf(t, 'g-leaf')).toMatchObject({ parentId: 'g-mid' });
		expect((t.tasks.get('g-mid') as GauzyTask)['parentId']).toBe('g-top');
		expect((t.tasks.get('g-leaf') as GauzyTask)['parentId']).toBe('g-mid');
	});

	it('a sub-task Gauzy does not sync is never touched: the rest goes out, the move is held, logged and sent again with the next change', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		const parentId = ewOf(t, 'g-parent')?.['id'];
		const foreign = t.mock.addTask(t.org.id, { title: 'Ever Works only', parentTaskId: parentId, teamIds: ['ew-team-a'] });
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { title: 'Parent moved', teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-parent')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-parent')).toMatchObject({ title: 'Parent moved', teamIds: ['ew-team-a'] });
		expect(foreign).toMatchObject({ parentTaskId: parentId });
		expect(t.logged).toEqual([expect.objectContaining({ action: 'owner_change_held', gauzyId: 'g-parent', status: 'conflict' })]);
		// Detached in Ever Works by someone: the next Gauzy change sends the move again.
		foreign['parentTaskId'] = null;
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { title: 'Parent again' });
		expect(await t.push('g-parent')).toEqual({ status: 'pushed' });
		expect(ewOf(t, 'g-parent')).toMatchObject({ title: 'Parent again', teamIds: ['ew-team-b'] });
		expect(t.logged).toHaveLength(1);
	});

	it('a task in the middle of a tree with a sub-task Gauzy does not sync keeps its parent while its move is held (#11053 review)', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-top', title: 'Top', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-mid', title: 'Mid', parentId: 'g-top', teams: [{ id: 'g-team-a' }] });
		await t.push('g-top');
		await t.push('g-mid');
		const topId = ewOf(t, 'g-top')?.['id'];
		expect(ewOf(t, 'g-mid')?.['parentTaskId']).toBe(topId);
		t.mock.addTask(t.org.id, { title: 'Ever Works only', parentTaskId: ewOf(t, 'g-mid')?.['id'], teamIds: ['ew-team-a'] });
		Object.assign(t.tasks.get('g-mid') as GauzyTask, { title: 'Mid renamed', teams: [{ id: 'g-team-b' }] });
		expect(await t.push('g-mid')).toEqual({ status: 'pushed' });
		// The move is held, so the parent (on the team the task keeps) stays: no detach goes out.
		expect(ewOf(t, 'g-mid')).toMatchObject({ title: 'Mid renamed', teamIds: ['ew-team-a'], parentTaskId: topId });
		expect(heldOf(t, 'g-mid')).toBeNull();
		expect(t.logged.map((row) => row['action'])).toEqual(['owner_change_held']);
		expect(t.mock.requests.filter((r) => r.method === 'PATCH').map((r) => r.body).pop()).toEqual({ title: 'Mid renamed' });
	});

	it('only the move: when nothing else changed, nothing else is sent', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		t.mock.addTask(t.org.id, { title: 'Ever Works only', parentTaskId: ewOf(t, 'g-parent')?.['id'], teamIds: ['ew-team-a'] });
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { teams: [{ id: 'g-team-b' }] });
		const before = t.mock.requests.length;
		expect(await t.push('g-parent')).toEqual({ status: 'pushed' });
		expect(t.mock.requests.slice(before).filter((r) => r.method === 'PATCH').map((r) => r.body)).toEqual([{ teamIds: ['ew-team-b'] }]);
		expect(ewOf(t, 'g-parent')).toMatchObject({ teamIds: ['ew-team-a'] });
	});

	it('another refusal of the move still stops the change, and detaches nothing', async () => {
		const t = withTeams();
		t.addGauzyTask({ id: 'g-parent', title: 'Parent', teams: [{ id: 'g-team-a' }] });
		t.addGauzyTask({ id: 'g-child', title: 'Child', parentId: 'g-parent', teams: [{ id: 'g-team-a' }] });
		await t.push('g-parent');
		await t.push('g-child');
		Object.assign(t.tasks.get('g-parent') as GauzyTask, { teams: [{ id: 'g-team-b' }] });
		t.mock.fail({ method: 'PATCH', path: /^\/tasks\/[^/]+$/, status: 400, body: { error: { code: 'validation_failed', message: 'teamIds is not valid.' } } });
		await expect(t.push('g-parent')).rejects.toMatchObject({ status: 400, code: 'validation_failed' });
		expect(ewOf(t, 'g-child')?.['parentTaskId']).toBe(ewOf(t, 'g-parent')?.['id']);
		expect(t.logged).toEqual([]);
	});
});
