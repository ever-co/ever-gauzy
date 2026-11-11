import { Controller, Get, Inject, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { accessibleJiraSites, exchangeJiraCode, JiraApiClient, JiraMyself, JiraOAuthToken, JiraSite } from './client/jira-api.client';
import { isJiraConfigured, JiraCloudConfig } from './jira-config';
import { JiraOAuthStateService } from './jira-oauth-state.service';
import { jiraSyncUser, runInJiraContext } from './jira-process';
import { JiraTenantService } from './jira-tenant.service';
import { JIRA_CONFIG, JIRA_ROUTE_PREFIX } from './jira.constants';

/** Why the callback sent the person back without a connection. */
type CallbackError = 'not_configured' | 'denied' | 'invalid_state' | 'exchange_failed' | 'no_site' | 'site_unreadable' | 'not_saved';

/** Where the callback sends the person: the connection, and whether they must still choose its site. */
type CallbackResult = { error: CallbackError } | { integrationId: string; organizationId: string; siteRequired?: 'true' };

/**
 * `GET /integration/jira/callback?code&state`: where Atlassian sends the person after they authorized the app. Public
 * (the person arrives from Atlassian, not from the app), so everything rests on the single-use `state`: it names the
 * tenant and organization the connection belongs to; the query never does. The code is exchanged here, once; the
 * Jira sites the token reaches are read (`accessible-resources`): with one, it is the connection's site at once; with
 * several, the connection is stored and the person chooses its site on the app's Jira page (`siteRequired`). The
 * person is then sent to that page, always the server-side configured one.
 */
@ApiExcludeController()
@Controller(JIRA_ROUTE_PREFIX)
export class JiraAuthorizationController {
	private readonly logger = new Logger(JiraAuthorizationController.name);

	constructor(
		@Inject(JIRA_CONFIG) private readonly config: JiraCloudConfig,
		private readonly oauthState: JiraOAuthStateService,
		private readonly tenants: JiraTenantService
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
		let sites: JiraSite[];
		let chosen: { site: JiraSite; myself: JiraMyself } | null = null;
		try {
			sites = await accessibleJiraSites(token.accessToken, { apiUrl: this.config.apiUrl });
			if (sites.length === 1) {
				const myself = await new JiraApiClient(token.accessToken, sites[0].id, { apiUrl: this.config.apiUrl, tokenType: token.tokenType }).myself();
				chosen = { site: sites[0], myself };
			}
		} catch (error) {
			this.logger.warn(`The Jira sites could not be read after connecting: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'site_unreadable' });
		}
		if (!sites.length) {
			return this.back(response, { error: 'no_site' });
		}
		try {
			// The request is public (no user, no tenant): the connection is written inside a request context built from the
			// consumed state, so the platform's tenant-aware services scope it to that tenant.
			const tenant = await runInJiraContext(jiraSyncUser(scope, scope.userId ?? null), () => this.tenants.connect(scope, token, chosen));
			return this.back(response, {
				integrationId: String(tenant.id),
				organizationId: String(scope.organizationId),
				...(chosen ? {} : { siteRequired: 'true' as const })
			});
		} catch (error) {
			this.logger.error(`The Jira connection could not be saved: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'not_saved' });
		}
	}

	/** Sends the person to the app's Jira page (or answers JSON when no page is configured). */
	private back(response: Response, result: CallbackResult): void {
		if (!this.config.postInstallUrl) {
			response.status('error' in result ? 400 : 200).json(result);
			return;
		}
		// The page may host several integrations' returns: the provider is named so each reads only its own.
		const params = new URLSearchParams({ provider: 'jira', ...(result as Record<string, string>) });
		response.redirect(`${this.config.postInstallUrl}?${params.toString()}`);
	}
}
