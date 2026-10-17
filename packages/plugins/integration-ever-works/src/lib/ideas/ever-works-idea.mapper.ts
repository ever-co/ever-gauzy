// cspell:ignore bdquo hellip laquo larr ldquo lsquo middot ndash plusmn raquo rarr rdquo rsquo sbquo
import { ID } from '@gauzy/contracts';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import { EVER_WORKS_IDEA_ISSUE_TYPE } from '../mapping/ever-works-mapping.defaults';
import { EverWorksTaskStatus, GauzyStatusFlags, gauzyStatusToEverWorks } from '../sync/mappers/status-priority.mapper';
import type { EverWorksTeamScope } from '../teams/ever-works-team-scope';

/** Ever Works idea statuses (contract v1 `idea.schema.json`, closed set). */
export type EverWorksIdeaStatus = 'pending' | 'dismissed' | 'accepted' | 'queued' | 'building' | 'failed';

/** An Ever Works idea (contract v1 idea DTO; also the `data` of `idea.*` events). */
export interface EverWorksIdea {
	id: string;
	organizationId?: string;
	version?: number;
	updatedAt?: string;
	visibility?: string;
	visibilityExplicit?: boolean;
	owner?: { type: 'user' | 'agent' | 'integration'; id: string } | null;
	externalLinks?: Array<{
		source: string;
		installationId?: string | null;
		externalId: string;
		externalUrl?: string | null;
	}>;
	teamIds?: string[];
	title?: string;
	description?: string;
	status?: EverWorksIdeaStatus;
	source?: string;
	missionId?: string | null;
	targetWorkId?: string | null;
	acceptedWorkId?: string | null;
	failureMessage?: string | null;
	webUrl?: string | null;
	deleted?: boolean;
}

/** Ever Works' limits on an idea (contract v1 `CreateIdea` / `UpdateIdea`). */
export const EVER_WORKS_IDEA_TITLE_MAX = 120;
export const EVER_WORKS_IDEA_DESCRIPTION_MAX = 100_000;

/** The `issueType` spelling of an idea task (the seeded issue type's value, plan 01 §8). */
export const GAUZY_IDEA_ISSUE_TYPE = EVER_WORKS_IDEA_ISSUE_TYPE.value;

/**
 * Whether a Gauzy task is an idea: its issue type is the organization's seeded "Idea" type (by id) or
 * spelled "Idea". Idea tasks sync as Ever Works ideas (`IDEA_TASK`), never as Ever Works tasks.
 */
export function isIdeaTask(
	task: { issueType?: string | null; taskTypeId?: string | null } | null | undefined,
	ideaIssueTypeId?: string | null
): boolean {
	if (!task) return false;
	if (ideaIssueTypeId && task.taskTypeId === ideaIssueTypeId) return true;
	return (
		String(task.issueType ?? '')
			.trim()
			.toLowerCase() === GAUZY_IDEA_ISSUE_TYPE.toLowerCase()
	);
}

/**
 * EW → G (plan 01 §8): the Ever Works task status whose Gauzy status an idea status takes — pending →
 * open, queued / building → in progress, accepted → done, dismissed → cancelled, failed → blocked.
 * Unknown → `null` (leave the Gauzy status unchanged).
 */
export function ideaStatusAsTaskStatus(status: string | null | undefined): EverWorksTaskStatus | null {
	switch (status) {
		case 'pending':
			return 'todo';
		case 'queued':
		case 'building':
			return 'in_progress';
		case 'accepted':
			return 'done';
		case 'dismissed':
			return 'cancelled';
		case 'failed':
			return 'blocked';
		default:
			return null;
	}
}

/**
 * G → EW: what a Gauzy status change does to the idea. Only dismissing (Gauzy cancelled) and restoring
 * (out of cancelled) are pushed; accepting and building stay Ever Works actions (spend safety, D9), so
 * any other move is not pushed.
 */
export function ideaStatusAction(
	everWorksStatus: string | null | undefined,
	gauzyStatus: string | null | undefined,
	flags: GauzyStatusFlags = {}
): 'dismiss' | 'restore' | null {
	const mapped = gauzyStatusToEverWorks(gauzyStatus, flags);
	if (mapped === null) return null;
	const cancelled = mapped === 'cancelled';
	if (cancelled && everWorksStatus === 'pending') return 'dismiss';
	if (!cancelled && everWorksStatus === 'dismissed') return 'restore';
	return null;
}

const escapeHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

/**
 * EW → G: an idea's plain-text description as Gauzy task HTML — escaped, one paragraph per blank-line
 * block, single line breaks kept. Nothing from Ever Works is rendered as markup.
 */
export function ideaTextToHtml(text: string | null | undefined): string {
	const value = String(text ?? '')
		.replace(/\r\n?/g, '\n')
		.trim();
	if (!value) return '';
	return value
		.split(/\n{2,}/)
		.map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

/** G → EW: a Gauzy task's HTML description as the plain text of an idea (the inverse of {@link ideaTextToHtml}). */
export function htmlToIdeaText(html: string | null | undefined): string {
	return (
		String(html ?? '')
			.replace(/\r\n?/g, '\n')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, '\n\n')
			.replace(/<li[^>]*>/gi, '- ')
			.replace(/<[^>]*>/g, '')
			// One pass over every character reference (numeric and named), so `&amp;lt;` stays `&lt;`.
			.replace(
				/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});/gi,
				(match, ref: string) => decodeReference(ref) ?? match
			)
			.replace(/ /g, ' ')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}

