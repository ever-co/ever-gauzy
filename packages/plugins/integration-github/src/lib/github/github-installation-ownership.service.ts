import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { environment } from '@gauzy/config';
import { GITHUB_ACCESS_TOKEN_URL } from './github.config';
import { OctokitService } from '../probot/octokit.service';

const GITHUB_API = 'https://api.github.com';
/** Bound on pagination: 100 per page, so this covers users with up to 1,000 installations. */
const MAX_PAGES = 10;
/** Repositories of one installation: 100 per page, up to 5,000 (the App side uses the same bound). */
const MAX_REPOSITORY_PAGES = 50;
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
 * - installation on an organization: the user must be able to read every repository the installation
 *   covers, compared by repository id against the App's own view.
 *
 * The proof comes from the OAuth `code` GitHub issues when the App has "Request user authorization
 * (OAuth) during installation" enabled. The post-install callback exchanges it the moment it arrives
 * and, on success, hands the browser a signed proof bound to the flow (see `github-install-proof.ts`).
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
		// Octokit takes the id as a number: an id JavaScript cannot represent exactly would be checked as
		// a DIFFERENT installation than the one stored (the DTO allows up to 20 digits).
		if (!Number.isSafeInteger(Number(installationId)) || String(Number(installationId)) !== installationId) {
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

		// Organization (or enterprise) installation: the user must already read EVERY repository in it.
		// Compared by repository id, not by count: a member who can create and delete repositories could
		// otherwise balance the counts with throwaway repositories while the ones hidden from them remain.
		// The user's ids are read first; the App's afterwards, so any repository present when the App
		// looks must already have been visible to the user.
		const userRepositoryIds = await this.userRepositoryIds(token, installationId);
		const appRepositoryIds = await this._octokit.getInstallationRepositoryIds(Number(installationId));
		const hidden = [...appRepositoryIds].filter((id) => !userRepositoryIds.has(id));
		if (hidden.length > 0) {
			this.logger.warn(
				`GitHub installation ${installationId}: authorizing user cannot read ${hidden.length} of ${appRepositoryIds.size} repositories`
			);
			return false;
		}
		return true;
	}

	/** Every repository of the installation the token holder can read, by id (bounded). */
	private async userRepositoryIds(token: string, installationId: string): Promise<Set<string>> {
		const ids = new Set<string>();
		for (let page = 1; page <= MAX_REPOSITORY_PAGES; page++) {
			const data = await this.get(token, `${GITHUB_API}/user/installations/${installationId}/repositories`, {
				per_page: 100,
				page
			});
			const repositories: Array<{ id?: number | string }> = Array.isArray(data?.repositories) ? data.repositories : [];
			for (const repository of repositories) {
				if (repository?.id !== undefined && repository?.id !== null) {
					ids.add(String(repository.id));
				}
			}
			if (repositories.length === 0 || ids.size >= Number(data?.total_count ?? 0)) {
				return ids;
			}
		}
		throw new Error('Too many repositories to verify');
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
