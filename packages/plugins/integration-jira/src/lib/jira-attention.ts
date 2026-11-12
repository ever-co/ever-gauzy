import { ID, IInboxItemUpsertInput, InboxItemBodyFormatEnum, InboxItemKindEnum, InboxItemPriorityEnum, InboxItemSourceEnum, InboxItemStatusEnum } from '@gauzy/contracts';

/** The `externalSource` of the Inbox items the integration files (one per connection: keyed by it). */
export const JIRA_INBOX_SOURCE = 'integration-jira';

/**
 * The value of a connection's `attention_notice_at` while its open notice waits to be filed for the first time (the
 * managers could not be read): the sweep files it then, re-surfacing it as the first filing of a refusal does.
 */
export const ATTENTION_NOTICE_DEFERRED = 'deferred';

/** The connection the item is about: its id and where it lives. */
export interface JiraAttentionTenant {
	id: ID;
	tenantId: ID;
	organizationId: ID;
}

/**
 * The Inbox item that tells the person who connected, and the organization's integration managers, that Jira refused the connection's token — imports, webhooks and the scheduled sync of its Jira mappings are paused
 * until someone connects again — or, with no reason, that the connection works again (the same item, resolved).
 * One item per connection: a second refusal updates it rather than filing another.
 */
export function attentionItemOf(
	tenant: JiraAttentionTenant,
	reason: string | null,
	recipientUserIds: readonly ID[],
	resurface = true,
	/** The recipients are known to be partial (the managers' read was cut at its limit): add them, remove nobody. */
	partial = false
): IInboxItemUpsertInput {
	const open = !!reason;
	return {
		tenantId: tenant.tenantId,
		organizationId: tenant.organizationId,
		kind: InboxItemKindEnum.NOTICE,
		source: InboxItemSourceEnum.SYSTEM,
		title: open ? `Jira refused the connection's token` : `Jira accepts the connection again`,
		body: open
			? `Until someone connects Jira again (Settings → Integrations → Jira), the organization's imports, webhooks and the scheduled sync of its Jira mappings are paused.`
			: `Jira accepted the connection again; its imports go on.`,
		bodyFormat: InboxItemBodyFormatEnum.PLAIN,
		priority: open ? InboxItemPriorityEnum.HIGH : InboxItemPriorityEnum.NORMAL,
		status: open ? InboxItemStatusEnum.OPEN : InboxItemStatusEnum.RESOLVED,
		metadata: { integrationId: tenant.id, reason },
		externalSource: JIRA_INBOX_SOURCE,
		externalId: `${tenant.id}:attention`,
		// An open notice is for the current connecting user and the current managers alone (a former one is not told of a refusal that is not theirs);
		// a resolution keeps everyone the notice reached, and so does a filing whose recipients are partial.
		replaceRecipients: open && !partial,
		// A new refusal re-surfaces the notice: the recipient reads it again, from the inbox it may have archived it from.
		// (a retry of a filing that was taken but not recorded names the recipient without touching their read state).
		recipients: recipientUserIds.map((userId) => (open && resurface ? { userId, isRead: false, isArchived: false } : { userId }))
	};
}
