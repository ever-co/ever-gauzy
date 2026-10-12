import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSettingController } from './integration-setting.controller';
import { isUserEditableIntegrationSetting, userEditableIntegrationSettings } from './integration-setting.utils';

/**
 * GHSA-4rwq-65wh-45h4 — cross-tenant GitHub installation takeover through the generic
 * `PUT /integration-setting/:id`.
 *
 * The route upserted `{ ...body, id }` onto any setting row of the caller's tenant. An attacker
 * installed the GitHub App on their own account, then rewrote their `installation_id` row to a
 * victim's installation id, skipping the install flow's nonce and first-claimant checks, and read
 * the victim's private repositories through their own integration.
 *
 * The route now updates only `settingsValue`, and only for settings on a per-provider allowlist
 * (the Gauzy AI keys the settings card edits). Every "fix" case is paired with a CONTROL that runs
 * the pre-fix controller body against the same row.
 */
describe('PUT /integration-setting/:id (GHSA-4rwq-65wh-45h4)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
	const OTHER_ORGANIZATION_ID = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
	const ROW_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';
	const VICTIM_INSTALLATION_ID = '98765432';

	let service: IntegrationSettingService;
	let controller: IntegrationSettingController;
	let create: jest.SpyInstance;

	const row = (provider: string, settingsName: string, settingsValue = 'old') => ({
		id: ROW_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		integrationId: 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0',
		integration: { id: 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', name: provider },
		settingsName,
		settingsValue
	});

	/** The pre-fix controller body, verbatim. */
	const preFixUpdate = async (id: string, input: any) => {
		await service.create({ ...input, id });
		return await service.findOneByIdString(id);
	};

	const stubRow = (stored: ReturnType<typeof row> | null) =>
		jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => {
			if (!stored) {
				// What the tenant-scoped lookup does for another tenant's id.
				throw new NotFoundException('The requested record was not found');
			}
			return stored as any;
		});

	beforeEach(() => {
		service = new IntegrationSettingService(
			{ metadata: { hasColumnWithPropertyPath: () => true } } as any,
			{} as any
		);
		controller = new IntegrationSettingController(service);
		create = jest.spyOn(service, 'create').mockImplementation(async (entity: any) => entity);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each([
		[IntegrationEnum.GITHUB, 'installation_id'],
		[IntegrationEnum.GITHUB, 'setup_action'],
		[IntegrationEnum.GITHUB, 'sync_tag'],
		[IntegrationEnum.GITHUB, 'access_token'],
		[IntegrationEnum.GITHUB, 'refresh_token'],
		[IntegrationEnum.HUBSTAFF, 'access_token'],
		[IntegrationEnum.UPWORK, 'accessToken'],
		[IntegrationEnum.ZAPIER, 'zapier_access_token'],
		[IntegrationEnum.MakeCom, 'make_organization_id'],
		[IntegrationEnum.ACTIVE_PIECES, 'project_id'],
		[IntegrationEnum.PLANE, 'plane_mode'],
		// A Gauzy AI key name on ANOTHER provider's row is not editable either.
		[IntegrationEnum.GITHUB, 'apiKey']
	])('%s / %s (server-managed)', (provider, settingsName) => {
		it('is refused, and nothing is written', async () => {
			stubRow(row(provider, settingsName));

			await expect(
				controller.update(ROW_ID, { settingsValue: VICTIM_INSTALLATION_ID, organizationId: ORGANIZATION_ID } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('CONTROL: the pre-fix route rewrote it', async () => {
			stubRow(row(provider, settingsName));

			await preFixUpdate(ROW_ID, { settingsValue: VICTIM_INSTALLATION_ID, organizationId: ORGANIZATION_ID });

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: ROW_ID, settingsValue: VICTIM_INSTALLATION_ID }));
		});
	});

	describe.each(['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId'])(
		'Gauzy AI / %s (edited by the AI settings card)',
		(settingsName) => {
			it('is updated, and only its value is written', async () => {
				stubRow(row(IntegrationEnum.GAUZY_AI, settingsName));

				// Exactly the payload integration-setting-card.component.ts sends.
				await controller.update(ROW_ID, {
					settingsName,
					settingsValue: 'new-key',
					organizationId: ORGANIZATION_ID,
					tenantId: TENANT_ID
				} as any);

				expect(create).toHaveBeenCalledTimes(1);
				expect(create.mock.calls[0][0]).toEqual({ id: ROW_ID, settingsValue: 'new-key' });
			});
		}
	);

	it('pins organizationId, settingsName and integrationId (the body cannot move or rename the row)', async () => {
		stubRow(row(IntegrationEnum.GAUZY_AI, 'apiKey'));
		const body = {
			settingsValue: 'new-key',
			organizationId: OTHER_ORGANIZATION_ID,
			settingsName: 'installation_id',
			integrationId: 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0'
		};

		await controller.update(ROW_ID, body as any);
		expect(create.mock.calls[0][0]).toEqual({ id: ROW_ID, settingsValue: 'new-key' });

		// CONTROL: the pre-fix route wrote the body's organizationId (and any other field the DTO kept).
		create.mockClear();
		await preFixUpdate(ROW_ID, { settingsValue: 'new-key', organizationId: OTHER_ORGANIZATION_ID });
		expect(create.mock.calls[0][0]).toEqual(
			expect.objectContaining({ organizationId: OTHER_ORGANIZATION_ID })
		);
	});

	it("loads the row tenant-scoped with its integration, and another tenant's id stays a 404", async () => {
		const lookup = stubRow(null);

		await expect(controller.update(ROW_ID, { settingsValue: 'x' } as any)).rejects.toBeInstanceOf(NotFoundException);
		expect(lookup).toHaveBeenCalledWith(ROW_ID, { relations: { integration: true } });
		expect(create).not.toHaveBeenCalled();
	});

	it('refuses a row whose integration could not be loaded', async () => {
		stubRow({ ...row(IntegrationEnum.GAUZY_AI, 'apiKey'), integration: null } as any);

		await expect(controller.update(ROW_ID, { settingsValue: 'x' } as any)).rejects.toBeInstanceOf(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});
});

describe('isUserEditableIntegrationSetting', () => {
	it('allows exactly the Gauzy AI keys', () => {
		expect(userEditableIntegrationSettings).toEqual({
			[IntegrationEnum.GAUZY_AI]: ['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId']
		});
		expect(isUserEditableIntegrationSetting(IntegrationEnum.GAUZY_AI, 'apiKey')).toBe(true);
		expect(isUserEditableIntegrationSetting(IntegrationEnum.GAUZY_AI, 'installation_id')).toBe(false);
	});

	it('is not fooled by prototype keys or missing values', () => {
		expect(isUserEditableIntegrationSetting('__proto__', 'apiKey')).toBe(false);
		expect(isUserEditableIntegrationSetting('constructor', 'apiKey')).toBe(false);
		expect(isUserEditableIntegrationSetting(IntegrationEnum.GAUZY_AI, 'constructor')).toBe(false);
		expect(isUserEditableIntegrationSetting(undefined, 'apiKey')).toBe(false);
		expect(isUserEditableIntegrationSetting(null, 'apiKey')).toBe(false);
		expect(isUserEditableIntegrationSetting(IntegrationEnum.GAUZY_AI, '')).toBe(false);
	});
});
