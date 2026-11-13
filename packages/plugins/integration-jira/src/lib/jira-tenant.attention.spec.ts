import { Logger } from '@nestjs/common';
import { InboxItemStatusEnum } from '@gauzy/contracts';
import { ATTENTION_NOTICE_DEFERRED, JIRA_INBOX_SOURCE } from './jira-attention';
import { JiraTenantService } from './jira-tenant.service';
import { JiraSettingName } from './jira.constants';

type Recipients = { recipients: Array<{ userId: string; isRead?: boolean; isArchived?: boolean }>; replaceRecipients: boolean; status: string; externalSource: string };

/**
 * A refused token is told in the Inbox to the integration's managers (FR-10): the person who connected and every
 * member of the organization whose role may add or edit integrations, each once.
 */
function harness(options: { connectedBy?: string | null; managers?: string[] | Error; truncated?: boolean; noticedAt?: string; inboxFails?: boolean } = {}) {
	const settings: Array<{ id: string; settingsName: string; settingsValue: string }> = [{ id: 'set-token', settingsName: JiraSettingName.ACCESS_TOKEN, settingsValue: 'token-1' }];
	if (options.connectedBy !== null) settings.push({ id: 'set-user', settingsName: JiraSettingName.CONNECTED_BY_USER_ID, settingsValue: options.connectedBy ?? 'user-connector' });
	// The timestamp an earlier refusal left (a resolution whose filing failed).
	if (options.noticedAt) settings.push({ id: 'set-notice', settingsName: JiraSettingName.ATTENTION_NOTICE_AT, settingsValue: options.noticedAt });
	const row = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1', settings };
	const findManagers = jest.fn(async (_scope: { tenantId: string; organizationId: string }): Promise<{ userIds: string[]; truncated: boolean }> => {
		if (options.managers instanceof Error) throw options.managers;
		return { userIds: options.managers ?? [], truncated: !!options.truncated };
	});
	const integrationTenantService = { typeOrmRepository: { findOne: jest.fn(async () => row), find: jest.fn(async () => [row]) }, findManagers };
	let created = 0;
	const integrationSettingService = {
		update: jest.fn(async () => ({ affected: 1 })),
		create: jest.fn(async (input: Record<string, unknown>) => ({ id: `set-new-${++created}`, ...input }))
	};
	const inbox = {
		upsertExternal: jest.fn(async (_item: Record<string, unknown>) => {
			if (options.inboxFails) throw new Error('inbox down');
			return { id: 'item-1' };
		})
	};
	const service = new JiraTenantService({} as never, integrationTenantService as never, integrationSettingService as never, {} as never, inbox as never);
	/** The item of the n-th filing. */
	const filed = (index: number) => inbox.upsertExternal.mock.calls[index][0] as unknown as Recipients;
	/** The recorded filing timestamp ('' when cleared, undefined when never written). */
	const noticedAt = () => row.settings.find((setting) => setting.settingsName === JiraSettingName.ATTENTION_NOTICE_AT)?.settingsValue;
	return { service, row, inbox, findManagers, filed, noticedAt, settingsWriter: integrationSettingService };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('JiraTenantService — the refused-token notice', () => {
	it('files it for the person who connected and the organization\'s integration managers, each once', async () => {
		const { service, row, findManagers, filed, noticedAt } = harness({ managers: ['user-manager', 'user-connector', 'user-admin'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(findManagers).toHaveBeenCalledWith({ tenantId: 'tenant-1', organizationId: 'org-1' });
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager', 'user-admin']);
		expect(filed(0)).toMatchObject({ status: InboxItemStatusEnum.OPEN, externalSource: JIRA_INBOX_SOURCE, replaceRecipients: true });
		// The filing is recorded, so the sweep does not file it again.
		expect(noticedAt()).toBeTruthy();
	});

	it('reaches the managers when nobody is recorded as having connected', async () => {
		const { service, row, filed } = harness({ connectedBy: null, managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-manager']);
	});

	it('defers an open notice to the sweep when the managers cannot be read: nothing filed, marked deferred', async () => {
		const { service, row, inbox, findManagers, filed, noticedAt } = harness({ managers: new Error('store down') });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(inbox.upsertExternal).not.toHaveBeenCalled();
		expect(noticedAt()).toBe(ATTENTION_NOTICE_DEFERRED);
		expect(await service.findRefusedUnfiled()).toHaveLength(1);
		// The sweep files it once the managers can be read: with them, replacing the recipients, re-surfaced (the
		// refusal is new to them, even to one who archived an earlier notice), and recorded.
		findManagers.mockResolvedValue({ userIds: ['user-manager'], truncated: false });
		await service.ensureAttentionFiled(row as never);
		expect(filed(0).recipients).toEqual([
			{ userId: 'user-connector', isRead: false, isArchived: false },
			{ userId: 'user-manager', isRead: false, isArchived: false }
		]);
		expect(filed(0).replaceRecipients).toBe(true);
		expect(noticedAt()).not.toBe(ATTENTION_NOTICE_DEFERRED);
		expect(noticedAt()).toBeTruthy();
	});

	it('re-surfaces a refusal the Inbox did not take when the sweep files it', async () => {
		const { service, row, inbox, filed, noticedAt } = harness({ managers: ['user-manager'] });
		inbox.upsertExternal.mockRejectedValueOnce(new Error('inbox down'));
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(noticedAt()).toBe(ATTENTION_NOTICE_DEFERRED);
		await service.ensureAttentionFiled(row as never);
		expect(filed(1).recipients).toEqual([
			{ userId: 'user-connector', isRead: false, isArchived: false },
			{ userId: 'user-manager', isRead: false, isArchived: false }
		]);
	});

	it('does not re-surface a retry of a filing the Inbox took but whose timestamp was not recorded', async () => {
		const { service, row, filed, settingsWriter } = harness({ managers: ['user-manager'] });
		// The Inbox takes the filing; recording its timestamp fails.
		settingsWriter.create.mockImplementation(async (input: Record<string, unknown>) => {
			if (input['settingsName'] === JiraSettingName.ATTENTION_NOTICE_AT) throw new Error('store down');
			return { id: `set-${String(input['settingsName'])}`, ...input };
		});
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients[0]).toMatchObject({ isRead: false });
		await service.ensureAttentionFiled(row as never);
		expect(filed(1).recipients).toEqual([{ userId: 'user-connector' }, { userId: 'user-manager' }]);
	});

	it('across a reconnect, a refusal whose managers cannot be read reaches nobody until the sweep replaces the recipients without the former connector', async () => {
		const { service, row, inbox, findManagers, filed } = harness({ connectedBy: 'user-former', managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-former', 'user-manager']);
		// Someone else connects again: the notice is resolved, and the connection is theirs now.
		await service.setAttention(row as never, null);
		const connector = row.settings.find((setting) => setting.settingsName === JiraSettingName.CONNECTED_BY_USER_ID);
		if (connector) connector.settingsValue = 'user-new';
		// The new token is refused while the managers cannot be read: the shared item is not reopened for anyone.
		findManagers.mockRejectedValueOnce(new Error('store down'));
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(inbox.upsertExternal).toHaveBeenCalledTimes(2);
		// The sweep files it for the new connector and the managers, replacing the recipients: the former connector is dropped.
		await service.ensureAttentionFiled(row as never);
		expect(filed(2).recipients.map((recipient) => recipient.userId)).toEqual(['user-new', 'user-manager']);
		expect(filed(2).replaceRecipients).toBe(true);
	});

	it('files for the managers read without removing anyone when the read was cut at the limit, and records it', async () => {
		const { service, row, filed, noticedAt } = harness({ managers: ['user-manager-1', 'user-manager-2'], truncated: true });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager-1', 'user-manager-2']);
		expect(filed(0).replaceRecipients).toBe(false);
		// Recorded: the sweep does not file it again every five minutes.
		expect(noticedAt()).toBeTruthy();
	});

	describe('a new refusal never inherits the filing timestamp of an earlier one', () => {
		const earlier = '2026-11-01T00:00:00.000Z';

		it('when the managers cannot be read', async () => {
			const { service, row, noticedAt } = harness({ managers: new Error('store down'), noticedAt: earlier });
			await service.setAttention(row as never, 'token_refused', 'token-1');
			expect(noticedAt()).toBe(ATTENTION_NOTICE_DEFERRED);
		});

		it('when there is nobody to tell', async () => {
			const { service, row, inbox, noticedAt } = harness({ connectedBy: null, managers: [], noticedAt: earlier });
			await service.setAttention(row as never, 'token_refused', 'token-1');
			expect(inbox.upsertExternal).not.toHaveBeenCalled();
			expect(noticedAt()).toBe('');
		});

		it('when the Inbox refuses the filing', async () => {
			const { service, row, inbox, noticedAt } = harness({ managers: ['user-manager'], noticedAt: earlier, inboxFails: true });
			await service.setAttention(row as never, 'token_refused', 'token-1');
			expect(inbox.upsertExternal).toHaveBeenCalledTimes(1);
			// Not the earlier timestamp: marked deferred, so the sweep files it and re-surfaces it.
			expect(noticedAt()).toBe(ATTENTION_NOTICE_DEFERRED);
		});
	});

	it('files nothing, and records nothing, with nobody to tell (the sweep tries again)', async () => {
		const { service, row, inbox, noticedAt } = harness({ connectedBy: null, managers: [] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(inbox.upsertExternal).not.toHaveBeenCalled();
		expect(noticedAt()).toBeUndefined();
	});

	it('resolves the notice for the managers too when the connection works again', async () => {
		const { service, row, filed } = harness({ managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		await service.setAttention(row as never, null);
		expect(filed(1)).toMatchObject({ status: InboxItemStatusEnum.RESOLVED, replaceRecipients: false });
		expect(filed(1).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager']);
	});
});
