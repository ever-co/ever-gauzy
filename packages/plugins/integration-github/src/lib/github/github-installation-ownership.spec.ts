import { HttpException } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';

// Keep the @gauzy/core entity graph out of this suite (same approach as github-installation-id.spec.ts).
jest.mock('@gauzy/core', () => ({
	TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
	RequestContext: { currentTenantId: jest.fn() },
	IntegrationService: class IntegrationService {},
	IntegrationTenantUpdateOrCreateCommand: class IntegrationTenantUpdateOrCreateCommand {},
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	Permissions: () => () => undefined,
	UseValidationPipe: () => () => undefined,
	EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT'
}));
jest.mock('@gauzy/config', () => ({
	environment: {
		baseUrl: 'https://api.example.test',
		JWT_SECRET: 'test-signing-secret',
		github: { clientId: 'Iv1.app-client', clientSecret: 'app-secret' }
	},
	ConfigService: class ConfigService {}
}));
// @nestjs/axios ships a raw `index.ts` this project's jest config does not transform.
jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
// The real OctokitService pulls in probot; only its repository listing is used here.
jest.mock('../probot/octokit.service', () => ({ OctokitService: class OctokitService {} }));

import { environment } from '@gauzy/config';
import { RequestContext } from '@gauzy/core';
import { GithubInstallationOwnershipService } from './github-installation-ownership.service';
import { GitHubController } from './github.controller';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { isGithubInstallProofValid, signGithubInstallProof } from './github-install-proof';

/**
 * GHSA-4rwq-65wh-45h4 — a tenant may bind only an installation its GitHub user is entitled to in full.
 *
 * `POST /install` used to bind whatever `installation_id` the body carried, as long as the state nonce
 * belonged to the caller's tenant. The nonce says which TENANT started the flow, not which
 * installation that tenant may bind; binding hands the tenant the App's token for every repository in
 * the installation, so a tenant could read another organization's private repositories.
 */
