import { InboxItemKindEnum, InboxItemPriorityEnum, InboxItemSourceEnum, InboxItemStatusEnum } from '@gauzy/contracts';
import { attentionItemOf, JIRA_INBOX_SOURCE } from './jira-attention';

const tenant = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1' };

describe('attentionItemOf', () => {
	it('files one open, high-priority notice per connection for the people who manage it', () => {
		const item = attentionItemOf(tenant, 'token_refused', ['user-1', 'user-2']);
		expect(item).toMatchObject({
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			kind: InboxItemKindEnum.NOTICE,
			source: InboxItemSourceEnum.SYSTEM,
			priority: InboxItemPriorityEnum.HIGH,
			status: InboxItemStatusEnum.OPEN,
			replaceRecipients: true,
			externalSource: JIRA_INBOX_SOURCE,
			externalId: 'int-1:attention',
			metadata: { integrationId: 'int-1', reason: 'token_refused' },
			recipients: [
				{ userId: 'user-1', isRead: false, isArchived: false },
				{ userId: 'user-2', isRead: false, isArchived: false }
			]
		});
		expect(item.title).toContain('refused');
		expect(item.body).toContain('Settings → Integrations → Jira');
	});

	it('resolves the same item, at a normal priority, when the connection works again', () => {
		const item = attentionItemOf(tenant, null, ['user-1']);
		expect(item.recipients).toEqual([{ userId: 'user-1' }]);
		expect(item).toMatchObject({ status: InboxItemStatusEnum.RESOLVED, priority: InboxItemPriorityEnum.NORMAL, externalId: 'int-1:attention', metadata: { integrationId: 'int-1', reason: null } });
		expect(item.body).toContain('again');
	});
});
