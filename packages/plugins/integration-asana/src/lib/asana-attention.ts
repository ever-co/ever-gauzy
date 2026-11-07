import { ID, IInboxItemUpsertInput, InboxItemBodyFormatEnum, InboxItemKindEnum, InboxItemPriorityEnum, InboxItemSourceEnum, InboxItemStatusEnum } from '@gauzy/contracts';

/** The `externalSource` of the Inbox items the integration files (one per connection: keyed by it). */
export const ASANA_INBOX_SOURCE = 'integration-asana';

/** The connection the item is about: its id and where it lives. */
export interface AsanaAttentionTenant {
	id: ID;
	tenantId: ID;
	organizationId: ID;
}

/**
 * The Inbox item that tells the person who connected that Asana refused the connection's token — imports, webhooks and the scheduled sync of its Asana mappings are paused
 * until someone connects again — or, with no reason, that the connection works again (the same item, resolved).
 * One item per connection: a second refusal updates it rather than filing another.
 */
export function attentionItemOf(tenant: AsanaAttentionTenant, reason: string | null, recipientUserIds: readonly ID[]): IInboxItemUpsertInput {
	const open = !!reason;
	return {
		tenantId: tenant.tenantId,
		organizationId: tenant.organizationId,
		kind: InboxItemKindEnum.NOTICE,
		source: InboxItemSourceEnum.SYSTEM,
		title: `Asana refused the connection's token`,
		body: open
			? `Until someone connects Asana again (Settings → Integrations → Asana), the organization's imports, webhooks and the scheduled sync of its Asana mappings are paused.`
			: `Asana accepted the connection again; its imports go on.`,
		bodyFormat: InboxItemBodyFormatEnum.PLAIN,
		priority: open ? InboxItemPriorityEnum.HIGH : InboxItemPriorityEnum.NORMAL,
		status: open ? InboxItemStatusEnum.OPEN : InboxItemStatusEnum.RESOLVED,
		metadata: { integrationId: tenant.id, reason },
		externalSource: ASANA_INBOX_SOURCE,
		externalId: `${tenant.id}:attention`,
		recipients: recipientUserIds.map((userId) => ({ userId }))
	};
}