describe('GitHub App installation ownership (GHSA-4rwq-65wh-45h4)', () => {
	const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
	const STATE = 'b'.repeat(64);
	const OTHER_STATE = 'c'.repeat(64);
	const ME = 501;
	const PERSONAL = '1000001';
	const ORG = '3000003';

	const repos = (...ids: number[]) => ids.map((id) => ({ id }));

	interface IScenario {
		token?: string | null;
		exchangeError?: boolean;
		/** Pages of installations visible to the user. */
		pages?: Array<Array<{ id: number; account: { id: number; type: 'User' | 'Organization' } }>>;
		/** Repository ids of ORG the user can read, and the App's own view. */
		userRepos?: number[];
		appRepos?: number[] | 'fails';
		/** Simulates GitHub omitting the count on the user's repository listing. */
		userCountMissing?: boolean;
	}

	const defaultPages = (): IScenario['pages'] => [
		[
			{ id: Number(PERSONAL), account: { id: ME, type: 'User' } },
			{ id: Number(ORG), account: { id: 9000, type: 'Organization' } }
		]
	];

	const build = (scenario: IScenario = {}) => {
		const pages = scenario.pages ?? defaultPages();
		const total = pages.reduce((sum, page) => sum + page.length, 0);
		const userRepos = scenario.userRepos ?? [1, 2, 3];
		const http = {
			post: jest.fn(() =>
				scenario.exchangeError
					? throwError(() => new Error('network down'))
					: of({
							data:
								scenario.token === null
									? { error: 'bad_verification_code' }
									: { access_token: scenario.token ?? 'ghu_user' }
					  })
			),
			get: jest.fn((url: string, config: any) => {
				if (url.endsWith('/user')) {
					return of({ data: { id: ME, login: 'me' } });
				}
				if (url.endsWith('/user/installations')) {
					const page = pages[(config?.params?.page ?? 1) - 1] ?? [];
					return of({ data: { total_count: total, installations: page } });
				}
				if (url.includes('/user/installations/') && url.endsWith('/repositories')) {
					const page = config?.params?.page ?? 1;
					const slice = userRepos.slice((page - 1) * 100, page * 100);
					return of({
						data: {
							...(scenario.userCountMissing ? {} : { total_count: userRepos.length }),
							repositories: repos(...slice)
						}
					});
				}
				return throwError(() => new Error(`unexpected GET ${url}`));
			}),
			delete: jest.fn(() => of({ data: {} }))
		};
		const octokit = {
			getInstallationRepositoryIds: jest.fn(async () => {
				if (scenario.appRepos === 'fails') throw new Error('App not configured');
				return new Set((scenario.appRepos ?? [1, 2, 3]).map(String));
			})
		};
		return { service: new GithubInstallationOwnershipService(http as any, octokit as any), http, octokit };
	};

	describe('GithubInstallationOwnershipService.isEntitledToInstallation', () => {
		it('accepts a personal installation of the authorizing user, and revokes the token afterwards', async () => {
			const { service, http } = build();

			await expect(service.isEntitledToInstallation('oauth-code', PERSONAL)).resolves.toBe(true);
			expect(http.delete).toHaveBeenCalledTimes(1);
		});

		it('refuses a personal installation of SOMEONE ELSE that the user can see (e.g. as a collaborator)', async () => {
			const { service } = build({ pages: [[{ id: Number(PERSONAL), account: { id: 777, type: 'User' } }]] });

			await expect(service.isEntitledToInstallation('oauth-code', PERSONAL)).resolves.toBe(false);
		});

		it('accepts an organization installation when the user can read every repository in it', async () => {
			const { service } = build({ userRepos: [1, 2, 3, 4], appRepos: [1, 2, 3] });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(true);
		});

		it('CONTROL: GitHub lists an organization installation to a user who can read only ONE of its repositories', async () => {
			// `/user/installations` alone is what a naive check would trust.
			const { http } = build({ userRepos: [1], appRepos: [1, 2, 3] });
			const { data } = (await firstValueFrom(
				(http.get as any)('https://api.github.com/user/installations', { params: { page: 1 } })
			)) as any;

			expect(data.installations.map((installation: any) => String(installation.id))).toContain(ORG);
		});

		it('refuses that partial-access user: binding would expose repositories they cannot read', async () => {
			const { service } = build({ userRepos: [1], appRepos: [1, 2, 3] });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('CONTROL: throwaway repositories can make the COUNTS match while hidden repositories remain', () => {
			// 3 repositories, the member reads 1; they create 2 throwaway repositories (visible to them) and
			// delete them before the App looks. A count comparison sees 3 >= 3.
			const userSees = [1, 101, 102];
			const appSees = [1, 2, 3];
			expect(userSees.length >= appSees.length).toBe(true);
		});

		it('refuses that member anyway: the hidden repository ids are not among the ones they can read', async () => {
			const { service } = build({ userRepos: [1, 101, 102], appRepos: [1, 2, 3] });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('pages through every repository the user can read', async () => {
			const many = Array.from({ length: 150 }, (_, i) => i + 1);
			const { service, http } = build({ userRepos: many, appRepos: many });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(true);
			const repoCalls = (http.get.mock.calls as any[]).filter((call) => String(call[0]).endsWith('/repositories'));
			expect(repoCalls).toHaveLength(2);
		});

		it('never lets hidden repositories through when GitHub omits the count', async () => {
			const { service } = build({ userRepos: [1], appRepos: [1, 2], userCountMissing: true });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('refuses an installation the user cannot see at all, comparing whole ids', async () => {
			const { service } = build({ pages: [[{ id: 30000031, account: { id: 9000, type: 'Organization' } }]] });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('walks every page of installations', async () => {
			const filler = Array.from({ length: 100 }, (_, i) => ({ id: 7000000 + i, account: { id: 1, type: 'Organization' as const } }));
			const { service, http } = build({ pages: [filler, [{ id: Number(PERSONAL), account: { id: ME, type: 'User' } }]] });

			await expect(service.isEntitledToInstallation('oauth-code', PERSONAL)).resolves.toBe(true);
			const listCalls = (http.get.mock.calls as any[]).filter((call) => String(call[0]).endsWith('/user/installations'));
			expect(listCalls).toHaveLength(2);
		});

		it('refuses installation ids JavaScript cannot represent exactly (Octokit takes a number)', async () => {
			const { service, http } = build();

			await expect(service.isEntitledToInstallation('oauth-code', '12345678901234567890')).resolves.toBe(false);
			expect(http.post).not.toHaveBeenCalled();
		});

		it('fails closed when the App cannot list the installation repositories', async () => {
			const { service } = build({ appRepos: 'fails' });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('says no, without any lookup, when the code does not exchange', async () => {
			for (const scenario of [{ token: null }, { exchangeError: true }] as IScenario[]) {
				const { service, http } = build(scenario);

				await expect(service.isEntitledToInstallation('bad', PERSONAL)).resolves.toBe(false);
				expect(http.get).not.toHaveBeenCalled();
			}
		});

		it('refuses to vouch for anything when the App client credentials are missing', async () => {
			const github = (environment as any).github;
			const saved = { ...github };
			github.clientSecret = '';
			try {
				await expect(build().service.isEntitledToInstallation('oauth-code', PERSONAL)).rejects.toMatchObject({ status: 503 });
			} finally {
				Object.assign(github, saved);
			}
		});
	});

	describe('installation proof', () => {
		it('is valid only for the flow and installation it was issued for, and only until it expires', () => {
			const now = 1_800_000_000_000;
			const proof = signGithubInstallProof(STATE, ORG, now);

			expect(isGithubInstallProofValid(proof, STATE, ORG, now)).toBe(true);
			expect(isGithubInstallProofValid(proof, OTHER_STATE, ORG, now)).toBe(false);
			expect(isGithubInstallProofValid(proof, STATE, PERSONAL, now)).toBe(false);
			expect(isGithubInstallProofValid(proof, STATE, ORG, now + 10 * 60 * 1000 + 1)).toBe(false);
			expect(isGithubInstallProofValid(`${now + 1000}.${'f'.repeat(64)}`, STATE, ORG, now)).toBe(false);
			expect(isGithubInstallProofValid(undefined, STATE, ORG, now)).toBe(false);
		});
	});

	describe('POST /integration/github/install', () => {
		const setup = (nonceTenant = TENANT_ID) => {
			const githubService = { addGithubAppInstallation: jest.fn(async (input: unknown) => ({ bound: input })) };
			const stateService = { consume: jest.fn(async () => ({ tenantId: nonceTenant, organizationId: ORGANIZATION_ID })) };
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(TENANT_ID);
			const controller = new GitHubController(githubService as any, stateService as any);
			return { controller, githubService };
		};
		const body = (installation_id: string, extra: Record<string, unknown> = {}) =>
			({ installation_id, setup_action: 'install', state: STATE, ...extra }) as any;

		it("CONTROL: the service on its own binds any id it is handed, another organization's included", async () => {
			// What `POST /install` used to rely on alone: a tenant-owned nonce, then this call.
			const { githubService } = setup();

			await githubService.addGithubAppInstallation({ installation_id: ORG, setup_action: 'install' });

			expect(githubService.addGithubAppInstallation).toHaveBeenCalledWith(expect.objectContaining({ installation_id: ORG }));
		});

		it('refuses an installation with no proof, and names the GitHub App setting that fixes it', async () => {
			const { controller, githubService } = setup();

			const error = await controller.addGithubAppInstallation(body(ORG, { install_check: 'no_code' })).catch((caught) => caught);

			expect(error).toBeInstanceOf(HttpException);
			expect((error as HttpException).getStatus()).toBe(403);
			expect((error as HttpException).message).toContain('Request user authorization (OAuth) during installation');
			expect((error as HttpException).message).toContain('https://api.example.test/api/integration/github/callback');
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it('explains a refusal for an installation the authorizing user is not entitled to', async () => {
			const { controller } = setup();

			const error = await controller.addGithubAppInstallation(body(ORG, { install_check: 'not_entitled' })).catch((caught) => caught);

			expect((error as HttpException).getStatus()).toBe(403);
			expect((error as HttpException).message).toContain('every repository');
		});

		it('refuses a proof issued for another flow, another installation, or forged', async () => {
			const { controller, githubService } = setup();

			for (const install_proof of [
				signGithubInstallProof(OTHER_STATE, ORG),
				signGithubInstallProof(STATE, PERSONAL),
				`${Date.now() + 60_000}.${'f'.repeat(64)}`
			]) {
				await expect(controller.addGithubAppInstallation(body(ORG, { install_proof }))).rejects.toMatchObject({ status: 403 });
			}
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it("refuses a valid proof against another tenant's nonce", async () => {
			const { controller, githubService } = setup('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

			await expect(
				controller.addGithubAppInstallation(body(ORG, { install_proof: signGithubInstallProof(STATE, ORG) }))
			).rejects.toMatchObject({ status: 403 });
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it('binds an installation carrying a proof for exactly this flow', async () => {
			const { controller, githubService } = setup();

			await controller.addGithubAppInstallation(body(ORG, { install_proof: signGithubInstallProof(STATE, ORG) }));

			expect(githubService.addGithubAppInstallation).toHaveBeenCalledWith(
				expect.objectContaining({ installation_id: ORG, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
			);
		});
	});

	describe('GET /integration/github/callback (post-install)', () => {
		const setup = (entitled: boolean | 'throws' = true) => {
			const config = { get: jest.fn(() => ({ postInstallUrl: 'https://app.example.test/#/setup' })) };
			const stateService = { peek: jest.fn(async () => ({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })) };
			const ownership = {
				isEntitledToInstallation: jest.fn(async () => {
					if (entitled === 'throws') throw new Error('credentials missing');
					return entitled;
				})
			};
			const response = { redirect: jest.fn() };
			const controller = new GitHubAuthorizationController(config as any, stateService as any, ownership as any);
			return { controller, response, ownership };
		};
		const redirected = (response: { redirect: jest.Mock }) =>
			new URL(String(response.redirect.mock.calls[0][0]).replace('#/', ''));

		it('spends the code at the callback and forwards only a proof for this flow, never the code', async () => {
			const { controller, response, ownership } = setup(true);

			await controller.githubIntegrationPostInstallCallback(
				{ installation_id: ORG, setup_action: 'install', state: STATE, code: 'oauth-code' } as any,
				response as any
			);

			expect(ownership.isEntitledToInstallation).toHaveBeenCalledWith('oauth-code', ORG);
			const target = redirected(response);
			expect(target.searchParams.has('code')).toBe(false);
			expect(isGithubInstallProofValid(target.searchParams.get('install_proof'), STATE, ORG)).toBe(true);
		});

		it('forwards no proof, only the reason, when the user is not entitled, the check fails, or there is no code', async () => {
			for (const [entitled, extra, reason] of [
				[false, { code: 'oauth-code' }, 'not_entitled'],
				['throws', { code: 'oauth-code' }, 'unverifiable'],
				[true, {}, 'no_code']
			] as const) {
				const { controller, response } = setup(entitled);

				await controller.githubIntegrationPostInstallCallback(
					{ installation_id: ORG, setup_action: 'install', state: STATE, ...extra } as any,
					response as any
				);

				const target = redirected(response);
				expect(target.searchParams.has('install_proof')).toBe(false);
				expect(target.searchParams.get('install_check')).toBe(reason);
			}
		});

		it('sends a member who only REQUESTED the installation back to the app instead of a raw 400', async () => {
			const { controller, response } = setup();

			await controller.githubIntegrationPostInstallCallback({ setup_action: 'request' } as any, response as any);

			expect(response.redirect).toHaveBeenCalledWith('https://app.example.test/#/setup?setup_action=request');
		});

		it('sends an installation edited on GitHub (no state) back to the app instead of a raw 400', async () => {
			const { controller, response } = setup();

			await controller.githubIntegrationPostInstallCallback({ installation_id: ORG, setup_action: 'update' } as any, response as any);

			expect(response.redirect).toHaveBeenCalledWith('https://app.example.test/#/setup?setup_action=update');
		});

		it('still rejects a new installation without its nonce', async () => {
			const { controller, response } = setup();

			await expect(
				controller.githubIntegrationPostInstallCallback({ installation_id: ORG, setup_action: 'install' } as any, response as any)
			).rejects.toMatchObject({ status: 400 });
			expect(response.redirect).not.toHaveBeenCalled();
		});
	});
});
