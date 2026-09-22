import { BadRequestException, HttpException, ValidationPipe } from '@nestjs/common';

// Keep the whole @gauzy/core entity graph (and its database config) out of this suite: the DTO only
// extends TenantOrganizationBaseDTO, and the service only needs a request context and a command bus.
jest.mock('@gauzy/core', () => ({
	TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
	RequestContext: { currentTenantId: jest.fn() },
	IntegrationService: class IntegrationService {},
	IntegrationTenantUpdateOrCreateCommand: class IntegrationTenantUpdateOrCreateCommand {
		constructor(
			public readonly options: unknown,
			public readonly input: any
		) {}
	}
}));
jest.mock('@gauzy/config', () => ({ environment: { github: {} } }));
// @nestjs/axios ships a raw `index.ts` this project's jest config does not transform.
jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));

import { RequestContext } from '@gauzy/core';
import { GITHUB_INSTALLATION_ID_PATTERN, GithubAppInstallDTO, GithubSetupActionEnum } from './dto/github-app-install.dto';
import { GithubService } from './github.service';

/**
 * GHSA-4rwq-65wh-45h4 — installation ids must have ONE spelling.
 *
 * The first-claimant-wins check that stops a second tenant binding the same GitHub App installation
 * compares the stored `settingsValue` as an exact string. `installation_id` was only `@IsString()`,
 * so '0123', '123 ' or '+123' bound installation 123 to a second tenant under a different spelling.
 */
describe('GitHub App installation_id canonical form (GHSA-4rwq-65wh-45h4)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
	const STATE = 'a'.repeat(64);

	const NON_CANONICAL = ['0123', '123 ', ' 123', '+123', '-1', '0', '1e3', '12.0', '0x7b', 'abc', '١٢٣', '123456789012345678901'];
	const CANONICAL = ['1', '123', '42000001', '12345678901234567890'];

	describe('GithubAppInstallDTO', () => {
		const pipe = new ValidationPipe();
		const validate = (installation_id: unknown) =>
			pipe.transform(
				{ installation_id, setup_action: GithubSetupActionEnum.INSTALL, state: STATE },
				{ type: 'body', metatype: GithubAppInstallDTO }
			);

		it.each(CANONICAL)('accepts %p', async (id) => {
			await expect(validate(id)).resolves.toEqual(expect.objectContaining({ installation_id: id }));
		});

		it.each(NON_CANONICAL)('rejects %p', async (id) => {
			await expect(validate(id)).rejects.toBeInstanceOf(BadRequestException);
		});

		it('CONTROL: the pre-fix rule (IsString + IsNotEmpty) accepted every non-canonical spelling', () => {
			const preFix = (value: unknown) => typeof value === 'string' && value !== '';
			for (const id of NON_CANONICAL) {
				expect(preFix(id)).toBe(true);
				expect(GITHUB_INSTALLATION_ID_PATTERN.test(id)).toBe(false);
			}
		});
	});

	describe('GithubService.addGithubAppInstallation', () => {
		let service: GithubService;
		let execute: jest.Mock;
		let find: jest.Mock;

		beforeEach(() => {
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(TENANT_ID);
			execute = jest.fn(async (command: any) => command.input);
			find = jest.fn(async () => []);
			service = new GithubService(
				{} as any,
				{ execute } as any,
				{ findOneByOptions: jest.fn(async () => ({ id: 'integration' })) } as any,
				{ getRepository: () => ({ find }) } as any
			);
		});

		const install = (installation_id: string) =>
			service.addGithubAppInstallation({
				installation_id,
				setup_action: GithubSetupActionEnum.INSTALL,
				organizationId: ORGANIZATION_ID
			} as any);

		it.each(NON_CANONICAL)('refuses %p before the uniqueness lookup or any write', async (id) => {
			await expect(install(id)).rejects.toBeInstanceOf(HttpException);
			expect(find).not.toHaveBeenCalled();
			expect(execute).not.toHaveBeenCalled();
		});

		it('stores a canonical id verbatim and checks uniqueness against that same string', async () => {
			const result: any = await install('123');

			expect(find).toHaveBeenCalledWith({
				where: { settingsName: 'installation_id', settingsValue: '123' }
			});
			expect(result.settings).toEqual(
				expect.arrayContaining([expect.objectContaining({ settingsName: 'installation_id', settingsValue: '123' })])
			);
		});

		it('CONTROL: an exact-string uniqueness check cannot see installation 123 behind the spelling "0123"', async () => {
			// Tenant B already holds installation 123.
			const bindings = [{ settingsName: 'installation_id', settingsValue: '123', tenantId: 'b' }];
			const exactMatch = (value: string) => bindings.filter((row) => row.settingsValue === value);

			expect(exactMatch('123')).toHaveLength(1);
			expect(exactMatch('0123')).toHaveLength(0); // the pre-fix hole: no conflict found
			await expect(install('0123')).rejects.toBeInstanceOf(HttpException); // now refused outright
		});
	});
});
