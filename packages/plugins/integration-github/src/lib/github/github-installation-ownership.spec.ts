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
// The real OctokitService pulls in probot; only its repository count is used here.
jest.mock('../probot/octokit.service', () => ({ OctokitService: class OctokitService {} }));

import { environment } from '@gauzy/config';
import { RequestContext } from '@gauzy/core';
import { GithubInstallationOwnershipService } from './github-installation-ownership.service';
import { GitHubController } from './github.controller';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { signGithubInstallCode } from './github-install-code-binding';

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
	const ME = 501;
	const PERSONAL = '1000001';
	const ORG = '3000003';

	interface IScenario {
		token?: string | null;
		exchangeError?: boolean;
		/** Pages of installations visible to the user. */
		pages?: Array<Array<{ id: number; account: { id: number; type: 'User' | 'Organization' } }>>;
		/** Repositories of ORG the user can reach, and the App's own count. */
		userRepoCount?: number;
		appRepoCount?: number | 'fails';
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
					return of({ data: { total_count: scenario.userRepoCount ?? 5 } });
				}
				return throwError(() => new Error(`unexpected GET ${url}`));
			}),
			delete: jest.fn(() => of({ data: {} }))
		};
		const octokit = {
			getInstallationRepositoryCount: jest.fn(async () => {
				if (scenario.appRepoCount === 'fails') throw new Error('App not configured');
				return scenario.appRepoCount ?? 5;
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

		it("refuses a personal installation of SOMEONE ELSE that the user can see (e.g. as a collaborator)", async () => {
			const { service } = build({ pages: [[{ id: Number(PERSONAL), account: { id: 777, type: 'User' } }]] });

			await expect(service.isEntitledToInstallation('oauth-code', PERSONAL)).resolves.toBe(false);
		});

		it('accepts an organization installation when the user reaches every repository in it', async () => {
			const { service } = build({ userRepoCount: 12, appRepoCount: 12 });

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(true);
		});

		it('CONTROL: GitHub lists an organization installation to a user who reaches only ONE of its repositories', async () => {
			// `/user/installations` alone is what a naive check would trust.
			const { http } = build({ userRepoCount: 1, appRepoCount: 40 });
			const { data } = (await firstValueFrom(
				(http.get as any)('https://api.github.com/user/installations', { params: { page: 1 } })
			)) as any;

			expect(data.installations.map((installation: any) => String(installation.id))).toContain(ORG);
		});

		it('refuses that partial-access user: binding would expose repositories they cannot read', async () => {
			const { service } = build({ userRepoCount: 1, appRepoCount: 40 });

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

		it('fails closed when GitHub does not say how many repositories the user reaches', async () => {
			const { service, http } = build({ appRepoCount: 5 });
			const original = http.get.getMockImplementation() as any;
			(http.get as any).mockImplementation((url: string, config: any) =>
				url.includes('/user/installations/') && url.endsWith('/repositories')
					? of({ data: { repositories: [] } })
					: original(url, config)
			);

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it("does not let a member count throwaway repositories they delete before the App's count is read", async () => {
			// The member reaches 20 of the organization's repositories and not the other 20, and has just
			// created 20 throwaway repositories of their own (which the "all repositories" installation picks up).
			let appRepos = 60;
			const { service, http, octokit } = build();
			(octokit.getInstallationRepositoryCount as any).mockImplementation(async () => appRepos);
			const original = http.get.getMockImplementation() as any;
			(http.get as any).mockImplementation((url: string, config: any) => {
				if (url.includes('/user/installations/') && url.endsWith('/repositories')) {
					appRepos = 40; // ...and deletes the throwaway repositories right after the user side is read
					return of({ data: { total_count: 40 } });
				}
				return original(url, config);
			});

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it("does not let a member count throwaway repositories created after the App's count is first read", async () => {
			// Reaches 20 of the organization's 40 repositories; creates 20 throwaway ones just before the user side is read.
			let appRepos = 40;
			const { service, http, octokit } = build();
			(octokit.getInstallationRepositoryCount as any).mockImplementation(async () => appRepos);
			const original = http.get.getMockImplementation() as any;
			(http.get as any).mockImplementation((url: string, config: any) => {
				if (url.includes('/user/installations/') && url.endsWith('/repositories')) {
					appRepos = 60;
					return of({ data: { total_count: 40 } });
				}
				return original(url, config);
			});

			await expect(service.isEntitledToInstallation('oauth-code', ORG)).resolves.toBe(false);
		});

		it('fails closed when the App cannot count the installation repositories', async () => {
			const { service } = build({ appRepoCount: 'fails' });

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

	describe('POST /integration/github/install', () => {
		const setup = (entitled: boolean, nonceTenant = TENANT_ID) => {
			const githubService = { addGithubAppInstallation: jest.fn(async (input: unknown) => ({ bound: input })) };
			const stateService = { consume: jest.fn(async () => ({ tenantId: nonceTenant, organizationId: ORGANIZATION_ID })) };
			const ownership = { isEntitledToInstallation: jest.fn(async () => entitled) };
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(TENANT_ID);
			const controller = new GitHubController(githubService as any, stateService as any, ownership as any);
			return { controller, githubService, ownership };
		};
		/** A body as the web app sends it after a real callback: the code plus the callback's signature. */
		const body = (installation_id: string, code?: string, code_binding = code ? signGithubInstallCode(STATE, code) : undefined) =>
			({ installation_id, setup_action: 'install', state: STATE, ...(code ? { code, code_binding } : {}) }) as any;

		it('refuses a code that was not issued with THIS flow (a leaked code replayed against my own nonce)', async () => {
			const { controller, githubService, ownership } = setup(true);
			const signedForAnotherFlow = signGithubInstallCode('c'.repeat(64), 'oauth-code');

			for (const binding of [undefined, signedForAnotherFlow, 'f'.repeat(64)]) {
				await expect(
					controller.addGithubAppInstallation({ ...body(ORG), code: 'oauth-code', code_binding: binding })
				).rejects.toMatchObject({ status: 403 });
			}
			// Refused before the code is ever exchanged with GitHub.
			expect(ownership.isEntitledToInstallation).not.toHaveBeenCalled();
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it("CONTROL: the service on its own binds any id it is handed, another organization's included", async () => {
			// What `POST /install` used to rely on alone: a tenant-owned nonce, then this call.
			const { githubService } = setup(false);

			await githubService.addGithubAppInstallation({ installation_id: ORG, setup_action: 'install' });

			expect(githubService.addGithubAppInstallation).toHaveBeenCalledWith(expect.objectContaining({ installation_id: ORG }));
		});

		it('refuses an install that carries no OAuth code, and names the GitHub App setting that fixes it', async () => {
			const { controller, githubService, ownership } = setup(true);

			const error = await controller.addGithubAppInstallation(body(ORG)).catch((caught) => caught);

			expect(error).toBeInstanceOf(HttpException);
			expect((error as HttpException).getStatus()).toBe(403);
			expect((error as HttpException).message).toContain('Request user authorization (OAuth) during installation');
			expect((error as HttpException).message).toContain('https://api.example.test/api/integration/github/callback');
			expect(ownership.isEntitledToInstallation).not.toHaveBeenCalled();
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it('refuses an installation the authorizing GitHub user is not entitled to', async () => {
			const { controller, githubService, ownership } = setup(false);

			await expect(controller.addGithubAppInstallation(body(ORG, 'oauth-code'))).rejects.toMatchObject({ status: 403 });
			expect(ownership.isEntitledToInstallation).toHaveBeenCalledWith('oauth-code', ORG);
			expect(githubService.addGithubAppInstallation).not.toHaveBeenCalled();
		});

		it("never exchanges a code against another tenant's nonce", async () => {
			const { controller, ownership } = setup(true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

			await expect(controller.addGithubAppInstallation(body(ORG, 'oauth-code'))).rejects.toMatchObject({ status: 403 });
			expect(ownership.isEntitledToInstallation).not.toHaveBeenCalled();
		});

		it('binds an installation the authorizing user is entitled to', async () => {
			const { controller, githubService } = setup(true);

			await controller.addGithubAppInstallation(body(ORG, 'oauth-code'));

			expect(githubService.addGithubAppInstallation).toHaveBeenCalledWith(
				expect.objectContaining({ installation_id: ORG, tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })
			);
		});
	});

	describe('GET /integration/github/callback (post-install)', () => {
		const setup = () => {
			const config = { get: jest.fn(() => ({ postInstallUrl: 'https://app.example.test/#/setup' })) };
			const stateService = { peek: jest.fn(async () => ({ tenantId: TENANT_ID, organizationId: ORGANIZATION_ID })) };
			const response = { redirect: jest.fn() };
			const controller = new GitHubAuthorizationController(config as any, stateService as any);
			return { controller, response };
		};

		it('forwards the OAuth code to the web app, which proves ownership in the authenticated POST /install', async () => {
			const { controller, response } = setup();

			await controller.githubIntegrationPostInstallCallback(
				{ installation_id: ORG, setup_action: 'install', state: STATE, code: 'oauth-code' } as any,
				response as any
			);

			const target = new URL(String(response.redirect.mock.calls[0][0]).replace('#/', ''));
			expect(target.searchParams.get('code')).toBe('oauth-code');
			expect(target.searchParams.get('installation_id')).toBe(ORG);
			// Signed together with the nonce it arrived with.
			expect(target.searchParams.get('code_binding')).toBe(signGithubInstallCode(STATE, 'oauth-code'));
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
