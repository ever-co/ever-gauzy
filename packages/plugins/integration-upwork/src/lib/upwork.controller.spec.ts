/**
 * Regression cover for GHSA-3rqg-gpm9-gx84 — Upwork credential exposure over the HTTP surface.
 *
 * `GET /integrations/upwork/config/:integrationId` used to read the integration's stored settings
 * into a plain object and answer with `{ accessToken, consumerKey, consumerSecret, accessSecret }`
 * in cleartext, bypassing the `IntegrationSetting` masking that governs every other read of those
 * values. The Angular app then cached that config and posted it back on `/freelancer-contracts`,
 * `/work-diary` and `/sync-contracts-related-data`, so live Upwork OAuth credentials passed through
 * browser memory, request URLs and every proxy log in between.
 *
 * These specs drive the controller — the actual attack surface — and assert at the Upwork SDK
 * boundary, so they describe behaviour rather than an implementation shape. Request payloads are
 * cast to `any` on purpose: an untrusted caller sends JSON, not a typed DTO.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';

/** The tenant the authenticated caller belongs to, as the request context reports it. */
const CURRENT_TENANT_ID = 'tenant-aaaa';
/** A tenant the caller does NOT belong to, used to try to widen the lookup from the request body. */
const FOREIGN_TENANT_ID = 'tenant-bbbb';
const ORGANIZATION_ID = 'org-1111';
const INTEGRATION_ID = 'integration-1111';

/** Cleartext credential material that must never appear in an HTTP response. */
const SECRETS = {
	accessToken: 'upwork-access-token-AAAA',
	accessTokenSecret: 'upwork-access-token-secret-BBBB',
	consumerKey: 'upwork-consumer-key-CCCC',
	consumerSecret: 'upwork-consumer-secret-DDDD'
};

jest.mock('@gauzy/config', () => ({
	environment: { upwork: { callbackUrl: 'http://localhost/callback' }, defaultCurrency: 'USD' }
}));

jest.mock('@gauzy/plugin-job-proposal', () => ({ ProposalCreateCommand: class {} }));

// The transaction service pulls in the ESM-only `uuid` build; the controller needs it as a DI token only.
jest.mock('./upwork-transaction.service', () => ({ UpworkTransactionService: class {} }));

/**
 * Stands in for the Upwork SDK and records what it was handed.
 *
 * This is the boundary the whole advisory is about: whatever ends up here is what signs a live
 * Upwork request, so asserting on it proves where the credentials came from.
 */
jest.mock('upwork-api', () => {
	const calls: any[] = [];
	class MockUpworkApi {
		static calls = calls;
		constructor(public readonly config: any) {
			calls.push({ type: 'construct', config });
		}
		setAccessToken(accessToken: string, accessSecret: string, callback: () => void) {
			calls.push({ type: 'setAccessToken', accessToken, accessSecret });
			callback();
		}
	}
	return MockUpworkApi;
});

jest.mock('upwork-api/lib/routers/hr/engagements.js', () => ({
	Engagements: class {
		getList(_params: any, callback: (error: any, data: any) => void) {
			callback(null, { engagements: { engagement: [{ reference: 'contract-1' }] } });
		}
	}
}));

jest.mock('upwork-api/lib/routers/workdiary.js', () => ({
	Workdiary: class {
		getByContract(contractId: string, date: string, _params: any, callback: (error: any, data: any) => void) {
			callback(null, { contractId, date });
		}
	}
}));

jest.mock('upwork-api/lib/routers/snapshot.js', () => ({ Snapshot: class {} }));
jest.mock('upwork-api/lib/routers/auth.js', () => ({ Auth: class {} }));
jest.mock('upwork-api/lib/routers/organization/users.js', () => ({ Users: class {} }));

