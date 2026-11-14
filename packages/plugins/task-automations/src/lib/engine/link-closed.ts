import { ID, ITaskLinkClosedEvent } from '@gauzy/contracts';

/** The longest provider name, kind and external id a link's identity keeps (the columns of `task_automation_link_closure`). */
export const TASK_LINK_CLOSURE_LIMITS = Object.freeze({ provider: 32, kind: 24, externalId: 255 });

/**
 * The kind a pull request's merge is claimed under, beside its close (`pull_request`): a pull request closed without
 * merging, reopened and merged is reported twice — its first close for every link rule, its merge for the rules that
 * wait for one (`mergedOnly`) — and each of the two at most once. An issue has no merge.
 */
export const TASK_LINK_MERGE_CLAIM_KIND = 'pull_request.merged';

/** The identity of a closed link of a task: what makes it reported once. */
export interface ITaskLinkClosureKey {
	tenantId: ID;
	organizationId: ID;
	taskId: ID;
	provider: string;
	/** The link's kind; {@link TASK_LINK_MERGE_CLAIM_KIND} for the claim of a pull request's merge. */
	kind: ITaskLinkClosedEvent['kind'] | typeof TASK_LINK_MERGE_CLAIM_KIND;
	externalId: string;
}

/** A text of a payload, trimmed; `null` when it is none. */
function text(value: unknown): string | null {
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const trimmed = String(value).trim();
	return trimmed ? trimmed : null;
}

/**
 * A closed link's payload back, or `null` when it is not one: the task, its tenant and organization, and a kind the
 * contract names are required. `merged` and `closedBefore` are kept only as booleans. One parser serves both sides: the
 * consumer reads `closedBefore` from `task_link.closed`, where the capture set it; the capture parses an integration's
 * report with it too, and then overwrites it from the claims, so an integration never decides it.
 */
export function parseLinkClosedEvent(data: unknown): ITaskLinkClosedEvent | null {
	if (!data || typeof data !== 'object') return null;
	const value = data as Partial<ITaskLinkClosedEvent>;
	if (!value.taskId || !value.tenantId || !value.organizationId) return null;
	if (value.kind !== 'issue' && value.kind !== 'pull_request') return null;
	const event: ITaskLinkClosedEvent = {
		taskId: String(value.taskId),
		tenantId: String(value.tenantId),
		organizationId: String(value.organizationId),
		provider: String(value.provider ?? ''),
		kind: value.kind,
		url: value.url ?? null,
		externalId: value.externalId ?? null
	};
	if (typeof value.merged === 'boolean') event.merged = value.merged;
	if (typeof value.closedBefore === 'boolean') event.closedBefore = value.closedBefore;
	return event;
}

/**
 * The identity a closed link is reported under: the task and its scope, the provider (lower case), the kind, and the
 * provider's id of the item (its address when the provider gave no id). `null` when the report names no provider or
 * nothing that identifies the item: it could not be told apart from the next one, so it is not reported.
 */
export function linkClosureKeyOf(event: ITaskLinkClosedEvent): ITaskLinkClosureKey | null {
	const provider = text(event.provider)?.toLowerCase() ?? null;
	const externalId = text(event.externalId) ?? text(event.url);
	if (!provider || !externalId) return null;
	if (provider.length > TASK_LINK_CLOSURE_LIMITS.provider || externalId.length > TASK_LINK_CLOSURE_LIMITS.externalId) return null;
	return {
		tenantId: event.tenantId,
		organizationId: event.organizationId,
		taskId: event.taskId,
		provider,
		kind: event.kind,
		externalId
	};
}

/**
 * The identity a pull request's merge is claimed under (the close's, of kind {@link TASK_LINK_MERGE_CLAIM_KIND}), or
 * `null` when the closed link is no merged pull request.
 */
export function linkMergeKeyOf(
	event: Pick<ITaskLinkClosedEvent, 'kind' | 'merged'>,
	key: ITaskLinkClosureKey
): ITaskLinkClosureKey | null {
	return event.kind === 'pull_request' && event.merged === true ? { ...key, kind: TASK_LINK_MERGE_CLAIM_KIND } : null;
}
