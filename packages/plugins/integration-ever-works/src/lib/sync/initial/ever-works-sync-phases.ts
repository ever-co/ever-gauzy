import type { EverWorksEventEnvelope } from '../../client/ever-works-client.types';
import type { EverWorksDirection, EverWorksDomain } from '../../mapping/ever-works-mapping.defaults';
import { EverWorksLinkType } from '../entities/ever-works-sync.entities';

/** The phases of an initial sync or resync, in order (plan 03 §C.6 step 3). */
export const EVER_WORKS_SYNC_PHASES = [
	'members',
	'agents',
	'teams',
	'works',
	'missions',
	'goals',
	'ideas',
	'tasks',
	'task_edges',
	'comments',
	'inbox',
	'docs'
] as const;

export type EverWorksSyncPhaseName = (typeof EVER_WORKS_SYNC_PHASES)[number];

/**
 * How a phase brings Ever Works records over:
 *
 * - `mapping_only`: nothing is imported (people are paired on the People tab, never created);
 * - `list`: every record of a list route becomes one initial event, applied by the aggregate's handler
 *   like a live event (one writer per connection, version check, loop guard);
 * - `children`: per linked parent, its child records (the last 200 comments of each synced task);
 * - `included`: carried by another phase's records (task edges are part of the task DTO).
 */
export type EverWorksSyncPhaseKind = 'mapping_only' | 'list' | 'children' | 'included';

/** One phase: what it reads, which handler applies it, and which links it counts. */
export interface EverWorksSyncPhaseSpec {
	name: EverWorksSyncPhaseName;
	domain: EverWorksDomain;
	kind: EverWorksSyncPhaseKind;
	/** The inbound handler key (the envelope's `aggregate.type`). */
	aggregateType: string | null;
	/** The identity-map type of the records it pairs. */
	linkType: EverWorksLinkType | null;
	/** The list route (contract v1 B.6) and its query passes (each pass is read in full). */
	list?: { path: string; passes?: Array<Record<string, string>> };
	/** The DTO field naming the record's parent of the same kind: parents are applied first. */
	parentField?: string;
	/** The scope the list route needs (a key without it skips the phase). */
	scope?: string;
}

/** Plan 03 §C.6 step 3, as this version can run it. Later handlers (goals, missions, ideas, inbox, docs) plug in by aggregate type. */
export const EVER_WORKS_SYNC_PHASE_SPECS: ReadonlyArray<EverWorksSyncPhaseSpec> = [
	{ name: 'members', domain: 'members', kind: 'mapping_only', aggregateType: null, linkType: EverWorksLinkType.MEMBER, list: { path: '/members' }, scope: 'members:read' },
	{ name: 'agents', domain: 'agents', kind: 'list', aggregateType: 'agent', linkType: EverWorksLinkType.AGENT, list: { path: '/agents' }, parentField: 'reportsToAgentId', scope: 'agents:read' },
	{ name: 'teams', domain: 'teams', kind: 'list', aggregateType: 'team', linkType: EverWorksLinkType.TEAM, list: { path: '/teams' }, parentField: 'parentTeamId', scope: 'teams:read' },
	{ name: 'works', domain: 'works', kind: 'list', aggregateType: 'work', linkType: EverWorksLinkType.PROJECT_WORK, list: { path: '/works' }, scope: 'works:read' },
	{ name: 'missions', domain: 'missions', kind: 'list', aggregateType: 'mission', linkType: EverWorksLinkType.INITIATIVE_MISSION, list: { path: '/missions' }, scope: 'missions:read' },
	{ name: 'goals', domain: 'goals', kind: 'list', aggregateType: 'goal', linkType: EverWorksLinkType.GOAL, list: { path: '/goals' }, scope: 'goals:read' },
	{ name: 'ideas', domain: 'ideas', kind: 'list', aggregateType: 'idea', linkType: EverWorksLinkType.IDEA_TASK, list: { path: '/ideas' }, scope: 'ideas:read' },
	{ name: 'tasks', domain: 'tasks', kind: 'list', aggregateType: 'task', linkType: EverWorksLinkType.TASK, list: { path: '/tasks' }, parentField: 'parentTaskId', scope: 'tasks:read' },
	{ name: 'task_edges', domain: 'tasks', kind: 'included', aggregateType: 'task', linkType: null },
	{ name: 'comments', domain: 'tasks', kind: 'children', aggregateType: 'task', linkType: EverWorksLinkType.COMMENT, scope: 'tasks:read' },
	{
		name: 'inbox',
		domain: 'inbox',
		kind: 'list',
		aggregateType: 'inbox_item',
		linkType: EverWorksLinkType.INBOX_ITEM,
		// Open items, plus everything updated in the last 30 days (answered items among them).
		list: { path: '/inbox/items', passes: [{ status: 'open' }, { updatedSince: '{{30d}}' }] },
		scope: 'inbox:read'
	},
	{ name: 'docs', domain: 'docs', kind: 'list', aggregateType: 'kb_document', linkType: EverWorksLinkType.DOC, list: { path: '/kb/documents' }, scope: 'kb:read' }
];