jest.mock('@gauzy/core', () => {
	// The masking primitive itself is the real one — part of the fix is that the route reaches for
	// the platform's single masker rather than growing a bespoke one.
	const { maskSecret } = jest.requireActual('../../../../core/src/lib/core/decorators/is-secret');

	/** Minimal stand-in for a CQRS command that carries its input for assertions. */
	class Command {
		constructor(public readonly input: any) {}
	}

	return {
		maskSecret,
		// Literal rather than the shared constant: a `jest.mock` factory runs before this module's
		// own `const` bindings are initialized.
		RequestContext: { currentTenantId: jest.fn(() => 'tenant-aaaa') },
		mergeOverlappingDateRanges: jest.fn((ranges: any) => ranges),
		parseFindOptionsRelations: jest.fn((relations: any) => relations),
		unixTimestampToDate: jest.fn((value: any) => value),
		// Services injected into `UpworkService` — DI tokens only, never called by these specs.
		ExpenseService: class {},
		IncomeService: class {},
		IntegrationMapService: class {},
		OrganizationService: class {},
		RoleService: class {},
		TimeSlotService: class {},
		UserService: class {},
		// Guards, pipes and decorators the controller declares.
		ParseJsonPipe: class {},
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		UUIDValidationPipe: class {},
		Permissions: () => () => undefined,
		// Commands.
		CreateTimeSlotMinutesCommand: class extends Command {},
		EmployeeCreateCommand: class extends Command {},
		EmployeeGetCommand: class extends Command {},
		ExpenseCategoryFirstOrCreateCommand: class extends Command {},
		ExpenseCreateCommand: class extends Command {},
		IncomeCreateCommand: class extends Command {},
		IntegrationMapSyncEntityCommand: class extends Command {},
		IntegrationSettingCreateCommand: class extends Command {},
		IntegrationSettingGetCommand: class extends Command {},
		IntegrationSettingGetManyCommand: class extends Command {},
		IntegrationTenantGetCommand: class extends Command {},
		IntegrationTenantUpdateOrCreateCommand: class extends Command {},
		OrganizationContactCreateCommand: class extends Command {},
		OrganizationProjectCreateCommand: class extends Command {},
		OrganizationProjectUpdateCommand: class extends Command {},
		OrganizationVendorFirstOrCreateCommand: class extends Command {},
		ScreenshotCreateCommand: class extends Command {},
		TimeLogCreateCommand: class extends Command {},
		TimeSlotCreateCommand: class extends Command {}
	};
});

import * as UpworkApi from 'upwork-api';
import { IntegrationSettingGetManyCommand, IntegrationTenantGetCommand } from '@gauzy/core';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';

/** The recorded Upwork SDK interactions, exposed by the mock above. */
const upworkSdkCalls = (UpworkApi as any).calls as any[];

/** The credential quadruple the SDK must be handed, assembled from the stored settings. */
const EXPECTED_API_CONFIG = {
	accessToken: SECRETS.accessToken,
	accessSecret: SECRETS.accessTokenSecret,
	consumerKey: SECRETS.consumerKey,
	consumerSecret: SECRETS.consumerSecret
};

/** The integration row the tenant-scoped lookup resolves to when the caller is entitled to it. */
const INTEGRATION = { id: INTEGRATION_ID, organizationId: ORGANIZATION_ID, tenantId: CURRENT_TENANT_ID };

/** The stored settings rows, in the `settingsName` / `settingsValue` shape the API returns. */
const INTEGRATION_SETTINGS = Object.entries(SECRETS).map(([settingsName, settingsValue]) => ({
	settingsName,
	settingsValue,
	organizationId: ORGANIZATION_ID,
	tenantId: CURRENT_TENANT_ID
}));

/**
 * Builds a controller wired to a real `UpworkService` whose command bus is stubbed.
 *
 * @param options.integration - What the tenant-scoped integration lookup resolves to. `null` models
 *                              an integration that does not exist inside the caller's scope.
 * @param options.settings - The settings rows the scoped settings read returns.
 * @returns The controller, the service and the command-bus spy for assertions on the lookups made.
 */
