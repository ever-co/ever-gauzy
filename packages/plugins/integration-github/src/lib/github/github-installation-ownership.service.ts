import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { environment } from '@gauzy/config';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';
import { OctokitService } from '../probot/octokit.service';

const GITHUB_API = 'https://api.github.com';
/** Bound on pagination: 100 per page, so this covers users with up to 1,000 installations. */
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const GITHUB_HEADERS = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };

interface IUserInstallation {
	id?: number | string;
	account?: { id?: number | string; type?: string } | null;
}

/**
 * Proves that the Gauzy user completing a GitHub App installation is entitled to ALL of it
 * (GHSA-4rwq-65wh-45h4).
 *
 * The post-install redirect carries an `installation_id` anyone can type. Binding an installation to a
 * tenant hands that tenant the App's token for every repository in it, so "the user can see this
 * installation" is not enough: GitHub lists an installation to anyone with access to even one of its
 * repositories. The rule is therefore that binding may grant the tenant NOTHING the authorizing GitHub
 * user could not already read:
 *
 * - installation on a personal account: the authorizing user must BE that account;
 * - installation on an organization: the user must have access to every repository the installation
 *   covers (their count under `/user/installations/{id}/repositories` equals the App's own count).
 *
 * The proof comes from the OAuth `code` GitHub issues when the App has "Request user authorization
 * (OAuth) during installation" enabled. It is exchanged inside the authenticated `POST /install`, so
 * the GitHub user who authorized and the Gauzy session that binds are the same browser.
 */
@Injectable()
export class GithubInstallationOwnershipService {
	private readonly logger = new Logger(GithubInstallationOwnershipService.name);

	constructor(
		private readonly _http: HttpService,
		private readonly _octokit: OctokitService
	) {}

	/**
	 * @param code - The OAuth `code` GitHub appended to the post-install redirect.
	 * @param installationId - The canonical installation id the caller wants to bind.
	 * @returns `true` only when the authorizing GitHub user is entitled to the whole installation.
	 * @throws HttpException (503) when the GitHub App's client credentials are not configured: ownership
	 * then cannot be proven at all, and the install must not proceed on trust.
	 */
	async isEntitledToInstallation(code: string, installationId: string): Promise<boolean> {
		const { clientId, clientSecret } = environment.github ?? ({} as typeof environment.github);
		if (!clientId || !clientSecret) {
			this.logger.error('GitHub App client id/secret are not configured; cannot verify installation ownership');
			throw new HttpException(
				'GitHub App installation cannot be verified: GAUZY_GITHUB_CLIENT_ID and GAUZY_GITHUB_CLIENT_SECRET are not configured on the API.',
				HttpStatus.SERVICE_UNAVAILABLE
			);
		}
		if (typeof code !== 'string' || !code.trim()) {
			return false;
		}

		const token = await this.exchangeCode(clientId, clientSecret, code);
		if (!token) {
			return false;
		}

		try {
			return await this.tokenHolderIsEntitled(token, installationId);
		} catch (error) {
			// Any lookup failure means "not proven".
			this.logger.warn(`GitHub installation ownership lookup failed: ${(error as Error)?.message}`);
			return false;
		} finally {
			// The token was needed for these lookups only. Revoke it so it never outlives this request.
			await this.revokeToken(clientId, clientSecret, token);
		}
	}

	private async tokenHolderIsEntitled(token: string, installationId: string): Promise<boolean> {
		const installation = await this.findUserInstallation(token, installationId);
		if (!installation) {
			return false;
		}

		const accountType = String(installation.account?.type ?? '');
		if (accountType === 'User') {
			// A personal installation belongs to exactly one GitHub user: the one who must authorize.
			const me = await this.get(token, `${GITHUB_API}/user`);
			return me?.id !== undefined && String(me.id) === String(installation.account?.id);
		}

		// Organization (or enterprise) installation: the user must already reach every repository in it.
		// The user's repositories are a subset of the App's, so the counts can only differ in the user's
		// favour when repositories come and go between the two reads. The App's count is therefore taken
		// on BOTH sides of the user's and the larger one is used: otherwise a member who can create and
		// delete repositories could count their own throwaway repositories on the user side and delete
		// them before the App side is read.
		const appCountBefore = await this._octokit.getInstallationRepositoryCount(Number(installationId));
		const visibleToUser = await this.get(token, `${GITHUB_API}/user/installations/${installationId}/repositories`, {
			per_page: 1
		});
		const appCountAfter = await this._octokit.getInstallationRepositoryCount(Number(installationId));
		const userCount = Number(visibleToUser?.total_count);
		const appCount = Math.max(appCountBefore, appCountAfter);
		if (!Number.isFinite(userCount) || !Number.isFinite(appCount)) {
			return false;
		}
		if (userCount < appCount) {
			this.logger.warn(
				`GitHub installation ${installationId}: authorizing user reaches ${userCount} of ${appCount} repositories`
			);
			return false;
		}
		return true;
	}

	/** Walks `GET /user/installations` for the claimed id. */
	private async findUserInstallation(token: string, installationId: string): Promise<IUserInstallation | null> {
		for (let page = 1; page <= MAX_PAGES; page++) {
			const data = await this.get(token, `${GITHUB_API}/user/installations`, { per_page: 100, page });
			const installations: IUserInstallation[] = Array.isArray(data?.installations) ? data.installations : [];
			const match = installations.find((installation) => String(installation?.id) === installationId);
			if (match) {
				return match;
			}
			if (installations.length === 0 || page * 100 >= Number(data?.total_count ?? 0)) {
				return null;
			}
		}
		return null;
	}

	private async get(token: string, url: string, params?: Record<string, unknown>): Promise<any> {
		const { data } = await firstValueFrom(
			this._http.get(url, {
				params,
				headers: { ...GITHUB_HEADERS, authorization: `Bearer ${token}` },
				timeout: REQUEST_TIMEOUT_MS
			})
		);
		return data;
	}

	/** Exchanges the OAuth code for a user-to-server token; `null` on any failure. Never logs the token. */
	private async exchangeCode(clientId: string, clientSecret: string, code: string): Promise<string | null> {
		try {
			const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code });
			const { data } = await firstValueFrom(
				this._http.post(GITHUB_ACCESS_TOKEN_URL, params, {
					headers: { accept: 'application/json' },
					timeout: REQUEST_TIMEOUT_MS
				})
			);
			if (!data || data.error || typeof data.access_token !== 'string' || !data.access_token) {
				this.logger.warn(`GitHub OAuth code exchange failed: ${data?.error ?? 'no access token'}`);
				return null;
			}
			return data.access_token;
		} catch (error) {
			this.logger.warn(`GitHub OAuth code exchange failed: ${(error as Error)?.message}`);
			return null;
		}
	}

	/** Best effort: a failed revocation must not turn a verified install into a failed one. */
	private async revokeToken(clientId: string, clientSecret: string, token: string): Promise<void> {
		try {
			await firstValueFrom(
				this._http.delete(`${GITHUB_API}/applications/${encodeURIComponent(clientId)}/token`, {
					auth: { username: clientId, password: clientSecret },
					data: { access_token: token },
					headers: GITHUB_HEADERS,
					timeout: REQUEST_TIMEOUT_MS
				})
			);
		} catch (error) {
			this.logger.debug(`Could not revoke the GitHub user token used for verification: ${(error as Error)?.message}`);
		}
	}
}