/** Comments read per synced task (plan 03 §C.6: the last 200). */
export const COMMENTS_PER_TASK = 200;

/** The most list pages one phase reads (500 records each): a phase beyond it fails rather than stop silently. */
export const PHASE_MAX_PAGES = 2000;

/** The most list pages the dry run reads per phase (it reports `truncated` beyond). */
export const PREVIEW_MAX_PAGES = 20;

/**
 * Initial `seq`s: each page read gets a band of {@link PAGE_SEQ_STRIDE}, so pages apply in the order read;
 * inside a page, records of one depth share a band of {@link DEPTH_STRIDE}, so parents apply first.
 */
export const PAGE_SEQ_STRIDE = 1_000_000;
export const DEPTH_STRIDE = 1_000;

/** Comment events sort after every task event of an initial sync (far above any page band). */
export const COMMENTS_SEQ_BASE = 1_000_000_000_000_000;

export const fromEverWorks = (direction: EverWorksDirection | undefined): boolean => direction === 'both' || direction === 'ew_to_gauzy';
export const toEverWorks = (direction: EverWorksDirection | undefined): boolean => direction === 'both' || direction === 'gauzy_to_ew';

/**
 * How deep each record sits under parents of the same list (0 = no parent in the list), so parents are
 * applied before their children; a cycle is cut where it closes.
 */
export function depthsOf(records: ReadonlyArray<Record<string, unknown>>, parentField: string | undefined): Map<string, number> {
	const parentOf = new Map<string, string | null>();
	for (const record of records) {
		const id = String(record['id']);
		const parent = parentField ? record[parentField] : null;
		parentOf.set(id, typeof parent === 'string' && parent ? parent : null);
	}
	const depths = new Map<string, number>();
	for (const id of parentOf.keys()) {
		const chain = new Set<string>([id]);
		let depth = 0;
		let parent = parentOf.get(id) ?? null;
		while (parent && parentOf.has(parent) && !chain.has(parent)) {
			chain.add(parent);
			depth++;
			parent = parentOf.get(parent) ?? null;
		}
		depths.set(id, depth);
	}
	return depths;
}

/**
 * The records of a list in apply order: by depth (parents first), then as listed. Deleted records and
 * private ones (which an integration key never sees, but a copy might carry) are left out.
 */
export function orderForImport<T extends Record<string, unknown>>(records: ReadonlyArray<T>, parentField: string | undefined): Array<{ record: T; depth: number }> {
	const live = records.filter((record) => record && typeof record['id'] === 'string' && record['deleted'] !== true && record['visibility'] !== 'private');
	const depths = depthsOf(live, parentField);
	return live
		.map((record, index) => ({ record, depth: depths.get(String(record['id'])) ?? 0, index }))
		.sort((a, b) => a.depth - b.depth || a.index - b.index)
		.map(({ record, depth }) => ({ record, depth }));
}

