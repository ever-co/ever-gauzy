import { Controller, Get, Inject, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { ID } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { accessibleJiraSites, exchangeJiraCode, JiraApiClient, JiraMyself, JiraOAuthToken, JiraSite } from './client/jira-api.client';
import { isJiraConfigured, JiraCloudConfig } from './jira-config';
import { JiraMappingService } from './jira-mapping.service';
import { JiraOAuthStateService } from './jira-oauth-state.service';
import { jiraSyncUser, runInJiraContext } from './jira-process';
import { JiraTenantService } from './jira-tenant.service';
import { JIRA_CONFIG, JIRA_ROUTE_PREFIX } from './jira.constants';

/** Why the callback sent the person back without a connection. */
type CallbackError = 'not_configured' | 'denied' | 'invalid_state' | 'exchange_failed' | 'no_site' | 'site_unreadable' | 'site_mismatch' | 'not_saved';

/** Where the callback sends the person: the connection, and whether they must still choose its site. */
type CallbackResult = { error: CallbackError } | { integrationId: string; organizationId: string; siteRequired?: 'true' };

/**
 * `GET /integration/jira/callback?code&state`: where Atlassian sends the person after they authorized the app. Public
 * (the person arrives from Atlassian, not from the app), so everything rests on the single-use `state`: it names the
 * tenant and organization the connection belongs to; the query never does. The code is exchanged here, once; the
 * Jira sites the token reaches are read (`accessible-resources`): with one, it is the connection's site at once; with
 * several, the connection is stored and the person chooses its site on the app's Jira page (`siteRequired`). A
 * reconnect of a connection that has mappings keeps its site, whatever the token reaches besides: its mappings name
 * Jira projects by ids only that site knows (`site_mismatch` when the token no longer reaches it). The person is then
 * sent to that page, always the server-side configured one.
 */
@ApiExcludeController()
@Controller(JIRA_ROUTE_PREFIX)
export class JiraAuthorizationController {
	private readonly logger = new Logger(JiraAuthorizationController.name);

	constructor(
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		private readonly oauthState: JiraOAuthStateService,
		private readonly tenants: JiraTenantService,
		private readonly mappings: JiraMappingService
	) {}

	@Public()
	@Get('/callback')
	async callback(@Query() query: Record<string, string | undefined>, @Res() response: Response): Promise<void> {
		if (!isJiraConfigured(this.config)) {
			return this.back(response, { error: 'not_configured' });
		}
		const state = typeof query['state'] === 'string' ? query['state'] : undefined;
		const scope = await this.oauthState.consume(state);
		if (!scope) {
			return this.back(response, { error: 'invalid_state' });
		}
		const code = typeof query['code'] === 'string' ? query['code'] : '';
		if (!code || query['error']) {
			return this.back(response, { error: 'denied' });
		}
		let token: JiraOAuthToken;
		try {
			token = await exchangeJiraCode(this.config.tokenUrl, {
				code,
				clientId: this.config.clientId as string,
				clientSecret: this.config.clientSecret as string,
				redirectUri: this.config.redirectUrl as string
			});
		} catch (error) {
			this.logger.warn(`The Jira code exchange failed: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'exchange_failed' });
		}
		// The app asks for `offline_access`: a grant without a refresh token would stop working within the hour, and the
		// scheduled import with it. It is not saved.
		if (!token.refreshToken) {
			this.logger.warn('The Jira code exchange answered no refresh token (offline_access not granted); the connection is not saved.');
			return this.back(response, { error: 'exchange_failed' });
		}
		let sites: JiraSite[];
		try {
			sites = await accessibleJiraSites(token.accessToken, { apiUrl: this.config.apiUrl });
		} catch (error) {
			this.logger.warn(`The Jira sites could not be read after connecting: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'site_unreadable' });
		}
		if (!sites.length) {
			return this.back(response, { error: 'no_site' });
		}
		// The request is public (no user, no tenant): the connection is read and written inside a request context built
		// from the consumed state, so the platform's tenant-aware services scope it to that tenant.
		const user = jiraSyncUser(scope, scope.userId ?? null);
		let pinned: string | null;
		try {
			pinned = await runInJiraContext(user, () => this.pinnedSiteOf(scope));
		} catch (error) {
			this.logger.error(`The Jira connection being replaced could not be read: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'not_saved' });
		}
		// A connection with mappings keeps its site; otherwise the only site, or none yet (a person chooses).
		const site = pinned ? (sites.find((candidate) => candidate.id === pinned) ?? null) : sites.length === 1 ? sites[0] : null;
		if (pinned && !site) {
			this.logger.warn(`A reconnect of the organization ${scope.organizationId} no longer reaches the Jira site its mappings name; not saved.`);
			return this.back(response, { error: 'site_mismatch' });
		}
		let chosen: { site: JiraSite; myself: JiraMyself } | null = null;
		if (site) {
			try {
				const myself = await new JiraApiClient(token.accessToken, site.id, { apiUrl: this.config.apiUrl, tokenType: token.tokenType }).myself();
				chosen = { site, myself };
			} catch (error) {
				this.logger.warn(`The Jira site could not be read after connecting: ${error instanceof Error ? error.message : String(error)}`);
				return this.back(response, { error: 'site_unreadable' });
			}
		}
		let tenant: { id?: unknown };
		try {
			// Written under the mappings lock, the pinned site read again there: a mapping created meanwhile for the
			// former site (its project id means nothing on another) refuses a reconnect to another site.
			const saved = await runInJiraContext(user, () =>
				this.mappings.whileOrganizationMappingsLocked(scope, async () => {
					const pinnedNow = await this.pinnedSiteOf(scope);
					if (pinnedNow && chosen?.site.id !== pinnedNow) return null;
					return this.tenants.connect(scope, token, chosen);
				})
			);
			if (!saved) {
				this.logger.warn(`A reconnect of the organization ${scope.organizationId} raced a mapping of its former Jira site; not saved.`);
				return this.back(response, { error: 'site_mismatch' });
			}
			tenant = saved;
		} catch (error) {
			this.logger.error(`The Jira connection could not be saved: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'not_saved' });
		}
		return this.back(response, {
			integrationId: String(tenant.id),
			organizationId: String(scope.organizationId),
			...(chosen ? {} : { siteRequired: 'true' as const })
		});
	}

	/**
	 * The site the organization's connection must keep through a reconnect: its site when it has mappings (they name
	 * Jira projects by ids only that site knows) or issues it synced (their id maps name Jira issue ids of that site),
	 * else null (a reconnect may then move to another site).
	 */
	private async pinnedSiteOf(scope: { tenantId: ID; organizationId: ID }): Promise<string | null> {
		const existing = await this.tenants.forOrganization(scope.organizationId, scope.tenantId);
		const cloudId = existing ? this.tenants.summaryOf(existing).cloudId : null;
		if (!existing || !cloudId) return null;
		if ((await this.mappings.list(existing)).length) return cloudId;
		// Issues it synced, or a run still writing some (its mapping may be gone already), name ids of that site too.
		// Live runs first: a run no longer running has committed its id maps, which the read after it then sees.
		return (await this.mappings.hasLiveRuns(existing)) || (await this.mappings.hasIssueMaps(existing)) ? cloudId : null;
	}

	/** Sends the person to the app's Jira page (or answers JSON when no page is configured). */
	private back(response: Response, result: CallbackResult): void {
		if (!this.config.postInstallUrl) {
			response.status('error' in result ? 400 : 200).json(result);
			return;
		}
		// The page may host several integrations' returns: the provider is named so each reads only its own. A route that
		// carries a query of its own (`#/pages/integrations/jira?mode=setup`) gets the result added to it.
		const params = new URLSearchParams({ provider: 'jira', ...(result as Record<string, string>) });
		const joiner = this.config.postInstallUrl.includes('?') ? '&' : '?';
		response.redirect(`${this.config.postInstallUrl}${joiner}${params.toString()}`);
	}
}