/** Named character references a rich-text editor writes (the rest of HTML's list is rare in task text). */
const NAMED_REFERENCES: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	ndash: '–',
	mdash: '—',
	lsquo: '‘',
	rsquo: '’',
	sbquo: '‚',
	ldquo: '“',
	rdquo: '”',
	bdquo: '„',
	hellip: '…',
	bull: '•',
	middot: '·',
	laquo: '«',
	raquo: '»',
	copy: '©',
	reg: '®',
	trade: '™',
	deg: '°',
	euro: '€',
	pound: '£',
	yen: '¥',
	cent: '¢',
	times: '×',
	divide: '÷',
	plusmn: '±',
	larr: '←',
	rarr: '→',
	shy: '­'
};

/** One HTML character reference (`#8212`, `#x27`, `rsquo`) as its character, or `undefined` for one it does not know. */
function decodeReference(ref: string): string | undefined {
	if (ref[0] === '#') {
		const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
		const valid = Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
		return valid ? String.fromCodePoint(code) : undefined;
	}
	return NAMED_REFERENCES[ref] ?? NAMED_REFERENCES[ref.toLowerCase()];
}

/**
 * An idea text as it reads after a trip through Gauzy (text → HTML → text): the form snapshots keep, so
 * whitespace Ever Works has and Gauzy drops never flaps back as a change (lossy fields never flap).
 */
export function normalizeIdeaText(text: string | null | undefined): string {
	return htmlToIdeaText(ideaTextToHtml(text));
}

/** The shared fields of an idea task in Ever Works' terms: what a sync compares in both directions. */
export interface IdeaSharedFields {
	title: string;
	description: string;
	teamIds: string[];
}

/**
 * G → EW: the idea a Gauzy task makes. The title is cut to Ever Works' 120 characters (the full title
 * then opens the description, plan 01 §7); an empty description takes the title, since Ever Works
 * requires one.
 */
export function gauzyTaskToIdea(
	task: { title?: string | null; description?: string | null },
	scope: EverWorksTeamScope,
	keepTeamIds: ReadonlyArray<string> = []
): IdeaSharedFields & { visibility: EverWorksTeamScope['visibility'] } {
	const fullTitle = String(task.title ?? '').trim();
	const title = fullTitle.slice(0, EVER_WORKS_IDEA_TITLE_MAX);
	// In the form snapshots keep (text → HTML → text), so what is sent compares equal to what comes back.
	let description = normalizeIdeaText(htmlToIdeaText(task.description));
	// The full title opens the description once: a description that already starts with it (it came back
	// from Ever Works with it) is not prefixed again.
	if (fullTitle.length > EVER_WORKS_IDEA_TITLE_MAX && !description.startsWith(fullTitle))
		description = description ? `${fullTitle}\n\n${description}` : fullTitle;
	if (!description) description = title;
	// Ever Works teams Gauzy cannot map stay on the idea: Gauzy never had them, so it never removes them.
	const teamIds = [...new Set([...scope.teamIds, ...keepTeamIds])].sort();
	return {
		title,
		description: description.slice(0, EVER_WORKS_IDEA_DESCRIPTION_MAX),
		teamIds,
		visibility: teamIds.length ? 'team' : scope.visibility
	};
}

/** `POST /ideas` body (contract v1 `CreateIdea`, CR-5): always created `external` + `pending` by Ever Works. */
export function ideaCreateBody(
	idea: IdeaSharedFields & { visibility: string },
	connectionId: ID,
	taskId: ID
): Record<string, unknown> {
	return {
		title: idea.title,
		description: idea.description,
		teamIds: idea.teamIds,
		visibility: idea.visibility,
		externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: taskId }
	};
}

/** `PATCH /ideas/:id` body (`UpdateIdea`): only the shared fields that differ from the last sync, or `null`. */
export function ideaPatchBody(
	now: IdeaSharedFields & { visibility: string },
	snapshot: Partial<IdeaSharedFields>
): Record<string, unknown> | null {
	const patch: Record<string, unknown> = {};
	if (now.title && now.title !== snapshot.title) patch['title'] = now.title;
	if (now.description && now.description !== snapshot.description) patch['description'] = now.description;
	if (!sameSet(now.teamIds, snapshot.teamIds ?? [])) {
		patch['teamIds'] = now.teamIds;
		patch['visibility'] = now.visibility;
	}
	return Object.keys(patch).length ? patch : null;
}

/** EW → G: the shared fields of an Ever Works idea, falling back to the last sync for what an event leaves out. */
export function everWorksIdeaShared(idea: EverWorksIdea, before: Partial<IdeaSharedFields>): IdeaSharedFields {
	return {
		title: idea.title !== undefined ? idea.title.trim() : (before.title ?? ''),
		description: idea.description !== undefined ? normalizeIdeaText(idea.description) : (before.description ?? ''),
		teamIds: [...(idea.teamIds ?? before.teamIds ?? [])].sort()
	};
}

/** The Gauzy tag an idea's `source` becomes (plan 01 §8). */
export function ideaSourceTag(source: string | null | undefined): string | null {
	const value = String(source ?? '').trim();
	return value ? `source:${value}`.slice(0, 120) : null;
}

/** The Gauzy task that made an Ever Works idea (its `externalLinks` back to Gauzy through this connection), or `null`. */
export function gauzyTaskOfIdea(idea: EverWorksIdea, connectionId: ID): ID | null {
	const link = (idea.externalLinks ?? []).find(
		(l) =>
			l.source === EVER_WORKS_LINK_SOURCE &&
			(!l.installationId || l.installationId === connectionId) &&
			!!l.externalId
	);
	return link ? (link.externalId as ID) : null;
}

export function sameSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
	const left = new Set(a);
	const right = new Set(b);
	return left.size === right.size && [...right].every((value) => left.has(value));
}