/** The initial `seq` of the n-th record of a depth band in a page band (a decimal string, compared as an integer). */
export function initialSeq(depth: number, index: number, base = 0): string {
	return String(base + Math.min(depth, 999) * DEPTH_STRIDE + Math.min(index, DEPTH_STRIDE - 1));
}

/** Event ids are at most 64 characters (`ever_works_inbound_event.eventId`). */
function eventId(parts: string[]): string {
	return parts.join(':').slice(0, 64);
}

/** A number, in base 36, that changes when the record changes (its version, else its update time). */
function revisionOf(record: Record<string, unknown>): string {
	const version = record['version'];
	if (typeof version === 'number' && Number.isFinite(version)) return `v${version}`;
	const updatedAt = typeof record['updatedAt'] === 'string' ? Date.parse(record['updatedAt']) : Number.NaN;
	return Number.isFinite(updatedAt) ? `t${updatedAt.toString(36)}` : 'v0';
}

/** The catalog type (contract B.4) an initial snapshot of each aggregate is delivered as. */
export const INITIAL_EVENT_TYPES: Readonly<Record<string, string>> = {
	agent: 'agent.updated',
	team: 'team.updated',
	work: 'work.updated',
	mission: 'mission.updated',
	goal: 'goal.updated',
	idea: 'idea.updated',
	task: 'task.updated',
	inbox_item: 'inbox.item.created',
	kb_document: 'kb.document.updated'
};

/**
 * The initial event of one listed record: the same envelope a live `<type>.updated` carries, so the
 * aggregate's handler applies it the same way (an unpaired team or work is left for its tab; an agent is
 * provisioned; a record already applied at that version is skipped). Its id names the record and its
 * version, so the same snapshot is stored once however often a sync runs.
 */
export function initialEnvelope(input: {
	aggregateType: string;
	record: Record<string, unknown>;
	seq: string;
	tenantId: string;
	organizationId: string;
}): EverWorksEventEnvelope {
	const id = String(input.record['id']);
	const version = typeof input.record['version'] === 'number' ? (input.record['version'] as number) : null;
	return {
		id: eventId(['initial', input.aggregateType, id, revisionOf(input.record)]),
		seq: input.seq,
		type: INITIAL_EVENT_TYPES[input.aggregateType] ?? `${input.aggregateType}.updated`,
		version: 1,
		occurredAt: typeof input.record['updatedAt'] === 'string' ? (input.record['updatedAt'] as string) : new Date().toISOString(),
		tenantId: input.tenantId,
		organizationId: input.organizationId,
		aggregate: { type: input.aggregateType, id, version: version as number },
		actor: { type: 'system', id: 'initial-sync', label: 'Initial sync' },
		origin: null,
		data: input.record
	};
}

/** The initial event of one task comment: a `task.comment.created` on its task (contract B.3 child events). */
export function initialCommentEnvelope(input: {
	taskId: string;
	taskVersion: number | null;
	comment: Record<string, unknown>;
	seq: string;
	tenantId: string;
	organizationId: string;
}): EverWorksEventEnvelope {
	const id = String(input.comment['id']);
	return {
		id: eventId(['initial', 'comment', id, revisionOf(input.comment)]),
		seq: input.seq,
		type: 'task.comment.created',
		version: 1,
		occurredAt: typeof input.comment['updatedAt'] === 'string' ? (input.comment['updatedAt'] as string) : new Date().toISOString(),
		tenantId: input.tenantId,
		organizationId: input.organizationId,
		aggregate: { type: 'task', id: input.taskId, version: input.taskVersion as number },
		actor: { type: 'system', id: 'initial-sync', label: 'Initial sync' },
		origin: null,
		data: { ...input.comment, taskId: input.taskId }
	};
}

/** Replaces the `{{30d}}` placeholder of a list pass with the ISO time 30 days before `now`. */
export function resolvePass(pass: Record<string, string>, now: Date): Record<string, string> {
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
	return Object.fromEntries(Object.entries(pass).map(([key, value]) => [key, value === '{{30d}}' ? thirtyDaysAgo : value]));
}
