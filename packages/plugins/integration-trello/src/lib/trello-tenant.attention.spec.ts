import { Logger } from '@nestjs/common';
import { InboxItemStatusEnum } from '@gauzy/contracts';
import { TRELLO_INBOX_SOURCE } from './trello-attention';
import { TrelloTenantService } from './trello-tenant.service';
import { TrelloSettingName } from './trello.constants';

type Recipients = { recipients: Array<{ userId: string }>; replaceRecipients: boolean; status: string; externalSource: string };

/**
 * A refused token is told in the Inbox to the integration's managers (FR-10): the person who connected and every
 * member of the organization whose role may add or edit integrations, each once.
 */
function harness(options: { connectedBy?: string | null; managers?: string[] | Error; truncated?: boolean; noticedAt?: string; inboxFails?: boolean } = {}) {
	const settings: Array<{ id: string; settingsName: string; settingsValue: string }> = [{ id: 'set-token', settingsName: TrelloSettingName.TOKEN, settingsValue: 'token-1' }];
	if (options.connectedBy !== null) settings.push({ id: 'set-user', settingsName: TrelloSettingName.CONNECTED_BY_USER_ID, settingsValue: options.connectedBy ?? 'user-connector' });
	// The timestamp an earlier refusal left (a resolution whose filing failed).
	if (options.noticedAt) settings.push({ id: 'set-notice', settingsName: TrelloSettingName.ATTENTION_NOTICE_AT, settingsValue: options.noticedAt });
	const row = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1', settings };
	const findManagers = jest.fn(async (_scope: { tenantId: string; organizationId: string }): Promise<{ userIds: string[]; truncated: boolean }> => {
		if (options.managers instanceof Error) throw options.managers;
		return { userIds: options.managers ?? [], truncated: !!options.truncated };
	});
	const integrationTenantService = { typeOrmRepository: { findOne: jest.fn(async () => row) }, findManagers };
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
	const service = new TrelloTenantService({} as never, integrationTenantService as never, integrationSettingService as never, {} as never, inbox as never);
	/** The item of the n-th filing. */
	const filed = (index: number) => inbox.upsertExternal.mock.calls[index][0] as unknown as Recipients;
	/** The recorded filing timestamp ('' when cleared, undefined when never written). */
	const noticedAt = () => row.settings.find((setting) => setting.settingsName === TrelloSettingName.ATTENTION_NOTICE_AT)?.settingsValue;
	return { service, row, inbox, findManagers, filed, noticedAt };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('TrelloTenantService — the refused-token notice', () => {
	it('files it for the person who connected and the organization\'s integration managers, each once', async () => {
		const { service, row, findManagers, filed, noticedAt } = harness({ managers: ['user-manager', 'user-connector', 'user-admin'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(findManagers).toHaveBeenCalledWith({ tenantId: 'tenant-1', organizationId: 'org-1' });
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager', 'user-admin']);
		expect(filed(0)).toMatchObject({ status: InboxItemStatusEnum.OPEN, externalSource: TRELLO_INBOX_SOURCE, replaceRecipients: true });
		// The filing is recorded, so the sweep does not file it again.
		expect(noticedAt()).toBeTruthy();
	});

	it('reaches the managers when nobody is recorded as having connected', async () => {
		const { service, row, filed } = harness({ connectedBy: null, managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-manager']);
	});

	it('still tells the person who connected when the managers cannot be read, removing nobody, and leaves it to the sweep', async () => {
		const { service, row, findManagers, filed, noticedAt } = harness({ managers: new Error('store down') });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(filed(0).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector']);
		// Partial: the managers who already had the notice keep it, and the filing is not recorded.
		expect(filed(0).replaceRecipients).toBe(false);
		expect(noticedAt()).toBeFalsy();
		// The sweep files it again once the managers can be read: with them, and recorded.
		findManagers.mockResolvedValue({ userIds: ['user-manager'], truncated: false });
		await service.ensureAttentionFiled(row as never);
		expect(filed(1).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager']);
		expect(filed(1).replaceRecipients).toBe(true);
		expect(noticedAt()).toBeTruthy();
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

		it('when the notice could only be filed partially', async () => {
			const { service, row, noticedAt } = harness({ managers: new Error('store down'), noticedAt: earlier });
			await service.setAttention(row as never, 'token_refused', 'token-1');
			expect(noticedAt()).toBe('');
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
			expect(noticedAt()).toBe('');
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