const buildController = (options: { integration?: any; settings?: any[] } = {}) => {
	const integration = 'integration' in options ? options.integration : INTEGRATION;
	const settings = options.settings ?? INTEGRATION_SETTINGS;

	const commandBus: any = {
		execute: jest.fn(async (command: any) => {
			if (command instanceof IntegrationTenantGetCommand) {
				return integration;
			}
			if (command instanceof IntegrationSettingGetManyCommand) {
				// A tenant-scoped settings read can only return rows when an integration resolved.
				return integration ? settings : [];
			}
			return undefined;
		})
	};

	const noop: any = {};
	const service = new UpworkService(noop, noop, noop, noop, noop, noop, noop, noop, noop, noop, commandBus);
	const controller = new UpworkController(noop, service);

	return { controller, service, commandBus };
};

/**
 * Collects every `IntegrationTenantGetCommand` the service dispatched.
 *
 * @param commandBus - The stubbed command bus.
 * @returns The `where` clauses the integration lookups were performed with.
 */
const integrationLookups = (commandBus: any): any[] =>
	commandBus.execute.mock.calls
		.map(([command]: [any]) => command)
		.filter((command: any) => command instanceof IntegrationTenantGetCommand)
		.map((command: any) => command.input?.where);

/** The scope every credential resolution must be confined to. */
const CALLER_SCOPE = {
	id: INTEGRATION_ID,
	organizationId: ORGANIZATION_ID,
	tenant: { id: CURRENT_TENANT_ID }
};

