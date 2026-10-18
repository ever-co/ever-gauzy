import {
	BaseEntityEnum,
	ID,
	IInboxItemOption,
	IInboxItemResponse,
	IInboxItemUpsertInput,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import type { EverWorksInboxItem } from '../client/ever-works-client.types';

/** The external identity of a synced item in the Gauzy Inbox (`externalSource`; `externalId` = the EW id). */
export const EVER_WORKS_INBOX_EXTERNAL_SOURCE = 'ever_works';

/** What `routed` reads for an answer given in Ever Works itself (not through Gauzy). */
export const EVER_WORKS_ROUTED_IN_APP = 'ever_works';

/** EW kind → G kind (plan 04 §4); a kind this plugin does not know arrives as a notice. */
export function inboxKindOf(kind: string | null | undefined): InboxItemKindEnum {
	switch (kind) {
		case 'question':
			return InboxItemKindEnum.QUESTION;
		case 'approval':
			return InboxItemKindEnum.APPROVAL;
		case 'escalation':
			return InboxItemKindEnum.ESCALATION;
		default:
			return InboxItemKindEnum.NOTICE;
	}
}

/**
 * EW status → G item status. An answer makes it ANSWERED (EW keeps the answer on an archived item: `archived`
 * is the recipient's state, plan 04 §4); a deleted item is CANCELLED (EW items are never deleted from Gauzy).
 */
export function inboxStatusOf(
	item: Pick<EverWorksInboxItem, 'answeredAt' | 'deleted'>,
	deleted = false
): InboxItemStatusEnum {
	if (deleted || item.deleted) return InboxItemStatusEnum.CANCELLED;
	return item.answeredAt ? InboxItemStatusEnum.ANSWERED : InboxItemStatusEnum.OPEN;
}

/** The answer of an EW item, as the Gauzy item records it (`answeredByUserId` = the mapped recipient). */
export function inboxResponseOf(
	item: Pick<EverWorksInboxItem, 'answeredAt' | 'answerText' | 'answerOptionId'>,
	answeredByUserId: ID
): IInboxItemResponse | null {
	if (!item.answeredAt) return null;
	return {
		text: item.answerText ?? null,
		optionId: item.answerOptionId ?? null,
		answeredByUserId,
		answeredAt: item.answeredAt,
		routed: EVER_WORKS_ROUTED_IN_APP
	};
}

/** EW options → G options (only the fields the contract defines; a malformed entry is left out). */
export function inboxOptionsOf(options: EverWorksInboxItem['options']): IInboxItemOption[] | null {
	if (!Array.isArray(options)) return null;
	const mapped = options
		.filter((option) => option && typeof option.id === 'string' && option.id && typeof option.label === 'string')
		.map((option) => ({
			id: option.id,
			label: option.label,
			...(typeof option.description === 'string' ? { description: option.description } : {}),
			...(option.recommended === true ? { recommended: true } : {})
		}));
	return mapped.length ? mapped : null;
}

/** The Gauzy records an EW item links to, resolved through the integration's links (`null` = not linked). */
export interface EverWorksInboxLinks {
	taskId: ID | null;
	projectId: ID | null;
	agentEmployeeId: ID | null;
}

/**
 * The Gauzy Inbox write of an EW item (plan 04 §4): `source = EVER_WORKS`, identity `ever_works` / the EW id,
 * kind, title, body, options, status and answer, the task / project / agent links, the EW-only fields in
 * `metadata.everWorks`, and the one recipient with the state EW holds (`unread` → read, `archived` → archived).
 */
export function inboxUpsertOf(
	item: EverWorksInboxItem,
	scope: { tenantId: ID; organizationId: ID; recipientUserId: ID },
	links: EverWorksInboxLinks,
	options: { deleted?: boolean } = {}
): IInboxItemUpsertInput {
	const deleted = !!options.deleted || item.deleted === true;
	const kind = inboxKindOf(item.kind);
	return {
		tenantId: scope.tenantId,
		organizationId: scope.organizationId,
		kind,
		source: InboxItemSourceEnum.EVER_WORKS,
		externalSource: EVER_WORKS_INBOX_EXTERNAL_SOURCE,
		externalId: item.id,
		title: (item.title || '').trim() || 'Ever Works',
		body: item.body ?? null,
		bodyFormat: InboxItemBodyFormatEnum.MARKDOWN,
		options: inboxOptionsOf(item.options),
		requireReason: false,
		status: inboxStatusOf(item, deleted),
		response: inboxResponseOf(item, scope.recipientUserId),
		priority: kind === InboxItemKindEnum.ESCALATION ? InboxItemPriorityEnum.HIGH : InboxItemPriorityEnum.NORMAL,
		entity: links.taskId ? BaseEntityEnum.Task : null,
		entityId: links.taskId,
		taskId: links.taskId,
		projectId: links.projectId,
		agentEmployeeId: links.agentEmployeeId,
		metadata: {
			everWorks: {
				id: item.id,
				version: item.version ?? null,
				sourceType: item.sourceType ?? null,
				status: item.status ?? null,
				agentId: item.agentId ?? null,
				agentRunId: item.agentRunId ?? null,
				taskId: item.taskId ?? null,
				workId: item.workId ?? null,
				escalationId: item.escalationId ?? null,
				proposalId: item.proposalId ?? null,
				webUrl: item.webUrl ?? null
			}
		},
		recipients: [
			{
				userId: scope.recipientUserId,
				isRead: !item.unread,
				isArchived: deleted || item.status === 'archived'
			}
		],
		// An Ever Works item has exactly one recipient: a member paired again takes it from the person paired before,
		// who stops reading it and its later updates (review F93).
		replaceRecipients: true
	};
}

/** The EW state change of a Gauzy recipient change (`PATCH /inbox/items/:id/state`); `null` when nothing maps. */
export function everWorksStateOf(change: {
	isRead?: boolean;
	isArchived?: boolean;
}): { unread?: boolean; archived?: boolean } | null {
	const state: { unread?: boolean; archived?: boolean } = {};
	if (typeof change.isRead === 'boolean') state.unread = !change.isRead;
	if (typeof change.isArchived === 'boolean') state.archived = change.isArchived;
	return Object.keys(state).length ? state : null;
}
