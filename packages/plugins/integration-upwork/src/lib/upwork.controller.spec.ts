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
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** The tenant the authenticated caller belongs to, as the request context reports it. */
const CURRENT_TENANT_ID = 'tenant-aaaa';
/** A tenant the caller does NOT belong to, used to try to widen the lookup from the request body. */
const FOREIGN_TENANT_ID = 'tenant-bbbb';
const ORGANIZATION_ID = 'org-1111';
const INTEGRATION_ID = 'integration-1111';
/** The authenticated caller, as the request context reports it. */
const CURRENT_USER_ID = 'user-1111';

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
		/** What the next OAuth call answers with; a spec overrides it to model an Upwork failure. */
		static oauthError: any = null;
		constructor(public readonly config: any) {
			calls.push({ type: 'construct', config });
		}
		setAccessToken(accessToken: string, accessSecret: string, callback: () => void) {
			calls.push({ type: 'setAccessToken', accessToken, accessSecret });
			callback();
		}
		getAuthorizationUrl(callbackUrl: string, callback: (...args: any[]) => void) {
			calls.push({ type: 'getAuthorizationUrl', callbackUrl, consumerKey: this.config.consumerKey });
			callback(
				MockUpworkApi.oauthError,
				'https://upwork.test/authorize',
				'request-token-1',
				'request-token-secret-1'
			);
		}
		getAccessToken(
			requestToken: string,
			requestTokenSecret: string,
			verifier: string,
			callback: (...args: any[]) => void
		) {
			calls.push({
				type: 'getAccessToken',
				requestToken,
				requestTokenSecret,
				verifier,
				consumerKey: this.config.consumerKey
			});
			callback(MockUpworkApi.oauthError, 'minted-access-token-EEEE', 'minted-access-token-secret-FFFF');
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
	/** Minimal stand-in for a CQRS command that carries its input for assertions. */
	class Command {
		/** Every constructor argument, for commands that take more than one. */
		public readonly args: any[];
		constructor(
			public readonly input: any,
			...rest: any[]
		) {
			this.args = [input, ...rest];
		}
	}

	return {
		// Literals rather than the shared constants: a `jest.mock` factory runs before this module's
		// own `const` bindings are initialized.
		RequestContext: {
			currentTenantId: jest.fn(() => 'tenant-aaaa'),
			currentUserId: jest.fn(() => 'user-1111'),
			// No tenant-wide organization permission unless a spec grants it.
			hasPermission: jest.fn(() => false)
		},
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
import { PermissionsEnum } from '@gauzy/contracts';
import {
	IntegrationSettingCreateCommand,
	IntegrationSettingGetCommand,
	IntegrationSettingGetManyCommand,
	IntegrationTenantGetCommand,
	IntegrationTenantUpdateOrCreateCommand,
	RequestContext
} from '@gauzy/core';
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
 * @param options.setting - What a single `IntegrationSettingGetCommand` lookup resolves to.
 * @param options.memberships - What the caller's organization-membership count resolves to, or a
 *                              function to model a failing lookup.
 * @returns The controller, the service and the spies for assertions on the lookups made.
 */
const buildController = (
	options: { integration?: any; settings?: any[]; setting?: any; memberships?: number | (() => never) } = {}
) => {
	const integration = 'integration' in options ? options.integration : INTEGRATION;
	const settings = options.settings ?? INTEGRATION_SETTINGS;

	const commandBus: any = {
		execute: jest.fn(async (command: any) => {
			if (command instanceof IntegrationTenantGetCommand) {
				return integration;
			}
			if (command instanceof IntegrationSettingGetCommand) {
				return options.setting;
			}
			if (command instanceof IntegrationSettingGetManyCommand) {
				// A tenant-scoped settings read can only return rows when an integration resolved.
				return integration ? settings : [];
			}
			return undefined;
		})
	};

	const memberships = options.memberships ?? 1;
	const userService: any = {
		countBy: jest.fn(async () => (typeof memberships === 'function' ? memberships() : memberships))
	};
	const transactionService: any = { handleTransactions: jest.fn(async () => 'handled') };

	const noop: any = {};
	const service = new UpworkService(noop, noop, noop, userService, noop, noop, noop, noop, noop, noop, commandBus);
	const controller = new UpworkController(transactionService, service);

	return { controller, service, commandBus, userService, transactionService };
};

/**
 * Collects every command of one type the service dispatched.
 *
 * @param commandBus - The stubbed command bus.
 * @param type - The command class to keep.
 * @returns The inputs those commands were dispatched with.
 */
const dispatched = (commandBus: any, type: any): any[] =>
	commandBus.execute.mock.calls
		.map(([command]: [any]) => command)
		.filter((command: any) => command instanceof type)
		.map((command: any) => command.input);

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
		(UpworkApi as any).oauthError = null;
		(RequestContext.hasPermission as jest.Mock).mockReturnValue(false);
		(RequestContext.currentUserId as jest.Mock).mockReturnValue(CURRENT_USER_ID);
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
			expect(config).toEqual({ integrationId: INTEGRATION_ID, hasAccessToken: true, hasConsumerKey: true });
			// Not even a masked fragment of a credential is left.
			expect(config.consumerKey).toBeUndefined();
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

	describe('organization access', () => {
		/** Every route that takes an organization from the request, driven for one organization. */
		const routes: Array<[string, (controller: UpworkController) => Promise<any>]> = [
			[
				'GET /config/:integrationId',
				(controller) => controller.getConfig(INTEGRATION_ID, { filter: { organizationId: ORGANIZATION_ID } })
			],
			[
				'GET /freelancer-contracts',
				(controller) =>
					controller.getContracts({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID } as any)
			],
			[
				'GET /work-diary',
				(controller) =>
					controller.getWorkDiary({
						integrationId: INTEGRATION_ID,
						organizationId: ORGANIZATION_ID,
						contractId: 'contract-1',
						forDate: new Date(2026, 0, 2)
					} as any)
			],
			[
				'POST /sync-contracts',
				(controller) =>
					controller.syncContracts({
						integrationId: INTEGRATION_ID,
						organizationId: ORGANIZATION_ID,
						contracts: []
					} as any)
			],
			[
				'POST /sync-contracts-related-data',
				(controller) =>
					controller.syncContractsRelatedData({
						integrationId: INTEGRATION_ID,
						organizationId: ORGANIZATION_ID,
						contracts: [],
						entitiesToSync: [],
						employeeId: 'employee-1'
					} as any)
			],
			[
				'POST /token-secret-pair/:organizationId',
				(controller) =>
					controller.getAccessTokenSecretPair(
						{ consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret },
						ORGANIZATION_ID
					)
			],
			[
				'POST /access-token/:organizationId',
				(controller) =>
					controller.getAccessToken(
						{ requestToken: 'request-token-1', verifier: 'verifier-1' },
						ORGANIZATION_ID
					)
			],
			[
				'GET /report/:integrationId',
				(controller) =>
					controller.getReports(INTEGRATION_ID, {
						relations: {},
						filter: { organizationId: ORGANIZATION_ID, dateRange: {} }
					})
			],
			['POST /transactions', (controller) => controller.create({} as any, { organizationId: ORGANIZATION_ID })]
		];

		it.each(routes)('%s refuses a caller who is not a member of the organization', async (_route, call) => {
			const { controller, commandBus, userService, transactionService } = buildController({ memberships: 0 });

			await expect(call(controller)).rejects.toBeInstanceOf(ForbiddenException);

			// Refused before anything organization-scoped was read, written or sent to Upwork.
			expect(commandBus.execute).not.toHaveBeenCalled();
			expect(transactionService.handleTransactions).not.toHaveBeenCalled();
			expect(upworkSdkCalls).toHaveLength(0);
			// The verdict came from a membership lookup for this user, organization and tenant.
			expect(userService.countBy).toHaveBeenCalledWith({
				id: CURRENT_USER_ID,
				organizations: {
					organizationId: ORGANIZATION_ID,
					tenantId: CURRENT_TENANT_ID,
					isActive: true,
					isArchived: false
				}
			});
		});

		it.each(routes)('%s refuses when the membership lookup fails', async (_route, call) => {
			const { controller, commandBus } = buildController({
				memberships: () => {
					throw new Error('database unavailable');
				}
			});

			await expect(call(controller)).rejects.toBeInstanceOf(ForbiddenException);
			expect(commandBus.execute).not.toHaveBeenCalled();
		});

		it('refuses a request without an authenticated user rather than skipping the check', async () => {
			(RequestContext.currentUserId as jest.Mock).mockReturnValue(null);
			const { controller, userService } = buildController();

			await expect(
				controller.getConfig(INTEGRATION_ID, { filter: { organizationId: ORGANIZATION_ID } })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(userService.countBy).not.toHaveBeenCalled();
		});

		it('lets a member of the organization through', async () => {
			const { controller, transactionService } = buildController({ memberships: 1 });

			await expect(controller.create({} as any, { organizationId: ORGANIZATION_ID })).resolves.toBe('handled');
			expect(transactionService.handleTransactions).toHaveBeenCalledTimes(1);
		});

		it('lets a holder of ALL_ORG_EDIT through without a membership', async () => {
			(RequestContext.hasPermission as jest.Mock).mockImplementation(
				(permission: PermissionsEnum) => permission === PermissionsEnum.ALL_ORG_EDIT
			);
			const { controller, userService } = buildController({ memberships: 0 });

			const config = await controller.getConfig(INTEGRATION_ID, { filter: { organizationId: ORGANIZATION_ID } });

			expect(config.integrationId).toBe(INTEGRATION_ID);
			expect(userService.countBy).not.toHaveBeenCalled();
		});
	});

	describe('POST /sync-contracts', () => {
		it('refuses an integration outside the caller scope before any project is written', async () => {
			const { controller, commandBus } = buildController({ integration: null });

			await expect(
				controller.syncContracts({
					integrationId: INTEGRATION_ID,
					organizationId: ORGANIZATION_ID,
					contracts: [{ reference: 'contract-1', job__title: 'Job' }]
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			// Only the scoped integration lookup ran: no project or integration map command.
			expect(commandBus.execute).toHaveBeenCalledTimes(1);
			expect(integrationLookups(commandBus)[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
		});

		it('takes the tenant from the request context, not from the body', async () => {
			const { controller, commandBus } = buildController();

			await expect(
				controller.syncContracts({
					integrationId: INTEGRATION_ID,
					organizationId: ORGANIZATION_ID,
					tenantId: FOREIGN_TENANT_ID,
					contracts: []
				} as any)
			).resolves.toEqual([]);

			expect(integrationLookups(commandBus)[0]).toEqual(expect.objectContaining(CALLER_SCOPE));
			expect(JSON.stringify(commandBus.execute.mock.calls)).not.toContain(FOREIGN_TENANT_ID);
		});

		it('refuses a body whose contracts are not an array', async () => {
			const { controller } = buildController();

			await expect(
				controller.syncContracts({
					integrationId: INTEGRATION_ID,
					organizationId: ORGANIZATION_ID,
					contracts: { length: 1 }
				} as any)
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('POST /token-secret-pair/:organizationId', () => {
		it('starts a handshake without returning the request-token secret', async () => {
			const { controller, commandBus } = buildController({ setting: undefined });

			const result = await controller.getAccessTokenSecretPair(
				{ consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret },
				ORGANIZATION_ID
			);

			expect(result).toEqual({
				url: 'https://upwork.test/authorize',
				requestToken: 'request-token-1',
				organizationId: ORGANIZATION_ID
			});
			expect(JSON.stringify(result)).not.toContain('request-token-secret-1');
			expect(JSON.stringify(result)).not.toContain(SECRETS.consumerSecret);

			// The secret is kept server-side, in the caller's tenant and organization.
			const [upsert] = commandBus.execute.mock.calls
				.map(([command]: [any]) => command)
				.filter((command: any) => command instanceof IntegrationTenantUpdateOrCreateCommand);
			const [, entity] = upsert.args;
			expect(entity).toEqual(
				expect.objectContaining({ tenantId: CURRENT_TENANT_ID, organizationId: ORGANIZATION_ID })
			);
			expect(entity.settings).toContainEqual({
				settingsName: 'requestTokenSecret',
				settingsValue: 'request-token-secret-1',
				tenantId: CURRENT_TENANT_ID,
				organizationId: ORGANIZATION_ID
			});
		});

		it('builds the Upwork client from the consumer pair only, ignoring any other body field', async () => {
			const { controller } = buildController({ setting: undefined });

			await controller.getAccessTokenSecretPair(
				{
					consumerKey: SECRETS.consumerKey,
					consumerSecret: SECRETS.consumerSecret,
					accessToken: 'attacker-token',
					accessSecret: 'attacker-secret'
				} as any,
				ORGANIZATION_ID
			);

			expect(upworkSdkCalls[0]).toEqual({
				type: 'construct',
				config: { consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret }
			});
		});

		it('names the existing integration, and nothing else, when the app is already authorized', async () => {
			const { controller } = buildController({
				setting: { integration: { id: INTEGRATION_ID }, settingsName: 'consumerKey' }
			});

			const result = await controller.getAccessTokenSecretPair(
				{ consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret },
				ORGANIZATION_ID
			);

			// It used to answer with nothing at all, which the authorize page then dereferenced.
			expect(result).toEqual({ integrationId: INTEGRATION_ID, organizationId: ORGANIZATION_ID });
			for (const secret of [SECRETS.accessToken, SECRETS.accessTokenSecret, SECRETS.consumerSecret]) {
				expect(JSON.stringify(result)).not.toContain(secret);
			}
			expect(upworkSdkCalls).toHaveLength(0);
		});

		it('looks the app up by its consumer key setting, not by any setting with that value', async () => {
			const { controller, commandBus } = buildController({ setting: undefined });

			await controller.getAccessTokenSecretPair(
				{ consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret },
				ORGANIZATION_ID
			);

			expect(dispatched(commandBus, IntegrationSettingGetCommand)[0].where).toEqual({
				settingsName: 'consumerKey',
				settingsValue: SECRETS.consumerKey,
				organizationId: ORGANIZATION_ID
			});
		});

		it('refuses a request without a consumer key rather than matching any setting of the organization', async () => {
			const { controller, commandBus } = buildController({
				setting: { integration: { id: INTEGRATION_ID } }
			});

			await expect(
				controller.getAccessTokenSecretPair({ consumerSecret: SECRETS.consumerSecret } as any, ORGANIZATION_ID)
			).rejects.toBeInstanceOf(BadRequestException);
			expect(commandBus.execute).not.toHaveBeenCalled();
		});
	});

	describe('POST /access-token/:organizationId', () => {
		const PENDING_SETTINGS = [
			{ settingsName: 'consumerKey', settingsValue: SECRETS.consumerKey },
			{ settingsName: 'consumerSecret', settingsValue: SECRETS.consumerSecret },
			{ settingsName: 'requestToken', settingsValue: 'request-token-1' },
			{ settingsName: 'requestTokenSecret', settingsValue: 'request-token-secret-1' }
		];

		it('stores the minted token pair and answers with the integration id only', async () => {
			const { controller, commandBus } = buildController({
				setting: { integration: { id: INTEGRATION_ID } },
				settings: PENDING_SETTINGS
			});

			const result = await controller.getAccessToken(
				{ requestToken: 'request-token-1', verifier: 'verifier-1' },
				ORGANIZATION_ID
			);

			expect(result).toEqual({ integrationId: INTEGRATION_ID });
			expect(
				dispatched(commandBus, IntegrationSettingCreateCommand).map(({ settingsName, settingsValue }) => ({
					settingsName,
					settingsValue
				}))
			).toEqual([
				{ settingsName: 'accessToken', settingsValue: 'minted-access-token-EEEE' },
				{ settingsName: 'accessTokenSecret', settingsValue: 'minted-access-token-secret-FFFF' }
			]);
		});

		it('signs the exchange with the consumer pair stored for this handshake', async () => {
			const { controller, commandBus } = buildController({
				setting: { integration: { id: INTEGRATION_ID } },
				settings: PENDING_SETTINGS
			});

			// Another handshake started on the same singleton service in between, with another app.
			await buildController({ setting: undefined }).controller.getAccessTokenSecretPair(
				{ consumerKey: 'other-tenant-consumer-key', consumerSecret: 'other-tenant-consumer-secret' },
				ORGANIZATION_ID
			);
			upworkSdkCalls.length = 0;

			await controller.getAccessToken(
				{ requestToken: 'request-token-1', verifier: 'verifier-1' },
				ORGANIZATION_ID
			);

			expect(upworkSdkCalls).toEqual([
				{
					type: 'construct',
					config: { consumerKey: SECRETS.consumerKey, consumerSecret: SECRETS.consumerSecret }
				},
				{
					type: 'getAccessToken',
					requestToken: 'request-token-1',
					requestTokenSecret: 'request-token-secret-1',
					verifier: 'verifier-1',
					consumerKey: SECRETS.consumerKey
				}
			]);
			expect(dispatched(commandBus, IntegrationSettingGetCommand)[0].where).toEqual({
				settingsName: 'requestToken',
				settingsValue: 'request-token-1',
				organizationId: ORGANIZATION_ID
			});
		});

		it('rejects an unknown request token instead of leaving the request pending', async () => {
			const { controller } = buildController({ setting: undefined });

			await expect(
				controller.getAccessToken({ requestToken: 'unknown', verifier: 'verifier-1' }, ORGANIZATION_ID)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(upworkSdkCalls).toHaveLength(0);
		});

		it('rejects a handshake whose stored settings are incomplete', async () => {
			const { controller } = buildController({
				setting: { integration: { id: INTEGRATION_ID } },
				settings: PENDING_SETTINGS.filter(({ settingsName }) => settingsName !== 'requestTokenSecret')
			});

			await expect(
				controller.getAccessToken({ requestToken: 'request-token-1', verifier: 'verifier-1' }, ORGANIZATION_ID)
			).rejects.toBeInstanceOf(BadRequestException);
			expect(upworkSdkCalls).toHaveLength(0);
		});

		it('rejects when Upwork refuses the exchange, and stores nothing', async () => {
			(UpworkApi as any).oauthError = 'invalid verifier';
			const { controller, commandBus } = buildController({
				setting: { integration: { id: INTEGRATION_ID } },
				settings: PENDING_SETTINGS
			});

			await expect(
				controller.getAccessToken({ requestToken: 'request-token-1', verifier: 'bad' }, ORGANIZATION_ID)
			).rejects.toThrow('invalid verifier');
			expect(dispatched(commandBus, IntegrationSettingCreateCommand)).toHaveLength(0);
		});
	});
});
