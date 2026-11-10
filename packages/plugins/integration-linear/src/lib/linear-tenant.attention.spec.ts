import { Logger } from '@nestjs/common';
import { InboxItemStatusEnum } from '@gauzy/contracts';
import { LINEAR_INBOX_SOURCE } from './linear-attention';
import { LinearTenantService } from './linear-tenant.service';
import { LinearSettingName } from './linear.constants';

/**
 * A refused token is told in the Inbox to the integration's managers (FR-10): the person who connected and every
 * member of the organization whose role may add or edit integrations, each once.
 */
function harness(options: { connectedBy?: string | null; managers?: string[] | Error } = {}) {
	const settings: Array<{ id: string; settingsName: string; settingsValue: string }> = [{ id: 'set-token', settingsName: LinearSettingName.ACCESS_TOKEN, settingsValue: 'token-1' }];
	if (options.connectedBy !== null) settings.push({ id: 'set-user', settingsName: LinearSettingName.CONNECTED_BY_USER_ID, settingsValue: options.connectedBy ?? 'user-connector' });
	const row = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1', settings };
	const findManagerUserIds = jest.fn(async () => {
		if (options.managers instanceof Error) throw options.managers;
		return options.managers ?? [];
	});
	const integrationTenantService = { typeOrmRepository: { findOne: jest.fn(async () => row) }, findManagerUserIds };
	let created = 0;
	const integrationSettingService = {
		update: jest.fn(async () => ({ affected: 1 })),
		create: jest.fn(async (input: Record<string, unknown>) => ({ id: `set-new-${++created}`, ...input }))
	};
	const inbox = { upsertExternal: jest.fn(async () => ({ id: 'item-1' })) };
	const service = new LinearTenantService({} as never, integrationTenantService as never, integrationSettingService as never, {} as never, inbox as never);
	return { service, row, inbox, findManagerUserIds };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('LinearTenantService — the refused-token notice', () => {
	it('files it for the person who connected and the organization\'s integration managers, each once', async () => {
		const { service, row, inbox, findManagerUserIds } = harness({ managers: ['user-manager', 'user-connector', 'user-admin'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(findManagerUserIds).toHaveBeenCalledWith({ tenantId: 'tenant-1', organizationId: 'org-1' });
		expect(inbox.upsertExternal).toHaveBeenCalledTimes(1);
		const item = inbox.upsertExternal.mock.calls[0][0] as { recipients: Array<{ userId: string }>; status: string; externalSource: string; replaceRecipients: boolean };
		expect(item.recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager', 'user-admin']);
		expect(item).toMatchObject({ status: InboxItemStatusEnum.OPEN, externalSource: LINEAR_INBOX_SOURCE, replaceRecipients: true });
		// The filing is recorded, so the sweep does not file it again.
		expect(row.settings.some((setting) => setting.settingsName === LinearSettingName.ATTENTION_NOTICE_AT)).toBe(true);
	});

	it('reaches the managers when nobody is recorded as having connected', async () => {
		const { service, row, inbox } = harness({ connectedBy: null, managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect((inbox.upsertExternal.mock.calls[0][0] as { recipients: Array<{ userId: string }> }).recipients.map((recipient) => recipient.userId)).toEqual(['user-manager']);
	});

	it('still tells the person who connected when the managers cannot be read', async () => {
		const { service, row, inbox } = harness({ managers: new Error('store down') });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect((inbox.upsertExternal.mock.calls[0][0] as { recipients: Array<{ userId: string }> }).recipients.map((recipient) => recipient.userId)).toEqual(['user-connector']);
	});

	it('files nothing, and records nothing, with nobody to tell (the sweep tries again)', async () => {
		const { service, row, inbox } = harness({ connectedBy: null, managers: [] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		expect(inbox.upsertExternal).not.toHaveBeenCalled();
		expect(row.settings.some((setting) => setting.settingsName === LinearSettingName.ATTENTION_NOTICE_AT)).toBe(false);
	});

	it('resolves the notice for the managers too when the connection works again', async () => {
		const { service, row, inbox } = harness({ managers: ['user-manager'] });
		await service.setAttention(row as never, 'token_refused', 'token-1');
		await service.setAttention(row as never, null);
		const resolution = inbox.upsertExternal.mock.calls[1][0] as { recipients: Array<{ userId: string }>; status: string; replaceRecipients: boolean };
		expect(resolution).toMatchObject({ status: InboxItemStatusEnum.RESOLVED, replaceRecipients: false });
		expect(resolution.recipients.map((recipient) => recipient.userId)).toEqual(['user-connector', 'user-manager']);
	});
});
