const mockCaller = { operator: false };

jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => 'tenant-1' },
	TenantSettingService: class TenantSettingService {},
	isInstallationOperator: () => mockCaller.operator
}));
jest.mock('../docs.config', () => ({
	getDocsConfig: () => ({
		orgQuotaBytes: 0,
		aiEnabled: false,
		embeddingModel: 'none',
		maxFileSize: 1024,
		inboundEmailEnabled: false
	})
}));
jest.mock('../knowledge/vector-store/vector-store.registry', () => ({
	DocumentVectorStoreRegistry: { resolve: async () => null }
}));
jest.mock('./document-quota.service', () => ({ DocumentQuotaService: class DocumentQuotaService {} }));
jest.mock('../dto/document-settings.dto', () => ({}));

import { ForbiddenException } from '@nestjs/common';
import { DOCS_QUOTA_OPERATOR_ONLY } from '../docs.constants';
import { DocumentSettingsService } from './document-settings.service';

const ORG = 'org-1';
const QUOTA = `docs.${ORG}.quotaBytes`;
const GIB = 1024 * 1024 * 1024;

function buildService(stored: Record<string, string> = { [QUOTA]: String(2 * GIB) }) {
	const tenantSettingService = {
		getSettings: jest.fn(async () => stored),
		saveSettings: jest.fn(async () => ({}))
	};
	const quotaService = {
		getQuotaState: jest.fn(async () => ({
			quotaBytes: 2 * GIB,
			usedBytes: GIB,
			remainingBytes: GIB,
			unlimited: false
		}))
	};
	const service = new DocumentSettingsService(tenantSettingService as any, quotaService as any);
	return { service, tenantSettingService };
}

/**
 * Owner decision 14 (2026-10-22): only the installation operator, or later the tenant's billing plan, sets an
 * organization's storage quota (`0` = unlimited). Before, any `DOCS_MANAGE` holder raised it or lifted it with
 * `PUT /plugins/docs/settings {"quotaBytes":0}`. `DOCS_MANAGE` still sees the usage and the limit.
 */
describe('DocumentSettingsService — the storage quota is the installation operator’s to set', () => {
	beforeEach(() => {
		mockCaller.operator = false;
	});

	it('refuses a caller who does not operate the installation, before writing anything', async () => {
		const { service, tenantSettingService } = buildService();

		await expect(service.updateSettings(ORG, { quotaBytes: 0 })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.updateSettings(ORG, { quotaBytes: 10 * GIB })).rejects.toBeInstanceOf(ForbiddenException);

		expect(tenantSettingService.saveSettings).not.toHaveBeenCalled();
	});

	it('refuses the whole body, so the other defaults it carries are not half applied', async () => {
		const { service, tenantSettingService } = buildService();

		const refusal = await service.updateSettings(ORG, { autoClassify: false, quotaBytes: 0 }).catch((e) => e);

		expect(refusal).toBeInstanceOf(ForbiddenException);
		expect((refusal as ForbiddenException).getResponse()).toEqual(
			expect.objectContaining({ code: DOCS_QUOTA_OPERATOR_ONLY })
		);
		expect(tenantSettingService.saveSettings).not.toHaveBeenCalled();
	});

	it('still saves the other defaults for a DOCS_MANAGE holder', async () => {
		const { service, tenantSettingService } = buildService();

		await service.updateSettings(ORG, { autoClassify: false });

		expect(tenantSettingService.saveSettings).toHaveBeenCalledWith(
			{ [`docs.${ORG}.autoClassify`]: 'false' },
			'tenant-1'
		);
	});

	it('saves the quota for the operator, an explicit 0 (unlimited) included', async () => {
		mockCaller.operator = true;
		const { service, tenantSettingService } = buildService();

		await service.updateSettings(ORG, { quotaBytes: 0 });

		expect(tenantSettingService.saveSettings).toHaveBeenCalledWith({ [QUOTA]: '0' }, 'tenant-1');
	});

	it('shows every reader the usage and the limit, and says only to the operator that it may change it', async () => {
		const { service } = buildService();

		const settings = await service.getSettings(ORG);

		expect(settings.defaults.quotaBytes).toBe(2 * GIB);
		expect(settings.quota).toEqual(expect.objectContaining({ quotaBytes: 2 * GIB, usedBytes: GIB }));
		expect(settings.canEditQuota).toBe(false);

		mockCaller.operator = true;
		expect((await service.getSettings(ORG)).canEditQuota).toBe(true);
	});
});
