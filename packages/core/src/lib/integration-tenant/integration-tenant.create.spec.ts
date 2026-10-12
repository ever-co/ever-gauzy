import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenantController } from './integration-tenant.controller';

/**
 * GHSA-4rwq-65wh-45h4 — the SECOND generic write path onto `integration_setting`.
 *
 * `IntegrationTenantController` extends `CrudController`, and Nest registers a base class's routes
 * on the subclass, so `POST /integration-tenant` existed with the base `@Body() entity` — no DTO,
 * no whitelist. `IntegrationTenantService.create()` maps `input.settings` onto the caller's tenant
 * and the `settings` relation cascades, so the body could insert any setting row at all: an
 * attacker could create their own GitHub integration carrying a VICTIM's `installation_id`,
 * skipping the install flow's state nonce, its first-claimant uniqueness check and the
 * `PUT /integration-setting/:id` allowlist in one request.
 *
 * The route now refuses any setting that is not on the user-editable allowlist. Each fix case is
 * paired with a CONTROL that runs the pre-fix (inherited) route body against the same payload.
 */
describe('POST /integration-tenant (GHSA-4rwq-65wh-45h4)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
	const GITHUB_INTEGRATION_ID = 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0';
	const VICTIM_INSTALLATION_ID = '98765432';

	let service: IntegrationTenantService;
	let controller: IntegrationTenantController;
	/**
	 * The persistence boundary: `TenantAwareCrudService.create()` is what `IntegrationTenantService`
	 * hands the mapped entity to, and the `settings` relation cascades from there. Whatever reaches
	 * this spy would have been written.
	 */
	let persist: jest.SpyInstance;

	/** The pre-fix route body, verbatim: `CrudController.create()`. */
	const preFixCreate = async (entity: any) => await service.create(entity);

	const body = (name: IntegrationEnum, settings: any) => ({
		name,
		integrationId: GITHUB_INTEGRATION_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		settings
	});

	beforeEach(() => {
		service = new IntegrationTenantService({} as any, {} as any);
		controller = new IntegrationTenantController({} as any, service);
		persist = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input: any) => input);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each([
		[IntegrationEnum.GITHUB, 'installation_id', VICTIM_INSTALLATION_ID],
		[IntegrationEnum.GITHUB, 'setup_action', 'install'],
		[IntegrationEnum.GITHUB, 'sync_tag', 'gauzy'],
		[IntegrationEnum.GITHUB, 'access_token', 'ghs_victim'],
		[IntegrationEnum.HUBSTAFF, 'access_token', 'victim-token'],
		[IntegrationEnum.UPWORK, 'accessToken', 'victim-token'],
		[IntegrationEnum.ZAPIER, 'zapier_access_token', 'victim-token'],
		[IntegrationEnum.MakeCom, 'make_organization_id', '42'],
		[IntegrationEnum.ACTIVE_PIECES, 'project_id', 'victim-project'],
		[IntegrationEnum.PLANE, 'plane_mode', 'cloud'],
		// A Gauzy AI key name on another provider's integration is not client-writable either.
		[IntegrationEnum.GITHUB, 'apiKey', 'planted']
	])('%s / %s (server-managed)', (provider, settingsName, settingsValue) => {
		it('is refused, and nothing is written', async () => {
			await expect(
				controller.create(body(provider, [{ settingsName, settingsValue }]) as any)
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(persist).not.toHaveBeenCalled();
		});

		it('CONTROL: the pre-fix route planted it', async () => {
			await preFixCreate(body(provider, [{ settingsName, settingsValue }]));

			expect(persist).toHaveBeenCalledWith(
				expect.objectContaining({
					settings: expect.arrayContaining([expect.objectContaining({ settingsName, settingsValue })])
				})
			);
		});
	});

	it('refuses a server-managed setting even when it rides along with an allowlisted one', async () => {
		await expect(
			controller.create(
				body(IntegrationEnum.GAUZY_AI, [
					{ settingsName: 'apiKey', settingsValue: 'mine' },
					{ settingsName: 'installation_id', settingsValue: VICTIM_INSTALLATION_ID }
				]) as any
			)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(persist).not.toHaveBeenCalled();
	});

	it('refuses a cascade update that targets an existing row by id (no settingsName)', async () => {
		await expect(
			controller.create(
				body(IntegrationEnum.GAUZY_AI, [
					{ id: 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', settingsValue: VICTIM_INSTALLATION_ID }
				]) as any
			)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(persist).not.toHaveBeenCalled();
	});

	it.each([['a string' as any], [{ settingsName: 'apiKey' } as any], [1 as any]])(
		'fails closed when `settings` is not an array (%p)',
		async (settings) => {
			await expect(controller.create(body(IntegrationEnum.GAUZY_AI, settings) as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect(persist).not.toHaveBeenCalled();
		}
	);

	describe.each(['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId'])(
		'Gauzy AI / %s (user-editable)',
		(settingsName) => {
			it('is created and reaches the service unchanged', async () => {
				const input = body(IntegrationEnum.GAUZY_AI, [{ settingsName, settingsValue: 'my-key' }]);

				await controller.create(input as any);

				expect(persist).toHaveBeenCalledTimes(1);
				expect(persist).toHaveBeenCalledWith(
					expect.objectContaining({
						name: IntegrationEnum.GAUZY_AI,
						settings: [expect.objectContaining({ settingsName, settingsValue: 'my-key' })]
					})
				);
			});
		}
	);

	it.each([[undefined], [null], [[]]])('creates an integration with no settings (%p)', async (settings) => {
		const input = { ...body(IntegrationEnum.GITHUB, settings) };

		await controller.create(input as any);

		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith(expect.objectContaining({ name: IntegrationEnum.GITHUB, settings: [] }));
	});
});
