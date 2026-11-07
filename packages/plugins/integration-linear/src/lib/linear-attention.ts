import { ID, IInboxItemUpsertInput, InboxItemBodyFormatEnum, InboxItemKindEnum, InboxItemPriorityEnum, InboxItemSourceEnum, InboxItemStatusEnum } from '@gauzy/contracts';

/** The `externalSource` of the Inbox items the integration files (one per connection: keyed by it). */
export const LINEAR_INBOX_SOURCE = 'integration-linear';

/** The connection the item is about: its id and where it lives. */
export interface LinearAttentionTenant {
	id: ID;
	tenantId: ID;
	organizationId: ID;
}

/**
 * The Inbox item that tells the person who connected that Linear refused the connection's token — imports, webhooks and the scheduled sync of its Linear mappings are paused
 * until someone connects again — or, with no reason, that the connection works again (the same item, resolved).
 * One item per connection: a second refusal updates it rather than filing another.
 */
export function attentionItemOf(tenant: LinearAttentionTenant, reason: string | null, recipientUserIds: readonly ID[], resurface = true): IInboxItemUpsertInput {
	const open = !!reason;
	return {
		tenantId: tenant.tenantId,
		organizationId: tenant.organizationId,
		kind: InboxItemKindEnum.NOTICE,
		source: InboxItemSourceEnum.SYSTEM,
		title: `Linear refused the connection's token`,
		body: open
			? `Until someone connects Linear again (Settings → Integrations → Linear), the organization's imports, webhooks and the scheduled sync of its Linear mappings are paused.`
			: `Linear accepted the connection again; its imports go on.`,
		bodyFormat: InboxItemBodyFormatEnum.PLAIN,
		priority: open ? InboxItemPriorityEnum.HIGH : InboxItemPriorityEnum.NORMAL,
		status: open ? InboxItemStatusEnum.OPEN : InboxItemStatusEnum.RESOLVED,
		metadata: { integrationId: tenant.id, reason },
		externalSource: LINEAR_INBOX_SOURCE,
		externalId: `${tenant.id}:attention`,
		// An open notice is the current connecting user's alone (a former one is not told of a refusal that is not theirs);
		// a resolution keeps everyone the notice reached.
		replaceRecipients: open,
		// A new refusal re-surfaces the notice: the recipient reads it again, from the inbox it may have archived it from.
		// (a retry of a filing that was taken but not recorded names the recipient without touching their read state).
		recipients: recipientUserIds.map((userId) => (open && resurface ? { userId, isRead: false, isArchived: false } : { userId }))
	};
}