describe('UpworkController — GHSA-3rqg-gpm9-gx84 credential exposure', () => {
	beforeEach(() => {
		upworkSdkCalls.length = 0;
	});

	describe('GET /config/:integrationId', () => {
		it('answers with the connected state only, never with credential material', async () => {
			const { controller } = buildController();

			const config: any = await controller.getConfig(INTEGRATION_ID, {
				filter: { organizationId: ORGANIZATION_ID, tenantId: CURRENT_TENANT_ID }
			});

			// Nothing in the payload may be, or contain, a stored credential.
			const payload = JSON.stringify(config);
			for (const secret of Object.values(SECRETS)) {
				expect(payload).not.toContain(secret);
			}

			// It still has to be useful: the UI needs to know the integration is usable.
			expect(config.integrationId).toBe(INTEGRATION_ID);
			expect(config.hasAccessToken).toBe(true);
			// The one credential-derived field left visible goes through the platform masker.
			expect(config.consumerKey).toBe('*'.repeat(SECRETS.consumerKey.length - 4) + 'CCCC');
			expect(config.accessToken).toBeUndefined();
			expect(config.consumerSecret).toBeUndefined();
			expect(config.accessSecret).toBeUndefined();
		});

		it('reports a half-authorized integration as unusable instead of leaking partial settings', async () => {
			const { controller } = buildController({
				settings: [{ settingsName: 'consumerKey', settingsValue: SECRETS.consumerKey }]
			});

			const config: any = await controller.getConfig(INTEGRATION_ID, {
				filter: { organizationId: ORGANIZATION_ID }
			});

			expect(config.hasAccessToken).toBe(false);
			expect(JSON.stringify(config)).not.toContain(SECRETS.consumerKey);
		});

		it('scopes the lookup to the request context tenant, not to a tenant named by the caller', async () => {
			const { controller, commandBus } = buildController();

			await controller.getConfig(INTEGRATION_ID, {
				// A caller trying to widen the lookup by naming somebody else's tenant.
				filter: { organizationId: ORGANIZATION_ID, tenantId: FOREIGN_TENANT_ID }
			});

			const lookups = integrationLookups(commandBus);
			expect(lookups).toHaveLength(1);
			expect(lookups[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
			expect(JSON.stringify(lookups[0])).not.toContain(FOREIGN_TENANT_ID);
		});

		it('refuses an integration that does not exist inside the caller scope', async () => {
			const { controller } = buildController({ integration: null });

			await expect(
				controller.getConfig(INTEGRATION_ID, { filter: { organizationId: ORGANIZATION_ID } })
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('refuses a request that names no organization rather than widening to the tenant', async () => {
			const { controller, commandBus } = buildController();

			await expect(controller.getConfig(INTEGRATION_ID, { filter: {} })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(integrationLookups(commandBus)).toHaveLength(0);
		});
	});

	describe('GET /freelancer-contracts', () => {
		it('resolves the Upwork credentials server-side from the integration id', async () => {
			const { controller, commandBus } = buildController();

			const contracts = await controller.getContracts({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID
			} as any);

			expect(contracts).toEqual([{ reference: 'contract-1' }]);
			// The credentials the SDK signs with were assembled on the server, from stored settings.
			expect(upworkSdkCalls).toEqual([
				{ type: 'construct', config: EXPECTED_API_CONFIG },
				{
					type: 'setAccessToken',
					accessToken: SECRETS.accessToken,
					accessSecret: SECRETS.accessTokenSecret
				}
			]);
			// And they were resolved through a lookup scoped to the caller's tenant and organization.
			expect(integrationLookups(commandBus)[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
		});

		it('ignores credentials supplied by the caller and uses the stored ones', async () => {
			const { controller } = buildController();

			await controller.getContracts({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				// A caller trying to drive the server's Upwork client with its own credentials.
				config: {
					accessToken: 'attacker-token',
					accessSecret: 'attacker-secret',
					consumerKey: 'attacker-key',
					consumerSecret: 'attacker-consumer-secret'
				}
			} as any);

			expect(JSON.stringify(upworkSdkCalls)).not.toContain('attacker');
			expect(upworkSdkCalls[0]).toEqual({ type: 'construct', config: EXPECTED_API_CONFIG });
		});

		it('refuses an integration outside the caller tenant and organization without calling Upwork', async () => {
			const { controller, commandBus } = buildController({ integration: null });

			await expect(
				controller.getContracts({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID } as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(upworkSdkCalls).toHaveLength(0);
			// The refusal came from a properly scoped lookup, not from an absent config.
			expect(integrationLookups(commandBus)[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
		});
	});

	describe('GET /work-diary', () => {
		it('resolves the Upwork credentials server-side and never accepts them from the caller', async () => {
			const { controller, commandBus } = buildController();

			const diary: any = await controller.getWorkDiary({
				integrationId: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				contractId: 'contract-1',
				forDate: new Date(2026, 0, 2)
			} as any);

			expect(diary).toEqual({ contractId: 'contract-1', date: '20260102' });
			expect(upworkSdkCalls).toEqual([
				{ type: 'construct', config: EXPECTED_API_CONFIG },
				{
					type: 'setAccessToken',
					accessToken: SECRETS.accessToken,
					accessSecret: SECRETS.accessTokenSecret
				}
			]);
			expect(integrationLookups(commandBus)[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
		});

		it('refuses an integration outside the caller scope without calling Upwork', async () => {
			const { controller } = buildController({ integration: null });

			await expect(
				controller.getWorkDiary({
					integrationId: INTEGRATION_ID,
					organizationId: ORGANIZATION_ID,
					contractId: 'contract-1',
					forDate: new Date(2026, 0, 2)
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(upworkSdkCalls).toHaveLength(0);
		});
	});

	describe('POST /sync-contracts-related-data', () => {
		it('refuses an integration outside the caller scope before any sync work happens', async () => {
			const { controller, service } = buildController({ integration: null });
			const syncContracts = jest.spyOn(service, 'syncContracts').mockResolvedValue([]);

			await expect(
				controller.syncContractsRelatedData({
					integrationId: INTEGRATION_ID,
					organizationId: ORGANIZATION_ID,
					contracts: [],
					entitiesToSync: []
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(syncContracts).not.toHaveBeenCalled();
			expect(upworkSdkCalls).toHaveLength(0);
		});
	});
});
