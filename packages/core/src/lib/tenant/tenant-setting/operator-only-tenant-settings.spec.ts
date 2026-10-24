import { ForbiddenException } from '@nestjs/common';
import { In, Not } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { isListedInstallationOperator, OPERATOR_USER_IDS_ENV } from './global-setting-writer';
import {
	assertMayWriteTenantSettings,
	isInstallationOperator,
	isOperatorOnlyTenantSetting,
	keepingOperatorOnlySettings,
	TENANT_SETTING_OPERATOR_ONLY
} from './operator-only-tenant-settings';

const ORG = 'a0000000-0000-4000-8000-00000000000a';
const QUOTA = `docs.${ORG}.quotaBytes`;

/**
 * An organization's Documents storage limit (`docs.<organizationId>.quotaBytes`, `0` = unlimited) is a row of the
 * tenant's own settings, and every tenant admin holds `TENANT_SETTING`: `POST /tenant-setting/dynamic` lifted it.
 * Owner decision 14 (2026-10-22): only the installation operator sets it — a super admin listed in
 * `EVER_OPERATOR_USER_IDS`, nobody when the list is unset.
 */
describe('operator-only tenant settings', () => {
	const savedList = process.env[OPERATOR_USER_IDS_ENV];

	const signIn = (userId: string | null, role: RolesEnum | null) => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
		jest.spyOn(RequestContext, 'hasRole').mockImplementation((asked: RolesEnum) => asked === role);
	};

	beforeEach(() => {
		delete process.env[OPERATOR_USER_IDS_ENV];
	});

	afterEach(() => {
		if (savedList === undefined) delete process.env[OPERATOR_USER_IDS_ENV];
		else process.env[OPERATOR_USER_IDS_ENV] = savedList;
		jest.restoreAllMocks();
	});

	describe('isOperatorOnlyTenantSetting', () => {
		it("names an organization's Documents storage limit, however its case or trailing spaces are written", () => {
			expect(isOperatorOnlyTenantSetting(QUOTA)).toBe(true);
			expect(isOperatorOnlyTenantSetting(QUOTA.toUpperCase())).toBe(true);
			expect(isOperatorOnlyTenantSetting(`  ${QUOTA} `)).toBe(true);
			expect(isOperatorOnlyTenantSetting('docs.ANY-ORG.QuotaBytes')).toBe(true);
		});

		it("leaves every other setting, the organization's other Documents defaults included, to TENANT_SETTING", () => {
			expect(isOperatorOnlyTenantSetting(`docs.${ORG}.autoClassify`)).toBe(false);
			expect(isOperatorOnlyTenantSetting(`docs.${ORG}.defaultVisibility`)).toBe(false);
			expect(isOperatorOnlyTenantSetting(`docs.${ORG}.inboundToken`)).toBe(false);
			expect(isOperatorOnlyTenantSetting('fileStorageProvider')).toBe(false);
			expect(isOperatorOnlyTenantSetting('quotaBytes')).toBe(false);
			expect(isOperatorOnlyTenantSetting(undefined)).toBe(false);
			expect(isOperatorOnlyTenantSetting(42)).toBe(false);
		});
	});

	describe('isListedInstallationOperator', () => {
		it('names nobody when EVER_OPERATOR_USER_IDS is unset, not even the super admin of a single tenant', () => {
			expect(isListedInstallationOperator('user-1', true, {})).toBe(false);
			expect(isListedInstallationOperator('user-1', true, { [OPERATOR_USER_IDS_ENV]: ' , ' })).toBe(false);
		});

		it('names a listed user only while they are a super admin', () => {
			const env = { [OPERATOR_USER_IDS_ENV]: ' Operator-1 , operator-2 ' };

			expect(isListedInstallationOperator('operator-1', true, env)).toBe(true);
			expect(isListedInstallationOperator('OPERATOR-2', true, env)).toBe(true);
			expect(isListedInstallationOperator('operator-1', false, env)).toBe(false);
			expect(isListedInstallationOperator('user-3', true, env)).toBe(false);
			expect(isListedInstallationOperator(null, true, env)).toBe(false);
		});
	});

	describe('isInstallationOperator', () => {
		it('reads the signed-in user and their role now', () => {
			process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';

			signIn('operator-1', RolesEnum.SUPER_ADMIN);
			expect(isInstallationOperator()).toBe(true);

			signIn('operator-1', RolesEnum.ADMIN);
			expect(isInstallationOperator()).toBe(false);

			signIn(null, null);
			expect(isInstallationOperator()).toBe(false);
		});
	});

	describe('assertMayWriteTenantSettings', () => {
		it("refuses a tenant's super admin the storage limit, alone or among other keys", () => {
			signIn('admin-1', RolesEnum.SUPER_ADMIN);

			expect(() => assertMayWriteTenantSettings([QUOTA])).toThrow(ForbiddenException);
			expect(() => assertMayWriteTenantSettings(['preferredUi', QUOTA.toUpperCase()])).toThrow(
				ForbiddenException
			);
			try {
				assertMayWriteTenantSettings([QUOTA]);
			} catch (error) {
				expect((error as ForbiddenException).getResponse()).toEqual(
					expect.objectContaining({ code: TENANT_SETTING_OPERATOR_ONLY })
				);
			}
		});

		it('refuses a listed user who is no longer a super admin', () => {
			process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';
			signIn('operator-1', RolesEnum.ADMIN);

			expect(() => assertMayWriteTenantSettings([QUOTA])).toThrow(ForbiddenException);
		});

		it('lets the operator write it', () => {
			process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';
			signIn('operator-1', RolesEnum.SUPER_ADMIN);

			expect(() => assertMayWriteTenantSettings([QUOTA, 'preferredUi'])).not.toThrow();
		});

		it('lets anyone write the other settings, as before', () => {
			signIn('admin-1', RolesEnum.ADMIN);

			expect(() =>
				assertMayWriteTenantSettings(['fileStorageProvider', `docs.${ORG}.autoClassify`, undefined])
			).not.toThrow();
		});
	});

	describe('keepingOperatorOnlySettings', () => {
		const repository = () => ({
			find: jest.fn().mockResolvedValue([
				{ id: 'row-quota', name: QUOTA },
				{ id: 'row-ui', name: 'preferredUi' },
				{ id: 'row-quota-2', name: `docs.${ORG.replace('a', 'b')}.QUOTABYTES` }
			])
		});

		it("keeps the tenant's storage limits, soft-deleted ones included, out of a wipe by anyone else", async () => {
			signIn('admin-1', RolesEnum.SUPER_ADMIN);
			const repo = repository();

			const criteria = await keepingOperatorOnlySettings(repo, { tenantId: 'tenant-1' });

			expect(repo.find).toHaveBeenCalledWith({
				select: { id: true, name: true },
				where: { tenantId: 'tenant-1' },
				withDeleted: true
			});
			expect(criteria).toEqual({ tenantId: 'tenant-1', id: Not(In(['row-quota', 'row-quota-2'])) });
		});

		it('wipes them all, as before, for the operator', async () => {
			process.env[OPERATOR_USER_IDS_ENV] = 'operator-1';
			signIn('operator-1', RolesEnum.SUPER_ADMIN);
			const repo = repository();

			expect(await keepingOperatorOnlySettings(repo, { tenantId: 'tenant-1' })).toEqual({ tenantId: 'tenant-1' });
			expect(repo.find).not.toHaveBeenCalled();
		});

		it('leaves the criteria alone when the tenant has no storage limit row', async () => {
			signIn('admin-1', RolesEnum.SUPER_ADMIN);
			const repo = { find: jest.fn().mockResolvedValue([{ id: 'row-ui', name: 'preferredUi' }]) };

			expect(await keepingOperatorOnlySettings(repo, { tenantId: 'tenant-1' })).toEqual({ tenantId: 'tenant-1' });
		});
	});
});
